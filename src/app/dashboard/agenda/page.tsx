import { notFound } from 'next/navigation'
import { AgendaEstudio } from '@/components/dashboard/agenda-estudio'
import { COLUNAS_RECURSO, COLUNAS_RESERVA, dataIsoHaDias } from '@/lib/agenda/colunas'
import { requireUser } from '@/lib/supabase/queries'

export default async function AgendaPage() {
  const { profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo') notFound()
  const organizacoes = supabase ? await supabase.from('organizacoes').select('id,nome,dono_id,created_at').order('created_at') : null
  const lista = organizacoes?.data ?? []
  const desde = dataIsoHaDias(30)
  const agendas = supabase ? await Promise.all(lista.map(async o => {
    const [papel, recursos, reservas] = await Promise.all([
      supabase.rpc('papel_na_organizacao', { p_org: o.id }),
      supabase.from('agenda_recursos').select(COLUNAS_RECURSO).eq('organizacao_id', o.id).eq('ativo', true).order('nome'),
      supabase.from('agenda_reservas').select(COLUNAS_RESERVA).eq('organizacao_id', o.id).gte('inicio', desde).order('inicio', { ascending: true }).limit(300),
    ])
    const ids = (recursos.data ?? []).map(r => r.id)
    const [disp, bloqueios] = ids.length ? await Promise.all([
      supabase.from('agenda_disponibilidade').select('id,recurso_id,dia_semana,inicio,fim').in('recurso_id', ids).order('dia_semana').order('inicio'),
      supabase.from('agenda_bloqueios').select('id,recurso_id,periodo,motivo,criado_por,created_at').in('recurso_id', ids).order('created_at', { ascending: false }).limit(200),
    ]) : [null, null]
    return { org: o, papel, recursos, reservas, disp, bloqueios }
  })) : []
  return <main className="space-y-6">
    <div>
      <h1 className="text-3xl font-semibold">Agenda</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recursos, horários e reservas. Seus clientes reservam pela página pública de cada recurso publicado.</p>
    </div>
    {organizacoes?.error ? <p role="status" className="text-sm">Agenda temporariamente indisponível.</p>
      : !lista.length ? <p className="text-sm text-muted-foreground">Seu estúdio ainda não está configurado para usar a agenda.</p>
      : agendas.map(({ org, papel, recursos, reservas, disp, bloqueios }) => papel.error || recursos.error || reservas.error || !papel.data
        ? <p key={org.id} role="status" className="text-sm">A agenda de {org.nome} está temporariamente indisponível.</p>
        : <AgendaEstudio key={org.id} organizacaoId={org.id} nome={org.nome} meuPapel={papel.data}
            recursos={recursos.data ?? []} reservas={reservas.data ?? []} disponibilidade={disp?.data ?? []} bloqueios={bloqueios?.data ?? []} />)}
  </main>
}
