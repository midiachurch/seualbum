import { notFound } from 'next/navigation'
import Link from 'next/link'
import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import * as dados from '@/lib/previa-local/dados'
import { StoreEstudio } from '@/components/dashboard/store-estudio'
import { AgendaEstudio } from '@/components/dashboard/agenda-estudio'
import { EquipeEstudio } from '@/components/dashboard/equipe-estudio'
import { SiteEditor } from '@/components/dashboard/site-editor'
import { FunilStudio } from '@/components/studio/funil-studio'
import { TarefasStudio } from '@/components/studio/tarefas-studio'
import { ModelosStudio } from '@/components/studio/modelos-studio'
import { SaidaStudio } from '@/components/studio/saida-studio'
import { LinhaDoTempo } from '@/components/studio/linha-do-tempo'
import { BlocosDaPagina, SiteShell } from '@/components/sites/site-render'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'
import { WorkspaceHeader, WorkspaceIndicadores } from '@/components/workspace/workspace-header'

const areas = [
  ['Novo design · Visão geral', '/previa/visao-geral', 'Explore a proposta visual inspirada na referência: busca, indicadores, galerias e atividades.'],
  ['Galerias e operação', '/operacao-local', 'Crie galerias, envie fotos, selecione, revise provas, simule compras e assinaturas. Dados salvos neste navegador.'],
  ['Painel do fotógrafo', '/previa/abrir?area=fotografo', 'Álbuns, pedidos, aprovação, cobranças e configurações com dados de exemplo.'],
  ['Administração', '/previa/abrir?area=admin', 'Gestão de projetos, clientes, fotógrafos, equipe e produção.'],
  ['Portal do cliente', '/previa/abrir?area=cliente', 'A experiência do cliente final com álbuns de demonstração.'],
  ['Editor de álbuns', '/editor-preview', 'Experimente a composição das páginas, fotos, textos e layouts.'],
  ['Fila de design', '/previa/abrir?area=designer', 'Workspace de diagramação e acompanhamento da produção.'],
  ['Loja', '/previa/loja', 'Catálogo, preços, produtos nas galerias e pedidos simulados.'],
  ['Agenda', '/previa/agenda', 'Reservas, recursos, disponibilidade e sinal simulado.'],
  ['Estúdio', '/previa/estudio', 'Funil comercial, tarefas, modelos de mensagem e fila de comunicação.'],
  ['Equipe', '/previa/equipe', 'Membros, papéis e convites da organização.'],
  ['Construtor de sites', '/previa/sites', 'Editor de blocos, páginas, tema, mídia e publicação.'],
  ['Site do estúdio', '/previa/portfolio', 'Visualização pública de um site montado com os blocos do construtor.'],
  ['Site da plataforma', '/', 'A apresentação comercial do SeuÁlbum.'],
] as const
const titulos: Record<string, string> = { loja: 'Loja', agenda: 'Agenda', estudio: 'Estúdio', equipe: 'Equipe', sites: 'Construtor de sites', portfolio: 'Site do estúdio' }
const descricoes: Record<string, string> = {
  loja: 'Suas fotografias também abrem novas possibilidades. Cuide dos produtos, pedidos e entregas em um só lugar.',
  agenda: 'Mais espaço para os encontros. Organize suas sessões, recursos e horários disponíveis.',
  estudio: 'Do primeiro contato à próxima história. Acompanhe clientes, propostas e as tarefas do seu estúdio.',
  equipe: 'Cada pessoa com seu espaço para criar. Organize os acessos e convide quem trabalha com você.',
  sites: 'Seu olhar merece uma vitrine. Crie as páginas, escolha o conteúdo e prepare seu portfólio.',
}

