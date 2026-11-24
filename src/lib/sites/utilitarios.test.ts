import { describe, expect, it } from 'vitest'
import { chaveEhMidiaDaOrganizacao, chaveMidiaSite, validarPedidoMidiaSite } from './chaves'
import { contraste, paletaDoSite } from './cores'
import { mensagemDeErroSite } from './erros'
import { baseAbsoluta, gerarRobotsTxt, gerarSitemapXml, hrefsDoSite, metadadosDaPagina } from './seo'
import { htmlParaTexto, textoParaHtml } from './texto-rico'
import { sanitizarHtmlSite } from './sanitizar'
import { conteudoInicial, TIPOS_BLOCO, blocoVazio } from './tipos'
import { validarConteudoSite } from './validar'

const ORG = 'c1000000-0000-4000-8000-000000000001'
const OUTRA = 'c2000000-0000-4000-8000-000000000002'
const ARQ = '11111111-1111-4111-8111-111111111111'

describe('chaves de mídia pública do site', () => {
  it('gera chave na pasta da organização e só reconhece a própria pasta', () => {
    const k = chaveMidiaSite({ organizacaoId: ORG, idArquivo: ARQ, nome: 'Foto Ç.jpg' })
    expect(k).toBe(`sites/${ORG}/${ARQ}-Foto_C.jpg`)
    expect(chaveEhMidiaDaOrganizacao(k, ORG)).toBe(true)
    expect(chaveEhMidiaDaOrganizacao(k, OUTRA)).toBe(false)
  })
  it.each([`projetos/${ORG}/fotos/${ARQ}-x.jpg`, `pedidos/u/c/${ARQ}-x.jpg`, `sites/${ORG}/../x/${ARQ}-a.jpg`, `sites/${ORG}/a.jpg`, null, 5])('recusa chave privada/malformada %s', (k) => {
    expect(chaveEhMidiaDaOrganizacao(k, ORG)).toBe(false)
  })
  it('valida o pedido de envio (tipo, tamanho e identificadores)', () => {
    const base = { organizacaoId: ORG, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 1000 }
    expect(validarPedidoMidiaSite(base).ok).toBe(true)
    expect(validarPedidoMidiaSite({ ...base, tipo: 'image/svg+xml' }).ok).toBe(false)
    expect(validarPedidoMidiaSite({ ...base, tipo: 'text/html' }).ok).toBe(false)
    expect(validarPedidoMidiaSite({ ...base, tamanho: 11 * 1024 * 1024 }).ok).toBe(false)
    expect(validarPedidoMidiaSite({ ...base, organizacaoId: 'x' }).ok).toBe(false)
  })
})

describe('contraste do tema', () => {
  it('calcula razões conhecidas', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })
  it('escolhe texto legível sobre a cor de destaque e nunca usa destaque ilegível como texto', () => {
    const amarelo = paletaDoSite('#ffee00', 'claro')
    expect(amarelo.textoSobreAcento).toBe('#000000')
    expect(amarelo.acentoNoTexto).toBe(amarelo.texto) // amarelo sobre branco não passa 4,5:1
    const azul = paletaDoSite('#1d4ed8', 'claro')
    expect(azul.textoSobreAcento).toBe('#ffffff')
    expect(contraste(azul.acentoNoTexto, azul.fundo)).toBeGreaterThanOrEqual(4.5)
    expect(paletaDoSite('#1d4ed8', 'escuro').fundo).toBe('#111111')
  })
  it('cor inválida cai no padrão em vez de gerar CSS inválido', () => {
    expect(paletaDoSite('red;background:url(x)', 'claro').acento).toBe('#1f2937')
  })
})

