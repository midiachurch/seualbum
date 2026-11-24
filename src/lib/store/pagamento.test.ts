import { describe, expect, it } from 'vitest'
import { adaptadorSimulado, pagamentoSimuladoPermitido } from './pagamento'

describe('pagamento simulado da Store', () => {
  it('falha fechado sem a flag, em qualquer ambiente', () => {
    expect(pagamentoSimuladoPermitido({})).toBe(false)
    expect(pagamentoSimuladoPermitido({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(pagamentoSimuladoPermitido({ SEUALBUM_STORE_PAGAMENTO_SIMULADO: '0' })).toBe(false)
    expect(pagamentoSimuladoPermitido({ SEUALBUM_STORE_PAGAMENTO_SIMULADO: 'true' })).toBe(false)
  })
  it('com a flag, funciona em dev e preview', () => {
    expect(pagamentoSimuladoPermitido({ SEUALBUM_STORE_PAGAMENTO_SIMULADO: '1' })).toBe(true)
    expect(pagamentoSimuladoPermitido({ SEUALBUM_STORE_PAGAMENTO_SIMULADO: '1', VERCEL_ENV: 'preview' })).toBe(true)
  })
  it('em produção nunca, nem com a flag: venda simulada não pode parecer real', () => {
    expect(pagamentoSimuladoPermitido({ SEUALBUM_STORE_PAGAMENTO_SIMULADO: '1', VERCEL_ENV: 'production' })).toBe(false)
  })
  it('o adaptador devolve o valor do pedido e um id de evento estável por chamada', async () => {
    let n = 0
    const a = adaptadorSimulado(() => `id${++n}`)
    expect(await a.iniciar({ id: 'p', totalCentavos: 9900 }, 'pago')).toEqual({ provedor: 'simulado', eventoId: 'sim_id1', tipo: 'pago', valorCentavos: 9900 })
    expect((await a.iniciar({ id: 'p', totalCentavos: 100 }, 'recusado')).tipo).toBe('recusado')
    expect(a.provedor).toBe('simulado')
  })
})
