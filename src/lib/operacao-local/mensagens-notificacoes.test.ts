import { describe, expect, it } from 'vitest'
import { aplicarComando, criarEstadoInicial } from './modelo'
import { validarEstadoLocal } from './repositorio'

describe('conversa e avisos de atividades locais', () => {
  const comando = { tipo: 'enviar_mensagem' as const, galeriaId: 'galeria-ensaio', autor: 'cliente' as const, texto: 'Pode revisar a capa?', chave: 'mensagem-1' }
  it('conserva origem, data e texto; retry não duplica mensagem ou notificação', () => {
    const original = criarEstadoInicial()
    const estado = aplicarComando(original, comando)
    expect(original.mensagens).toBeUndefined()
    expect(estado.mensagens).toHaveLength(1)
    expect(estado.mensagens![0]).toMatchObject({ galeriaId: comando.galeriaId, autor: 'cliente', texto: comando.texto })
    expect(estado.notificacoes).toHaveLength(1)
    expect(estado.notificacoes![0].criadaEm).toBe(estado.atividades[0].criadaEm)
    expect(aplicarComando(estado, comando)).toBe(estado)
    expect(validarEstadoLocal(estado)).toBe(true)
    expect(() => aplicarComando(estado, { ...comando, texto: 'Outro texto' })).toThrow('outro conteúdo')
  })
  it('revogação e vínculo da galeria são checados no comando', () => {
    const estado = aplicarComando(criarEstadoInicial(), { tipo: 'alterar_acesso', galeriaId: comando.galeriaId, ativo: false })
    expect(() => aplicarComando(estado, comando)).toThrow('indisponível')
    expect(() => aplicarComando(estado, { ...comando, galeriaId: 'outra' })).toThrow('indisponível')
    expect(() => aplicarComando(estado, comando, 'outro-estudio')).toThrow('Estúdio inválido')
    expect(aplicarComando(estado, { ...comando, autor: 'fotografo' }).mensagens).toHaveLength(1)
  })
  it('marcar leitura não emite outro aviso e preserva primeira data', () => {
    let estado = aplicarComando(criarEstadoInicial(), comando)
    const id = estado.notificacoes![0].id
    estado = aplicarComando(estado, { tipo: 'ler_notificacao', id })
    const data = estado.notificacoes![0].lidaEm
    expect(data).toBeTruthy()
    const repetido = aplicarComando(estado, { tipo: 'ler_notificacao', id })
    expect(repetido.notificacoes).toHaveLength(1)
    expect(repetido.notificacoes![0].lidaEm).toBe(data)
    expect(validarEstadoLocal(repetido)).toBe(true)
  })
  it('não aceita notificações desligadas do histórico nem mensagens cruzadas em disco', () => {
    const estado = aplicarComando(criarEstadoInicial(), comando)
    estado.notificacoes![0].atividadeId = 'inexistente'
    expect(validarEstadoLocal(estado)).toBe(false)
    const outro = aplicarComando(criarEstadoInicial(), comando)
    outro.mensagens![0].galeriaId = 'inexistente'
    expect(validarEstadoLocal(outro)).toBe(false)
  })
})
