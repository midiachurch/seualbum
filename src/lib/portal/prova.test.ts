import { describe, expect, it } from 'vitest'
import { comentarioProvaValido, lerContratoProva } from './prova'
const id = '11111111-1111-4111-8111-111111111111'
describe('fronteira da prova guest', () => {
  it('exige lâmina no comentário e permite ajuste geral', () => {
    expect(comentarioProvaValido(id,id,'comentario','Trocar foto',id)).toBe(true)
    expect(comentarioProvaValido(id,null,'comentario','Trocar foto',id)).toBe(false)
    expect(comentarioProvaValido(id,null,'ajustes','Rever capa',id)).toBe(true)
  })
  it('nega aprovação e ações arbitrárias nesta fronteira', () => {
    for (const tipo of ['aprovado','aprovada','pagamento',null,{}]) expect(comentarioProvaValido(id,id,tipo,'Ok',id)).toBe(false)
  })
  it('nega identificadores inválidos e texto vazio ou excessivo', () => {
    for (const texto of ['', '   ', 'a'.repeat(2001), {}, null]) expect(comentarioProvaValido(id,id,'comentario',texto,id)).toBe(false)
    expect(comentarioProvaValido('../outro',id,'comentario','Olá',id)).toBe(false)
    expect(comentarioProvaValido(id,'../outro','comentario','Olá',id)).toBe(false)
    expect(comentarioProvaValido(id,id,'comentario','Olá','retry')).toBe(false)
  })
})

describe('contrato de resposta da prova', () => {
  const contrato = { id, numero: 2, aberta: true, laminas: [{ id, ordem: 1 }], comentarios: [] }
  it('aceita resposta completa descartando campos internos não utilizados', () => {
    expect(lerContratoProva({ ...contrato, storage_path: 'private' })).toEqual(contrato)
  })
  it('nega resposta incompatível antes de chegar à UI', () => {
    for (const v of [null, [], {}, { ...contrato, laminas: null }, { ...contrato, numero: 0 }, { ...contrato, laminas: [{ id: 'bad', ordem: 1 }] }, { ...contrato, laminas: [...contrato.laminas, ...contrato.laminas] }]) expect(lerContratoProva(v)).toBeNull()
  })
  it('nega comentário com horário ou origem inválidos', () => {
    expect(lerContratoProva({ ...contrato, comentarios: [{ id, lamina_id: id, tipo: 'sistema', texto: 'x', data: '2026-11-21' }] })).toBeNull()
    expect(lerContratoProva({ ...contrato, comentarios: [{ id, lamina_id: id, tipo: 'comentario', texto: 'x', data: 'invalid' }] })).toBeNull()
  })
})
