import { describe, expect, it } from 'vitest'
import { chaveFotoPedido, lerChaveFotoPedido, lerExifConfirmacao, nomeSeguro, validarPedidoDeEnvio } from './chaves'

const USER = '11111111-1111-4111-8111-111111111111'
const CHAVE = '22222222-2222-4222-8222-222222222222'
const ARQ = '33333333-3333-4333-8333-333333333333'

describe('nomeSeguro', () => {
  it('tira acentos e símbolos', () => {
    expect(nomeSeguro('Casamento João & Ana (1).JPG')).toBe('Casamento_Joao_Ana_1_.JPG')
  })
  it('nunca devolve vazio', () => {
    expect(nomeSeguro('')).toBe('foto')
  })
})

describe('chaveFotoPedido / lerChaveFotoPedido', () => {
  const key = chaveFotoPedido({ userId: USER, chave: CHAVE, idArquivo: ARQ, nome: 'Foto Ç.jpg' })

  it('monta a chave na pasta do rascunho', () => {
    expect(key).toBe(`pedidos/${USER}/${CHAVE}/${ARQ}-Foto_C.jpg`)
  })
  it('aceita a chave do próprio usuário', () => {
    expect(lerChaveFotoPedido(key, USER)).toEqual({ chave: CHAVE })
  })
  it('recusa chave de outro usuário', () => {
    expect(lerChaveFotoPedido(key, '99999999-9999-4999-8999-999999999999')).toBeNull()
  })
  it('recusa path traversal e formatos estranhos', () => {
    expect(lerChaveFotoPedido(`pedidos/${USER}/${CHAVE}/../x.jpg`, USER)).toBeNull()
    expect(lerChaveFotoPedido(`pedidos/${USER}/${CHAVE}/sub/${ARQ}-a.jpg`, USER)).toBeNull()
    expect(lerChaveFotoPedido(`outros/${USER}/${CHAVE}/${ARQ}-a.jpg`, USER)).toBeNull()
    expect(lerChaveFotoPedido(123, USER)).toBeNull()
  })
})

describe('validarPedidoDeEnvio', () => {
  const base = { chave: CHAVE, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 1000 }

  it('aceita uma foto válida', () => {
    expect(validarPedidoDeEnvio(base)).toEqual({ ok: true, dados: base })
  })
  it('recusa formato fora da lista', () => {
    expect(validarPedidoDeEnvio({ ...base, tipo: 'application/pdf' }).ok).toBe(false)
  })
  it('recusa acima de 50 MB', () => {
    expect(validarPedidoDeEnvio({ ...base, tamanho: 50 * 1024 * 1024 + 1 }).ok).toBe(false)
  })
  it('recusa chave de rascunho inválida e corpo vazio', () => {
    expect(validarPedidoDeEnvio({ ...base, chave: 'x' }).ok).toBe(false)
    expect(validarPedidoDeEnvio(null).ok).toBe(false)
  })
})

describe('lerExifConfirmacao', () => {
  it('aceita data no formato do EXIF e corta a câmera em 80', () => {
    expect(lerExifConfirmacao({ capturadaEm: '2026-05-01T18:30:00', camera: ` ${'x'.repeat(100)} ` })).toEqual({
      capturada_em: '2026-05-01T18:30:00',
      camera: 'x'.repeat(80),
    })
  })
  it('descarta formatos estranhos', () => {
    expect(lerExifConfirmacao({ capturadaEm: '01/05/2026', camera: '  ' })).toEqual({ capturada_em: null, camera: null })
    expect(lerExifConfirmacao(null)).toEqual({ capturada_em: null, camera: null })
  })
})
