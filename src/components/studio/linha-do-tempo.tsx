import { TIPO_LINHA_TEMPO_ROTULO, formatarDataHora } from '@/lib/studio/constantes'
import type { StudioLinhaTempoRow } from '@/types/database'

/** Linha do tempo única do cliente: mensagens, funil, tarefas, orçamento e comunicação (simulada). */
export function LinhaDoTempo({ itens, titulo }: { itens: StudioLinhaTempoRow[]; titulo: string }) {
  return <section className="space-y-3 rounded-2xl border p-5" aria-label={`Linha do tempo de ${titulo}`}>
    <h3 className="text-lg font-semibold">Linha do tempo · {titulo}</h3>
    {!itens.length ? <p className="text-sm text-muted-foreground">Nada registrado ainda para este cliente.</p>
      : <ol className="space-y-3">
        {itens.map(i => <li key={`${i.tipo}-${i.ref_id}`} className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">{TIPO_LINHA_TEMPO_ROTULO[i.tipo] ?? i.tipo} · {formatarDataHora(i.ocorrido_em)}</p>
          <p className="text-sm font-medium">{i.titulo}</p>
          {i.detalhe && <p className="text-sm text-muted-foreground">{i.detalhe}</p>}
        </li>)}
      </ol>}
  </section>
}
