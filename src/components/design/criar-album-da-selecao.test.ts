import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/actions/design-selecao', () => ({ consultarDesignSelecao: vi.fn(), criarAlbumDaSelecao: vi.fn() }))

const { FormularioCriarAlbum, PREFIXO_FORM, PREFIXO_GATILHO } = await import('./criar-album-da-selecao')
const { acaoDaTecla, focoAoFechar, focoInicial, idsFocaveis } = await import('@/lib/design-selecao/acessibilidade')

const noop = () => {}
const base = {
  revisao: 2,
  total: 120,
  destino: 'projeto' as 'projeto' | 'avulso',
  temAlbumProjeto: false,
  nome: '',
  precisaFormato: false,
  formato: '30x30',
  orientacao: 'quadrado',
  ocupado: false,
  erro: null as string | null,
  onDestino: noop,
  onNome: noop,
  onFormato: noop,
  onOrientacao: noop,
  onEnviar: noop,
  onCancelar: noop,
}
const html = (over: Partial<typeof base> = {}) => renderToStaticMarkup(createElement(FormularioCriarAlbum, { ...base, ...over }))

/** Ids na ordem em que aparecem no HTML (a ordem do DOM é a ordem do Tab, sem tabindex positivo). */
const idsNaOrdem = (marcacao: string, ids: string[]) =>
  ids.map((id) => ({ id, pos: marcacao.indexOf(`id="${id}"`) })).sort((a, b) => a.pos - b.pos).filter((x) => x.pos >= 0).map((x) => x.id)

describe('formulário "Criar álbum" — rótulos e papéis', () => {
  it('o formulário tem nome acessível e o título descreve a revisão', () => {
    const h = html()
    expect(h).toMatch(/<form[^>]*aria-labelledby="criar-album-titulo"/)
    expect(h).toContain('id="criar-album-titulo"')
    expect(h).toContain('Criar álbum da revisão 2 (120 fotos)')
  })

  it('o tipo de álbum é um grupo de rádios com legenda, e cada rádio tem label e descrição ligadas por id', () => {
    const h = html()
    expect(h).toMatch(/<fieldset[^>]*><legend[^>]*>Tipo de álbum<\/legend>/)
    for (const d of ['projeto', 'avulso']) {
      expect(h).toContain(`<label for="${PREFIXO_FORM}-destino-${d}"`)
      expect(h).toMatch(new RegExp(`id="${PREFIXO_FORM}-destino-${d}"[^>]*aria-describedby="${PREFIXO_FORM}-destino-${d}-ajuda"`))
      expect(h).toContain(`id="${PREFIXO_FORM}-destino-${d}-ajuda"`)
    }
    expect((h.match(/type="radio"/g) ?? []).length).toBe(2)
    // mesmo name: o navegador trata como um grupo (Tab entra uma vez, setas trocam)
    expect(new Set([...h.matchAll(/type="radio"[^>]*name="([^"]+)"/g)].map((m) => m[1])).size).toBe(1)
  })

  it('projeto já com álbum: o rádio "Álbum do projeto" fica desabilitado e explica por quê', () => {
    const h = html({ temAlbumProjeto: true, destino: 'avulso' })
    expect(h).toMatch(/id="criar-album-destino-projeto"[^>]*disabled/)
    expect(h).toContain('Indisponível: este projeto já tem um álbum.')
  })

  it('todo campo de texto tem label associado; o nome só existe no avulso', () => {
    expect(html({ destino: 'projeto' })).not.toContain('id="criar-album-nome"')
    const h = html({ destino: 'avulso' })
    expect(h).toContain('<label for="criar-album-nome"')
    expect(h).toMatch(/id="criar-album-nome"[^>]*type="text"|type="text"[^>]*id="criar-album-nome"/)
  })

  it('formato e orientação aparecem juntos, com label, ajuda ligada por aria-describedby', () => {
    const h = html({ precisaFormato: true })
    expect(h).toContain('<label for="criar-album-formato"')
    expect(h).toContain('<label for="criar-album-orientacao"')
    expect(h).toMatch(/id="criar-album-formato"[^>]*aria-describedby="criar-album-formato-ajuda"/)
    expect(h).toContain('id="criar-album-formato-ajuda"')
    expect(h).toContain('<select id="criar-album-orientacao"')
  })

  it('botões têm nome visível e tamanho mínimo de toque de 44 px; criar é o submit', () => {
    const h = html()
    expect(h).toMatch(/<button id="criar-album-criar" type="submit"[^>]*class="[^"]*min-h-11/)
    expect(h).toMatch(/<button id="criar-album-cancelar" type="button"[^>]*class="[^"]*min-h-11/)
    expect(h).toContain('>Criar álbum</button>')
    expect(h).toContain('>Cancelar</button>')
    expect(h).toMatch(/type="radio"[^>]*class="[^"]*h-5 w-5/)
  })

  it('erro é anunciado (role=alert) e só aparece quando existe', () => {
    expect(html()).not.toContain('role="alert"')
    expect(html({ erro: 'Não foi possível criar o álbum agora.' })).toMatch(/<p role="alert"[^>]*>Não foi possível criar o álbum agora\.<\/p>/)
  })

  it('durante o envio tudo fica desabilitado e o botão informa o andamento', () => {
    const h = html({ ocupado: true, destino: 'avulso', precisaFormato: true })
    expect(h).toContain('Criando…')
    for (const id of ['criar-album-criar', 'criar-album-cancelar', 'criar-album-nome', 'criar-album-formato', 'criar-album-orientacao']) {
      expect(h).toMatch(new RegExp(`id="${id}"[^>]*disabled`))
    }
  })

  it('seleção grande mostra o aviso do orçamento como nota; seleção normal não', () => {
    expect(html({ total: 120 })).not.toContain('role="note"')
    expect(html({ total: 700 })).toMatch(/role="note"[^>]*>Seleção grande \(700 fotos/)
  })
})

