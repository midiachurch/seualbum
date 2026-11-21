import { describe, expect, it, vi } from 'vitest'
import { chaveValida, mensagemDeErro, normalizarPrazo } from './erros'
import { renderizarPrevia, variaveisDoTexto, variaveisValidas, VALORES_EXEMPLO } from './modelos'
import { adaptadorRegistro, processarFila, type AdaptadorEnvio, type ClienteFila } from './outbox'
import { podeEscreverEstudio, podeGerirEstudio } from './constantes'

const item = { id: 'i1', canal: 'email' as const, destinatario: 'a@example.invalid', assunto: 's', corpo: 'c', tentativas: 1 }

function fila(reservados: unknown[], conclusao: (args: Record<string, unknown>) => unknown) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) =>
    fn === 'reservar_outbox_studio' ? { data: reservados, error: null } : { data: conclusao(args), error: null })
  return { cliente: { rpc } as unknown as ClienteFila, rpc }
}

describe('variáveis de modelos', () => {
  it('lista fechada: aceita conhecidas e recusa o resto, como o banco', () => {
    expect(variaveisValidas('Olá {{cliente_nome}} e {{ valor }}')).toBe(true)
    expect(variaveisValidas('{{senha}}')).toBe(false)
    expect(variaveisValidas('{{ cliente nome }}')).toBe(false)
    expect(variaveisValidas('chave solta }}')).toBe(false)
    expect(variaveisValidas('texto simples')).toBe(true)
  })
  it('extrai variáveis sem repetir', () => {
    expect(variaveisDoTexto('{{valor}} {{ valor }} {{estudio}}')).toEqual(['valor', 'estudio'])
  })
  it('prévia preenche, marca o que falta e não interpreta $ nem barras', () => {
    expect(renderizarPrevia('Oi {{cliente_nome}}', { cliente_nome: 'Ana $& \\1' })).toEqual({ texto: 'Oi Ana $& \\1', faltando: [] })
    expect(renderizarPrevia('{{valor}} {{projeto}} {{projeto}}', { valor: 'R$ 1,00' })).toEqual({ texto: 'R$ 1,00 [projeto] [projeto]', faltando: ['projeto'] })
    expect(renderizarPrevia('{{cliente_primeiro_nome}}', VALORES_EXEMPLO).faltando).toEqual([])
  })
})

describe('erros sem vazamento', () => {
  it('repassa só mensagens conhecidas', () => {
    expect(mensagemDeErro({ code: '22023', message: 'Tarefa já encerrada.' }, 'padrão')).toBe('Tarefa já encerrada.')
    expect(mensagemDeErro({ code: '22023', message: 'syntax error at or near' }, 'padrão')).toBe('padrão')
    expect(mensagemDeErro({ code: '42501', message: 'x' }, 'padrão')).toBe('Você não tem permissão para esta ação.')
    expect(mensagemDeErro({ code: 'XX000', message: 'boom' }, 'padrão')).toBe('padrão')
    expect(mensagemDeErro(null, 'padrão')).toBe('padrão')
  })
  it('chave de idempotência e prazo', () => {
    expect(chaveValida('abc-12345')).toBe(true)
    expect(chaveValida('curta')).toBe(false)
    expect(chaveValida('com espaço aqui')).toBe(false)
    expect(normalizarPrazo('')).toBeNull()
    expect(normalizarPrazo('lixo')).toBeUndefined()
    expect(normalizarPrazo('2026-11-30')).toBe('2026-12-01T02:59:00.000Z')
  })
})

describe('permissões espelhadas na UI', () => {
  it('visualizador só lê; editor escreve mas não gere', () => {
    expect([podeEscreverEstudio('visualizador'), podeEscreverEstudio('editor'), podeGerirEstudio('editor'), podeGerirEstudio('admin'), podeEscreverEstudio(null)])
      .toEqual([false, true, false, true, false])
  })
})

describe('processamento da fila com adaptador injetável', () => {
  it('registro não envia nada: devolve sucesso simulado', async () => {
    expect(await adaptadorRegistro.enviar(item)).toEqual({ ok: true, simulada: true })
  })
  it('sucesso conclui como simulado, informando o adaptador registro', async () => {
    const { cliente, rpc } = fila([item], () => 'enviada')
    expect(await processarFila(cliente, 'org', adaptadorRegistro)).toEqual({ reservadas: 1, simuladas: 1, falhas: 0, ignoradas: 0 })
    expect(rpc).toHaveBeenLastCalledWith('concluir_outbox_studio', { p_id: 'i1', p_ok: true, p_adaptador: 'registro', p_erro: null })
  })
  it('falha do adaptador vira retry (nunca sucesso) e a exceção não vaza', async () => {
    const quebrado: AdaptadorEnvio = { nome: 'registro', enviar: async () => { throw new Error('segredo do provedor') } }
    const { cliente, rpc } = fila([item], () => 'pendente')
    expect(await processarFila(cliente, 'org', quebrado)).toEqual({ reservadas: 1, simuladas: 0, falhas: 1, ignoradas: 0 })
    const args = rpc.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(args.p_ok).toBe(false)
    expect(JSON.stringify(args)).not.toContain('segredo')
  })
  it('conclusão repetida (retry de rede) é ignorada pelo banco e não conta como envio', async () => {
    const { cliente } = fila([item], () => 'cancelada')
    expect(await processarFila(cliente, 'org')).toEqual({ reservadas: 1, simuladas: 0, falhas: 0, ignoradas: 1 })
  })
  it('sem itens prontos não chama o adaptador', async () => {
    const enviar = vi.fn()
    const { cliente } = fila([], () => 'enviada')
    expect(await processarFila(cliente, 'org', { nome: 'registro', enviar })).toEqual({ reservadas: 0, simuladas: 0, falhas: 0, ignoradas: 0 })
    expect(enviar).not.toHaveBeenCalled()
  })
  it('erro ao reservar interrompe sem mensagem interna', async () => {
    const cliente = { rpc: async () => ({ data: null, error: { message: 'detalhe' } }) } as unknown as ClienteFila
    await expect(processarFila(cliente, 'org')).rejects.toThrow('reserva_falhou')
  })
})
