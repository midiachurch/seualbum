/** Uma fila por gerenciador: lotes novos e retries compartilham o limite. */
export function criarFilaUploadProjeto(limite = 3) {
  if (!Number.isInteger(limite) || limite < 1) throw new Error('Limite de upload inválido.')
  let encerrada = false
  let ativos = 0
  const ids = new Set<string>()
  const pendentes: { id: string; executar: () => Promise<void> }[] = []

  function avancar() {
    while (!encerrada && ativos < limite && pendentes.length) {
      const item = pendentes.shift()!
      ativos++
      // Adia o callback para permitir que o consumidor registre o estado em fila.
      void Promise.resolve().then(() => { if (!encerrada) return item.executar() }).catch(() => {
        // O consumidor apresenta o erro por arquivo. Uma falha libera a vaga.
      }).finally(() => {
        ativos--
        ids.delete(item.id)
        avancar()
      })
    }
  }
  return {
    adicionar(id: string, executar: () => Promise<void>) {
      if (encerrada || ids.has(id)) return false
      ids.add(id)
      pendentes.push({ id, executar })
      avancar()
      return true
    },
    encerrar() {
      encerrada = true
      pendentes.forEach((item) => ids.delete(item.id))
      pendentes.length = 0
      // Não cancela PUTs já iniciados: o contrato atual não tem AbortSignal.
    },
  }
}
