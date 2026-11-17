import { describe, expect, it, vi } from 'vitest'
import { criarFilaUploadProjeto } from './fila-upload-projeto'

const turno = () => new Promise((resolve) => setTimeout(resolve, 0))
function tarefa() {
  let concluir!: () => void
  let falhar!: () => void
  const promise = new Promise<void>((resolve, reject) => { concluir = resolve; falhar = () => reject(new Error('falha sintética')) })
  const executar = vi.fn(() => promise)
  return { executar, concluir, falhar }
}

describe('fila única de upload por gerenciador', () => {
  it('limita três execuções mesmo quando chegam novos lotes', async () => {
    const fila = criarFilaUploadProjeto()
    const jobs = Array.from({ length: 8 }, tarefa)
    jobs.slice(0, 5).forEach((j, i) => fila.adicionar(`${i}`, j.executar))
    await turno()
    expect(jobs.map((j) => j.executar.mock.calls.length)).toEqual([1, 1, 1, 0, 0, 0, 0, 0])
    jobs.slice(5).forEach((j, i) => fila.adicionar(`${i + 5}`, j.executar))
    jobs[1].concluir()
    await turno()
    expect(jobs[3].executar).toHaveBeenCalledOnce()
    expect(jobs[4].executar).not.toHaveBeenCalled()
    jobs.forEach((j) => j.concluir())
    await turno()
    expect(jobs.every((j) => j.executar.mock.calls.length === 1)).toBe(true)
  })
  it('rejeita clique duplicado e falha libera vaga para próximo arquivo', async () => {
    const fila = criarFilaUploadProjeto(1)
    const primeiro = tarefa(), segundo = tarefa()
    expect(fila.adicionar('a', primeiro.executar)).toBe(true)
    expect(fila.adicionar('a', primeiro.executar)).toBe(false)
    fila.adicionar('b', segundo.executar)
    await turno()
    primeiro.falhar()
    await turno()
    expect(segundo.executar).toHaveBeenCalledOnce()
    segundo.concluir()
    await turno()
    expect(fila.adicionar('a', async () => {})).toBe(true)
  })
  it('retry reusa a mesma operação e respeita uploads em andamento', async () => {
    const fila = criarFilaUploadProjeto(1)
    const executar = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(undefined)
    fila.adicionar('repetir', executar)
    await turno()
    const outro = tarefa()
    fila.adicionar('outro', outro.executar)
    fila.adicionar('repetir', executar)
    await turno()
    expect(executar).toHaveBeenCalledTimes(1)
    outro.concluir()
    await turno()
    expect(executar).toHaveBeenCalledTimes(2)
  })
  it('desmontagem descarta fila e não começa mais chamadas após upload ativo', async () => {
    const fila = criarFilaUploadProjeto(1)
    const a = tarefa(), b = tarefa(), c = tarefa()
    fila.adicionar('a', a.executar)
    fila.adicionar('b', b.executar)
    await turno()
    fila.encerrar()
    a.concluir()
    await turno()
    expect(b.executar).not.toHaveBeenCalled()
    expect(fila.adicionar('c', c.executar)).toBe(false)
  })
  it('não dispara tarefa agendada se desmontar antes de iniciar', async () => {
    const fila = criarFilaUploadProjeto()
    const executar = vi.fn(async () => {})
    fila.adicionar('a', executar)
    fila.encerrar()
    await turno()
    expect(executar).not.toHaveBeenCalled()
  })
})
