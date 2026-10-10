import { describe, expect, it } from 'vitest'
import { mesclarMensagens, rotuloDoAutor, tituloDaConversa, validarCorpo, type ConversaResumo, type MensagemView } from './mensagens'

const m = (id: string, criadaEm: string, extra: Partial<MensagemView> = {}): MensagemView => ({
  id,
  conversaId: 'c',
  autorId: 'a',
  autorNome: 'Estúdio Um',
  autorPapel: 'fotografo',
  tipo: 'texto',
  corpo: id,
  laminaId: null,
  versaoId: null,
  criadaEm,
  apagada: false,
  ...extra,
})

describe('mensagens (regras puras)', () => {
  it('mescla sem duplicar e em ordem cronológica; evento novo substitui (ex.: apagada)', () => {
    const atuais = [m('b', '2026-10-09T10:02'), m('a', '2026-10-09T10:01')]
    const r = mesclarMensagens(atuais, [m('b', '2026-10-09T10:02', { apagada: true, corpo: '' }), m('c', '2026-10-09T10:03')])
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(r[1].apagada).toBe(true)
  })

  it('valida o corpo', () => {
    expect(validarCorpo('  oi ')).toEqual({ ok: true, corpo: 'oi' })
    expect(validarCorpo('').ok).toBe(false)
    expect(validarCorpo(null).ok).toBe(false)
  })

  it('o cliente vê o estúdio pelo nome do estúdio; a equipe aparece como equipe seualbum', () => {
    expect(rotuloDoAutor({ autorNome: 'Estúdio Um', autorPapel: 'fotografo' }, 'cliente')).toBe('Estúdio Um')
    expect(rotuloDoAutor({ autorNome: 'Olga', autorPapel: 'equipe' }, 'fotografo')).toBe('Equipe seualbum · Olga')
    expect(rotuloDoAutor({ autorNome: 'Olga', autorPapel: 'equipe' }, 'equipe')).toBe('Olga (equipe)')
  })

  it('título do fio por perfil', () => {
    const c: ConversaResumo = {
      id: 'c', canal: 'cliente_estudio', fotografoId: 'f', estudio: 'Estúdio Um', estudioLogoUrl: null,
      projetoId: 'p', projetoNome: 'Casamento', projetoNumero: 1040, clienteNome: 'Ana', ultimaMensagemEm: null,
      ultimaMensagemPrevia: null, naoLidas: 0, criadaEm: '',
    }
    expect(tituloDaConversa(c, 'cliente')).toBe('Estúdio Um · Casamento')
    expect(tituloDaConversa(c, 'fotografo')).toBe('Ana · #1040 Casamento')
    expect(tituloDaConversa({ ...c, canal: 'estudio_equipe', projetoId: null }, 'equipe')).toBe('Estúdio Um · Geral')
  })
})
