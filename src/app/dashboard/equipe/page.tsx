import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/queries'
import { EquipeEstudio } from '@/components/dashboard/equipe-estudio'
import { PAPEIS_EQUIPE } from '@/lib/equipe-papeis'

export default async function EquipePage() {
  const { user, profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo') notFound()
  const organizacoes = supabase ? await supabase.from('organizacoes').select('id,nome,dono_id,created_at').order('created_at') : null
  const lista = organizacoes?.data ?? []
  const equipes = supabase ? await Promise.all(lista.map(async o => ({
    org: o,
    papel: await supabase.rpc('papel_na_organizacao', { p_org: o.id }),
    membros: await supabase.rpc('listar_equipe_organizacao', { p_org: o.id }),
    convites: await supabase.from('convites_organizacao').select('id,organizacao_id,email,papel,criado_por,status,aceito_por,aceito_em,expira_em,created_at').eq('organizacao_id', o.id).eq('status', 'pendente').gt('expira_em', new Date().toISOString()).order('created_at', { ascending: false }),
  }))) : []
  return <main className="space-y-6">
    <div>
      <h1 className="text-3xl font-semibold">Equipe</h1>
      <p className="mt-1 text-sm text-muted-foreground">Quem trabalha com você no estúdio. {PAPEIS_EQUIPE.editor.rotulo}es produzem; {PAPEIS_EQUIPE.visualizador.rotulo.toLowerCase()}es só leem.</p>
    </div>
    {organizacoes?.error ? <p role="status" className="text-sm">Equipe temporariamente indisponível.</p>
      : !lista.length ? <p className="text-sm text-muted-foreground">Seu estúdio ainda não tem equipe cadastrada.</p>
      : equipes.map(({ org, papel, membros, convites }) => papel.error || membros.error || !papel.data
        ? <p key={org.id} role="status" className="text-sm">Equipe de {org.nome} temporariamente indisponível.</p>
        : <EquipeEstudio key={org.id} organizacaoId={org.id} nome={org.nome} meuPapel={papel.data} meuId={user.id} membros={membros.data ?? []} convites={convites.data ?? []} />)}
  </main>
}
