import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A CLI do Supabase usa o prefixo de data do arquivo como CHAVE ÚNICA da migration
// (supabase_migrations.schema_migrations.version). Dois arquivos com o mesmo prefixo
// quebram `supabase start`/`db push`, mas passam nos testes SQL (que aplicam por nome).
const pasta = join(process.cwd(), 'supabase', 'migrations')
const arquivos = readdirSync(pasta).filter(f => f.endsWith('.sql')).sort()

describe('versões das migrations', () => {
  it('todo arquivo segue AAAAMMDDHHMMSS_NNNN_nome.sql', () => {
    for (const f of arquivos) expect(f, f).toMatch(/^\d{14}_[0-9a-z]+_[a-z0-9_]+\.sql$/)
  })
  it('o prefixo de versão é único (a CLI o usa como chave primária)', () => {
    const vistos = new Map<string, string>()
    for (const f of arquivos) {
      const v = f.slice(0, 14)
      expect(vistos.get(v), `versão ${v} repetida: ${vistos.get(v)} e ${f}`).toBeUndefined()
      vistos.set(v, f)
    }
  })
  it('a numeração NNNN cresce junto com a versão (a ordem de aplicação não inverte)', () => {
    const numeradas = arquivos.map(f => ({ f, n: Number(f.slice(15, 19)) })).filter(x => Number.isInteger(x.n) && x.n >= 43)
    for (let i = 1; i < numeradas.length; i++) {
      expect(numeradas[i].n, `${numeradas[i - 1].f} antes de ${numeradas[i].f}`).toBeGreaterThanOrEqual(numeradas[i - 1].n)
    }
  })
})
