'use client'

import { useRef, useState, useTransition } from 'react'
import { escolherPlanoGaleria } from '@/lib/actions/franquia-galeria'
import { formatarBytes, formatarPrecoMensal, rotuloSituacao } from '@/lib/franquia/formato'
import type { ConsumoFranquiaGaleriaRow } from '@/types/database'

export type PlanoGaleriaOpcao = { slug: string; nome: string; preco_mensal_centavos: number; armazenamento_bytes: number }

export function FranquiaGaleria({ consumo, planos }: { consumo: ConsumoFranquiaGaleriaRow | null; planos: PlanoGaleriaOpcao[] }) {
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  // Uma chave por tentativa de plano: retry da mesma escolha não duplica.
  const chaves = useRef<Record<string, string>>({})
  const percentual = consumo?.percentual ?? null
  const barra = percentual === null ? 0 : Math.min(100, percentual)
  return <section className="space-y-4 rounded-2xl border p-5" aria-label="Armazenamento e plano">
    <div>
      <h2 className="text-xl font-semibold">Armazenamento e plano</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Planos simulados: nenhuma cobrança é feita e nenhum envio é bloqueado. Valores sujeitos a aprovação.
      </p>
    </div>
    {consumo && <div>
      <p className="text-sm" role="status">
        <strong>{rotuloSituacao(consumo.situacao)}</strong>
        {' · '}{formatarBytes(consumo.usado_bytes)}
        {consumo.capacidade_bytes !== null && <> de {formatarBytes(consumo.capacidade_bytes)}</>}
        {percentual !== null && <> ({percentual}%)</>}
      </p>
      {consumo.capacidade_bytes !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Uso da franquia" aria-valuemin={0} aria-valuemax={100} aria-valuenow={barra}>
        <div className="h-full bg-foreground" style={{ width: `${barra}%` }} />
      </div>}
      {consumo.fotos_sem_medicao > 0 && <p className="mt-2 text-xs text-muted-foreground">
        {consumo.fotos_sem_medicao} de {consumo.fotos_total} fotos enviadas antes da medição não entram na soma.
      </p>}
    </div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <ul className="grid gap-3 sm:grid-cols-3">
      {planos.map(plano => {
        const atual = consumo?.plano_slug === plano.slug
        return <li key={plano.slug} className="flex flex-col gap-2 rounded-xl border p-4">
          <p className="font-medium">{plano.nome}</p>
          <p className="text-sm">{formatarPrecoMensal(plano.preco_mensal_centavos)} · {formatarBytes(plano.armazenamento_bytes)}</p>
          <button type="button" disabled={pendente || atual} aria-pressed={atual} className="mt-auto min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
            setErro('')
            const chave = chaves.current[plano.slug] ??= crypto.randomUUID()
            iniciar(async () => {
              const resultado = await escolherPlanoGaleria(chave, plano.slug)
              if (!resultado.ok) setErro(resultado.erro)
              // Sucesso consome a chave: voltar a um plano anterior é uma nova escolha.
              else delete chaves.current[plano.slug]
            })
          }}>{atual ? 'Plano atual' : pendente ? 'Salvando…' : `Escolher ${plano.nome}`}</button>
        </li>
      })}
    </ul>
  </section>
}
