import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { FunilStudio } from '@/components/studio/funil-studio'
import { LinhaDoTempo } from '@/components/studio/linha-do-tempo'
import { ModelosStudio } from '@/components/studio/modelos-studio'
import { SaidaStudio } from '@/components/studio/saida-studio'
import { TarefasStudio } from '@/components/studio/tarefas-studio'
import { uuidValido } from '@/lib/portal/segredos'
import { ABAS_ESTUDIO, ABA_ROTULO, FILTROS_TAREFA, type AbaEstudio } from '@/lib/studio/constantes'
import { PAPEIS_EQUIPE } from '@/lib/equipe-papeis'
import { requireUser } from '@/lib/supabase/queries'
import type { StudioFiltroTarefa } from '@/types/database'

export const metadata: Metadata = { title: 'Estúdio' }

type Busca = { aba?: string; org?: string; f?: string; r?: string; c?: string }

/**
 * Estúdio: funil comercial, tarefas, próxima ação, modelos de mensagem com
 * prévia e fila de saída (T01–T04). Etapa comercial é separada da produção do
 * projeto. Nada é enviado: o envio externo está desligado. A permissão real é
 * das RPCs; aqui a tela apenas esconde o que o papel não pode fazer.
 */
export default async function EstudioPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const { user, profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo') notFound()
  const busca = await searchParams
  const aba: AbaEstudio = (ABAS_ESTUDIO as readonly string[]).includes(busca.aba ?? '') ? (busca.aba as AbaEstudio) : 'funil'

  const orgs = supabase ? await supabase.from('organizacoes').select('id,nome,dono_id,created_at').order('created_at') : null
  const lista = [...(orgs?.data ?? [])].sort((a, b) => Number(b.dono_id === user.id) - Number(a.dono_id === user.id))
  const org = lista.find(o => o.id === busca.org) ?? lista[0]

  const cabecalho = <div>
    <h1 className="text-3xl font-semibold">Estúdio</h1>
    <p className="mt-1 text-sm text-muted-foreground">Funil comercial, tarefas e comunicação. A etapa comercial não altera a produção dos seus álbuns.</p>
  </div>
  if (!supabase || orgs?.error || !org) {
    return <main className="space-y-6">{cabecalho}<p role="status" className="text-sm">{orgs?.error ? 'Estúdio temporariamente indisponível.' : 'Seu estúdio ainda não está configurado.'}</p></main>
  }

  const base = `/dashboard/estudio?aba=${aba}${org.id !== lista[0].id ? `&org=${org.id}` : ''}`
  const [papelRes, equipe, funil] = await Promise.all([
    supabase.rpc('papel_na_organizacao', { p_org: org.id }),
    supabase.rpc('listar_equipe_organizacao', { p_org: org.id }),
    supabase.rpc('listar_funil_studio', { p_org: org.id }),
  ])
  const papel = papelRes.data
  if (papelRes.error || !papel || equipe.error || funil.error) {
    return <main className="space-y-6">{cabecalho}<p role="status" className="text-sm">Estúdio temporariamente indisponível.</p></main>
  }
  const membros = equipe.data ?? []
  const negocios = funil.data ?? []
  const clienteAberto = uuidValido(busca.c) ? busca.c : null
  const filtro: StudioFiltroTarefa = (FILTROS_TAREFA as readonly string[]).includes(busca.f ?? '') ? (busca.f as StudioFiltroTarefa) : 'abertas'
  const responsavel = filtro === 'responsavel' && uuidValido(busca.r) ? busca.r : null

  let conteudo: React.ReactNode
  if (aba === 'funil') {
    const tempo = clienteAberto ? await supabase.rpc('linha_do_tempo_studio', { p_org: org.id, p_cliente: clienteAberto, p_limite: 100 }) : null
    const cliente = negocios.find(n => n.cliente_id === clienteAberto)
    conteudo = <div className="space-y-6">
      <FunilStudio organizacaoId={org.id} meuPapel={papel} negocios={negocios} membros={membros} hrefBase={base} clienteAberto={clienteAberto} />
      {tempo && (tempo.error ? <p role="status" className="text-sm">Linha do tempo indisponível.</p>
        : <LinhaDoTempo itens={tempo.data ?? []} titulo={cliente?.cliente_nome ?? 'cliente'} />)}
    </div>
  } else if (aba === 'tarefas') {
    const tarefas = await supabase.rpc('listar_tarefas_studio', { p_org: org.id, p_filtro: filtro === 'responsavel' && !responsavel ? 'abertas' : filtro, p_responsavel: responsavel })
    const unicos = [...new Map(negocios.map(n => [n.cliente_id, { cliente_id: n.cliente_id, cliente_nome: n.cliente_nome }])).values()]
    conteudo = tarefas.error ? <p role="status" className="text-sm">Tarefas temporariamente indisponíveis.</p>
      : <TarefasStudio organizacaoId={org.id} meuPapel={papel} tarefas={tarefas.data ?? []} membros={membros} clientes={unicos} filtro={filtro} responsavelFiltro={responsavel} hrefBase={base} />
  } else if (aba === 'modelos') {
    const modelos = await supabase.from('studio_modelos').select('*').order('created_at', { ascending: false })
    conteudo = modelos.error ? <p role="status" className="text-sm">Modelos temporariamente indisponíveis.</p>
      : <ModelosStudio organizacaoId={org.id} meuPapel={papel} modelos={(modelos.data ?? []).filter(m => m.organizacao_id === org.id)} negocios={negocios} />
  } else {
    const [itens, config] = await Promise.all([
      supabase.rpc('listar_outbox_studio', { p_org: org.id, p_limite: 100 }),
      supabase.from('studio_configuracao').select('followup_dias').eq('organizacao_id', org.id).maybeSingle(),
    ])
    conteudo = itens.error ? <p role="status" className="text-sm">Fila temporariamente indisponível.</p>
      : <SaidaStudio organizacaoId={org.id} meuPapel={papel} itens={itens.data ?? []} followupDias={config.data?.followup_dias ?? 3} />
  }

  const hrefAba = (a: AbaEstudio) => `/dashboard/estudio?aba=${a}${org.id !== lista[0].id ? `&org=${org.id}` : ''}`
  return <main className="space-y-6">
    {cabecalho}
    <p className="text-sm text-muted-foreground">{org.nome} · seu papel: {PAPEIS_EQUIPE[papel].rotulo}</p>
    {lista.length > 1 && <nav aria-label="Organizações" className="flex flex-wrap gap-2">
      {lista.map(o => <Link key={o.id} href={`/dashboard/estudio?aba=${aba}&org=${o.id}`} aria-current={o.id === org.id ? 'page' : undefined}
        className={`min-h-11 content-center rounded-full border px-4 text-sm ${o.id === org.id ? 'bg-[#171717] text-white' : ''}`}>{o.nome}</Link>)}
    </nav>}
    <nav aria-label="Seções do Estúdio" className="flex flex-wrap gap-2">
      {ABAS_ESTUDIO.map(a => <Link key={a} href={hrefAba(a)} aria-current={a === aba ? 'page' : undefined}
        className={`min-h-11 content-center rounded-full border px-4 text-sm ${a === aba ? 'bg-[#171717] text-white' : ''}`}>{ABA_ROTULO[a]}</Link>)}
    </nav>
    <p className="text-sm text-muted-foreground">
      Atalhos: <Link href="/dashboard/orcamentos" className="underline">orçamentos</Link> · <Link href="/dashboard/mensagens" className="underline">mensagens</Link>
    </p>
    {conteudo}
  </main>
}