export default async function PreviaPage({ params, searchParams }: {
  params: Promise<{ caminho?: string[] }>; searchParams: Promise<{ aba?: string; c?: string; f?: string }>
}) {
  if (!previaLocalAtiva()) notFound()
  const { caminho = [] } = await params
  const { aba = 'funil', c, f } = await searchParams
  const modulo = caminho[0] ?? ''
  if (caminho.length > 1 || (modulo && !Object.hasOwn(titulos, modulo))) notFound()
  let tela: React.ReactNode = null
  if (modulo === 'loja') tela = <StoreEstudio organizacaoId={dados.org} nome="Estúdio demonstração" papel="dono" produtos={dados.produtos} projetos={[{ id: dados.projeto, nome: 'Ensaio de família' }]} vinculos={[`${dados.projeto}:${dados.produtos[0].id}`]} pedidos={dados.pedidos} divergencias={[]} />
  if (modulo === 'agenda') tela = <AgendaEstudio organizacaoId={dados.org} nome="Estúdio demonstração" meuPapel="dono" recursos={dados.recursos} reservas={dados.reservas} disponibilidade={[{ id: 'exemplo-horario', recurso_id: dados.recursos[0].id, dia_semana: 2, inicio: '09:00', fim: '18:00' }]} bloqueios={[]} />
  if (modulo === 'equipe') tela = <EquipeEstudio organizacaoId={dados.org} nome="Estúdio demonstração" meuPapel="dono" meuId={dados.dono} membros={dados.membros} convites={[]} />
  if (modulo === 'sites') tela = <SiteEditor nomeOrganizacao="Estúdio demonstração" meuPapel="dono" site={dados.site} rascunho={dados.conteudo} versoes={[]} dominios={[]} eventos={[]} midias={[]} hrefPrevia="/previa/portfolio" />
  if (modulo === 'portfolio') tela = <SiteShell nome="Estúdio demonstração" conteudo={dados.conteudo} hrefs={{ inicio: '/previa/portfolio' }} paginaAtual="inicio"><BlocosDaPagina pagina={dados.conteudo.paginas[0]} midias={{}} /></SiteShell>
  if (modulo === 'estudio') tela = <div className="space-y-6">
    <nav aria-label="Áreas do estúdio" className="flex flex-wrap gap-2">{[['funil', 'Funil'], ['tarefas', 'Tarefas'], ['modelos', 'Modelos'], ['saida', 'Comunicação']].map(([chave, titulo]) => <a key={chave} href={`/previa/estudio?aba=${chave}`} aria-current={aba === chave ? 'page' : undefined} className={`rounded-lg border px-4 py-3 text-sm ${aba === chave ? 'bg-foreground text-background' : ''}`}>{titulo}</a>)}</nav>
    {aba === 'funil' && <><FunilStudio organizacaoId={dados.org} meuPapel="dono" negocios={dados.negocios} membros={dados.membros} hrefBase="/previa/estudio?aba=funil" clienteAberto={c ?? null} />{dados.negocios.some(n => n.cliente_id === c) && <LinhaDoTempo titulo="Cliente exemplo" itens={[{ ocorrido_em: dados.data, tipo: 'etapa', titulo: 'Contato recebido pelo site', detalhe: 'Evento fictício para explorar a linha do tempo.', ref_id: c! }]} />}</>}
    {aba === 'tarefas' && <TarefasStudio organizacaoId={dados.org} meuPapel="dono" tarefas={['concluidas', 'atrasadas', 'hoje'].includes(f ?? '') ? [] : dados.tarefas} membros={dados.membros} clientes={dados.negocios} filtro={f === 'concluidas' || f === 'atrasadas' || f === 'hoje' || f === 'minhas' || f === 'todas' ? f : 'abertas'} responsavelFiltro={null} hrefBase="/previa/estudio?aba=tarefas" />}
    {aba === 'modelos' && <ModelosStudio organizacaoId={dados.org} meuPapel="dono" modelos={dados.modelos} negocios={dados.negocios} />}
    {aba === 'saida' && <SaidaStudio organizacaoId={dados.org} meuPapel="dono" itens={[]} followupDias={3} />}
  </div>
  if (modulo === 'portfolio') return <><div className="bg-[#eff2f5] px-6 py-3 text-sm"><Link href="/previa/sites">Voltar ao construtor de sites</Link></div>{tela}</>
  const indicadores = modulo === 'loja' ? [{ nome: 'Produtos no catálogo', valor: dados.produtos.length }, { nome: 'Pedidos pagos', valor: dados.pedidos.filter(p => p.status === 'pago').length }, { nome: 'Vendas simuladas', valor: 'R$ 249,00' }]
    : modulo === 'agenda' ? [{ nome: 'Reservas confirmadas', valor: dados.reservas.filter(r => r.status === 'confirmada').length }, { nome: 'Recursos disponíveis', valor: dados.recursos.length }, { nome: 'Próxima sessão', valor: '24 nov', detalhe: 'Estúdio principal · 14h' }]
    : modulo === 'estudio' ? [{ nome: 'Histórias em negociação', valor: dados.negocios.filter(n => n.etapa !== 'fechado').length }, { nome: 'Propostas enviadas', valor: dados.negocios.filter(n => n.etapa === 'proposta').length }, { nome: 'Tarefas em aberto', valor: dados.tarefas.length }]
    : modulo === 'equipe' ? [{ nome: 'Pessoas na equipe', valor: dados.membros.length }, { nome: 'Convites pendentes', valor: 0 }, { nome: 'Seu papel', valor: 'Proprietário' }]
    : modulo === 'sites' ? [{ nome: 'Páginas criadas', valor: dados.conteudo.paginas.length }, { nome: 'Blocos de conteúdo', valor: dados.conteudo.paginas.reduce((n, p) => n + p.blocos.length, 0) }, { nome: 'Status do site', valor: 'Rascunho' }] : []
  return <WorkspaceShell previaDisponivel area="previa" nome="Estúdio demonstração" demonstracao><div className="space-y-7">
    <WorkspaceHeader titulo={modulo ? titulos[modulo] : 'Explore o seu workspace'} descricao={modulo ? descricoes[modulo] : 'Um espaço para cada parte do seu trabalho. Entre nas áreas abaixo, sem usuário ou senha, para conhecer a plataforma.'} acao={modulo === 'sites' ? { nome: 'Ver site de exemplo', href: '/previa/portfolio' } : undefined} />
    {modulo && <div className="rounded-2xl border bg-white/40 px-4 py-3 text-xs text-muted-foreground">Demonstração com dados fictícios. As alterações deste módulo não são gravadas. Para testar os fluxos com persistência no navegador, <Link href="/operacao-local" className="font-medium underline">abra Galerias e operação</Link>.</div>}
    {indicadores.length > 0 && <WorkspaceIndicadores itens={indicadores} />}
    {modulo ? tela : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{areas.map(([titulo, href, descricao], i) => <a key={href} href={href} className={`group space-y-3 rounded-2xl border p-6 transition hover:border-foreground ${i === 0 ? 'bg-[#def4ad] sm:col-span-2' : 'bg-card'}`}><h2 className="text-lg font-medium">{titulo}</h2><p className="text-sm leading-6 text-muted-foreground">{descricao}</p></a>)}</div>}
  </div></WorkspaceShell>
}