describe('SEO: sitemap, robots, canonical e metadados', () => {
  const paginas = [{ slug: 'inicio', titulo: 'Início', blocos: [] }, { slug: 'servicos', titulo: 'Serviços & Preços', blocos: [] }]
  it('sitemap lista só as páginas do site com a raiz do próprio site', () => {
    const x = gerarSitemapXml('https://fotos.exemplo.com.br/', paginas, '2026-11-22T10:00:00Z')
    expect(x).toContain('<loc>https://fotos.exemplo.com.br</loc>')
    expect(x).toContain('<loc>https://fotos.exemplo.com.br/servicos</loc>')
    expect(x).toContain('<lastmod>2026-11-22T10:00:00.000Z</lastmod>')
    expect(gerarSitemapXml('https://app.exemplo.com/s/a&b', paginas, 'x')).toContain('a&amp;b')
  })
  it('robots aponta para o sitemap do mesmo site', () => {
    expect(gerarRobotsTxt('https://x.com.br')).toBe('User-agent: *\nAllow: /\nSitemap: https://x.com.br/sitemap.xml\n')
    expect(gerarRobotsTxt(null)).toBe('User-agent: *\nAllow: /\n')
  })
  it('canonical prefere o domínio ativo; senão usa NEXT_PUBLIC_SITE_URL + /s/{slug}', () => {
    expect(baseAbsoluta({ slug: 'a', dominio: 'fotos.exemplo.com.br' }, {})).toBe('https://fotos.exemplo.com.br')
    expect(baseAbsoluta({ slug: 'a', dominio: null }, { NEXT_PUBLIC_SITE_URL: 'https://app.seualbum.com.br/' })).toBe('https://app.seualbum.com.br/s/a')
    expect(baseAbsoluta({ slug: 'a', dominio: null }, {})).toBeNull()
    expect(baseAbsoluta({ slug: 'a', dominio: null }, { NEXT_PUBLIC_SITE_URL: 'não é url' })).toBeNull()
  })
  it('links internos dependem do modo de acesso', () => {
    expect(hrefsDoSite('a', paginas, 'plataforma')).toEqual({ inicio: '/s/a', servicos: '/s/a/servicos' })
    expect(hrefsDoSite('a', paginas, 'host')).toEqual({ inicio: '/', servicos: '/servicos' })
  })
  it('título e descrição seguem a página e o SEO do site', () => {
    const site = { nome: 'Luz', conteudo: { v: 1 as const, seo: { titulo: 'Luz Fotografia', descricao: 'Casamentos' }, paginas } }
    expect(metadadosDaPagina(site, 'inicio')).toMatchObject({ titulo: 'Luz Fotografia', descricao: 'Casamentos' })
    expect(metadadosDaPagina(site, 'servicos')?.titulo).toBe('Serviços & Preços · Luz')
    expect(metadadosDaPagina(site, 'nao-existe')).toBeNull()
  })
})

describe('texto simples → HTML restrito', () => {
  it('converte marcações e escapa HTML digitado', () => {
    expect(textoParaHtml('Olá **mundo** e *você*\n\n- um\n- dois\n\n## Título\n\n[site](https://a.com.br)')).toBe(
      '<p>Olá <strong>mundo</strong> e <em>você</em></p><ul><li>um</li><li>dois</li></ul><h2>Título</h2><p><a href="https://a.com.br">site</a></p>')
    expect(textoParaHtml('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })
  it('não cria link com esquema perigoso', () => {
    expect(textoParaHtml('[x](javascript:alert(1))')).not.toContain('<a')
  })
  it('ida e volta preserva o texto', () => {
    const t = 'Primeiro **forte**\n\n- a\n- b\n\n[link](https://x.com)'
    expect(htmlParaTexto(textoParaHtml(t))).toBe(t)
  })
  it('o HTML gerado sobrevive à sanitização sem perda', () => {
    const h = textoParaHtml('Oi **x** [l](https://a.com)\n\n- i')
    expect(sanitizarHtmlSite(h)).toContain('<strong>x</strong>')
    expect(sanitizarHtmlSite(h)).toContain('href="https://a.com"')
  })
})

describe('mensagens de erro e modelos', () => {
  it('não vaza erro interno do banco', () => {
    expect(mensagemDeErroSite({ code: 'XX000', message: 'relation "sites" does not exist' }, 'Falhou.')).toBe('Falhou.')
    expect(mensagemDeErroSite({ code: '22023', message: 'invalid input syntax for type uuid: "x"' }, 'Falhou.')).toBe('Falhou.')
    expect(mensagemDeErroSite({ code: '22023', message: 'Endereço indisponível.' }, 'Falhou.')).toBe('Endereço indisponível.')
    expect(mensagemDeErroSite({ code: '42501', message: 'Sem permissão.' }, 'Falhou.')).toBe('Você não tem permissão para esta ação.')
    expect(mensagemDeErroSite(null, 'Falhou.')).toBe('Falhou.')
  })
  it('todo bloco novo criado pelo editor é válido ou só falha por conteúdo a preencher', () => {
    for (const tipo of TIPOS_BLOCO) {
      const c = conteudoInicial('Estúdio')
      c.paginas[0].blocos.push(blocoVazio(tipo))
      const r = validarConteudoSite(c)
      // galeria vazia e contato sem canal exigem preenchimento; os demais já nascem válidos
      expect(r.ok).toBe(tipo !== 'galeria' && tipo !== 'contato')
    }
  })
})