describe('formulário "Criar álbum" — teclado e foco', () => {
  it.each([
    [{ destino: 'projeto' as const, precisaFormato: false }],
    [{ destino: 'avulso' as const, precisaFormato: false }],
    [{ destino: 'avulso' as const, precisaFormato: true }],
  ])('a ordem do Tab coincide com a ordem do DOM (%j)', (estado) => {
    const esperados = idsFocaveis(PREFIXO_FORM, estado)
    const h = html({ ...estado, destino: estado.destino, temAlbumProjeto: false })
    // Todos os controles previstos existem; só o rádio marcado está na sequência do Tab (o outro é alcançado por seta).
    expect(idsNaOrdem(h, esperados)).toEqual(esperados)
  })

  it('não usa tabindex positivo nem esconde controles do teclado', () => {
    const h = html({ destino: 'avulso', precisaFormato: true })
    expect(h).not.toMatch(/tabindex="[1-9]/)
    expect(h).not.toMatch(/tabindex="-1"/)
  })

  it('Escape cancela, exceto durante o envio; outras teclas não fazem nada', () => {
    expect(acaoDaTecla('Escape', { ocupado: false })).toBe('cancelar')
    expect(acaoDaTecla('Escape', { ocupado: true })).toBe('nenhuma')
    expect(acaoDaTecla('Enter', { ocupado: false })).toBe('nenhuma')
    expect(acaoDaTecla('Tab', { ocupado: false })).toBe('nenhuma')
  })

  it('o foco entra no destino marcado ao abrir e volta ao gatilho da revisão ao fechar', () => {
    expect(focoInicial(PREFIXO_FORM, 'projeto')).toBe('criar-album-destino-projeto')
    expect(focoInicial(PREFIXO_FORM, 'avulso')).toBe('criar-album-destino-avulso')
    expect(focoAoFechar(PREFIXO_GATILHO, 3)).toBe('criar-album-gatilho-3')
  })

  it('o primeiro item da sequência é sempre o foco inicial', () => {
    for (const destino of ['projeto', 'avulso'] as const) {
      expect(idsFocaveis(PREFIXO_FORM, { destino, precisaFormato: false })[0]).toBe(focoInicial(PREFIXO_FORM, destino))
    }
  })
})
