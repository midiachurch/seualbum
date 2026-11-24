import 'server-only'

import { Resolver } from 'node:dns/promises'
import type { ResolvedorDns } from './dominio'

/**
 * Resolver real (Node). Só roda no servidor, em produção; os testes injetam um
 * mock. Timeout curto e sem novas tentativas: a tela permite repetir.
 */
export function resolvedorDnsNode(): ResolvedorDns {
  return {
    async resolverTxt(nome) {
      const r = new Resolver({ timeout: 4000, tries: 1 })
      return r.resolveTxt(nome)
    },
  }
}
