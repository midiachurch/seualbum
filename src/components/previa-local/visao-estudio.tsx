'use client'

/* eslint-disable @next/next/no-img-element -- Fotografias de demonstração servidas do próprio projeto. */
import { useRef, useState, type ElementType } from 'react'
import Link from 'next/link'
import { Aperture, LayoutGrid, Images, CalendarDays, ShoppingBag, Users, Globe, MessageCircle, Settings2, Search, Bell, ChevronDown, PanelLeftClose, Menu, Plus, X, Check, Clock3, Camera, SlidersHorizontal, ExternalLink, CircleHelp, MapPin, CheckCheck, Sparkles, ImagePlus, FileCheck2, CreditCard, FolderOpen } from 'lucide-react'
import s from './visao-estudio.module.css'

type Filtro = 'todas' | 'selecao' | 'aprovacao' | 'entregue'
type Galeria = { id: string; nome: string; cliente: string; imagem: string; fotos: number; status: Exclude<Filtro, 'todas'>; atualizacao: string; progresso: number }
const galerias: Galeria[] = [
  { id: 'editorial', nome: 'Um encontro com o essencial', cliente: 'Ensaio editorial', imagem: '/images/estilos/editorial.webp', fotos: 84, status: 'selecao', atualizacao: 'Hoje, 10:42', progresso: 62 },
  { id: 'casamento', nome: 'O começo de uma história', cliente: 'Casamento · coleção de exemplo', imagem: '/images/estilos/moderno.webp', fotos: 246, status: 'aprovacao', atualizacao: 'Hoje, 09:18', progresso: 85 },
  { id: 'fineart', nome: 'Memórias em luz natural', cliente: 'Bridal · coleção de exemplo', imagem: '/images/estilos/fineart.webp', fotos: 68, status: 'entregue', atualizacao: 'Ontem, 16:30', progresso: 100 },
]
const rotulos: Record<Filtro, string> = { todas: 'Todas', selecao: 'Em seleção', aprovacao: 'Em aprovação', entregue: 'Entregues' }
const links: { grupo: string; itens: [string, string, ElementType, string?][] }[] = [
  { grupo: '', itens: [['Visão geral', '/previa/visao-geral', LayoutGrid], ['Galerias', '/operacao-local', Images], ['Agenda', '/previa/agenda', CalendarDays]] },
  { grupo: 'Seu negócio', itens: [['Clientes e propostas', '/previa/estudio', Users], ['Loja e pedidos', '/previa/loja', ShoppingBag], ['Site e portfólio', '/previa/sites', Globe]] },
  { grupo: 'Colaboração', itens: [['Mensagens', '/previa/estudio?aba=saida', MessageCircle], ['Equipe', '/previa/equipe', Users], ['Editor de álbuns', '/editor-preview', Aperture]] },
]
const atividades = [
  { id: 'selecao', icone: CheckCheck, titulo: 'Uma seleção pronta para você', texto: 'Ensaio editorial · 32 fotos escolhidas', hora: '10:42', cor: 'menta', destino: '/operacao-local', acao: 'Conferir seleção' },
  { id: 'prova', icone: FileCheck2, titulo: 'O álbum está em aprovação', texto: 'Casamento · versão 02 enviada', hora: '09:18', cor: 'rosa', destino: '/operacao-local', acao: 'Acompanhar prova' },
  { id: 'pedido', icone: CreditCard, titulo: 'Uma nova venda na loja', texto: 'Coleção digital · R$ 249,00', hora: 'Ontem', cor: 'lima', destino: '/previa/loja', acao: 'Ver pedido' },
]

export function VisaoEstudio() {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [periodo, setPeriodo] = useState('mes')
  const [menu, setMenu] = useState(false)
  const [notificacoes, setNotificacoes] = useState(false)
  const [lidas, setLidas] = useState(false)
  const [galeria, setGaleria] = useState<Galeria | null>(null)
  const [ordenar, setOrdenar] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const atividadeRef = useRef<HTMLElement>(null)
  const textoBusca = busca.trim().toLocaleLowerCase('pt-BR')
  const lista = galerias.filter(g => (filtro === 'todas' || g.status === filtro) && `${g.nome} ${g.cliente}`.toLocaleLowerCase('pt-BR').includes(textoBusca))
  if (ordenar) lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const abrirGaleria = (g: Galeria) => { setGaleria(g); dialog.current?.showModal() }
  const fecharGaleria = () => { dialog.current?.close(); setGaleria(null) }
  const filtrar = (valor: Filtro) => { setFiltro(valor); document.getElementById('galerias-recentes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return <div className={s.pagina}>
    <a href="#visao-conteudo" className={s.pular}>Pular para o conteúdo</a>
    <div className={s.aplicacao}>
      {menu && <button className={s.sombraMenu} aria-label="Fechar menu" onClick={() => setMenu(false)} />}
      <aside className={`${s.sidebar} ${menu ? s.menuAberto : ''}`} aria-label="Menu principal">
        <Link href="/previa/visao-geral" className={s.marca}><Aperture size={30} strokeWidth={1.6} /><span>seu<span className={s.marcaFina}>álbum</span><small>O SEU ESTÚDIO, CONECTADO.</small></span></Link>
        <div className={s.menuTitulo}><span>Workspace</span><button aria-label="Recolher menu" onClick={() => setMenu(false)} className={s.fecharMenu}><PanelLeftClose size={18} /></button></div>
        <nav>{links.map(grupo => <div key={grupo.grupo} className={s.grupoMenu}>{grupo.grupo && <p>{grupo.grupo}<ChevronDown size={13} /></p>}{grupo.itens.map(([nome, href, Icone, quantidade]) => <Link key={href} href={href} className={`${s.itemMenu} ${nome === 'Visão geral' ? s.ativo : ''}`} aria-current={nome === 'Visão geral' ? 'page' : undefined}><span className={s.iconeMenu}><Icone size={17} strokeWidth={1.7} /></span><span>{nome}</span>{quantidade && <small>{quantidade}</small>}</Link>)}</div>)}</nav>
        <div className={s.sidebarRodape}>
          <div className={s.ajuda}><span className={s.iconeAjuda}><Sparkles size={19} /></span><strong>Mais tempo para criar.</strong><p>Todos os seus projetos.<br />Um só lugar para cuidar.</p><Link href="/previa">Explorar a plataforma<ExternalLink size={13} /></Link></div>
          <div className={s.perfilRodape}><span className={s.avatarPequeno}>ED</span><div><strong>Estúdio demonstração</strong><small>Seu workspace</small></div><Link href="/previa/equipe" aria-label="Configurações da equipe"><Settings2 size={17} /></Link></div>
        </div>
      </aside>

      <div className={s.corpo}>
        <header className={s.topbar}>
          <button className={`${s.botaoIcone} ${s.menuMobile}`} aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu size={21} /></button>
          <label className={s.busca}><Search size={18} /><input aria-label="Buscar galerias" placeholder="Buscar uma galeria, cliente ou projeto..." value={busca} onChange={e => setBusca(e.target.value)} />{busca ? <button aria-label="Limpar busca" onClick={() => setBusca('')}><X size={16} /></button> : <span className={s.buscaAtalho}>Busca</span>}</label>
          <div className={s.topbarDireita}><span className={s.demo}><span />Dados de exemplo</span><Link href="/previa" className={s.botaoAjuda} aria-label="Explorar todas as áreas"><CircleHelp size={19} /></Link><div className={s.notificacoes}><button className={s.botaoIcone} aria-label="Notificações" aria-expanded={notificacoes} onClick={() => setNotificacoes(!notificacoes)}><Bell size={19} />{!lidas && <i />}</button>{notificacoes && <div className={s.popover}><strong>Você está por dentro?</strong><p>{lidas ? 'Todas as atividades foram marcadas como lidas.' : 'Uma seleção, uma prova e um pedido para acompanhar.'}</p><button onClick={() => { setLidas(true); setNotificacoes(false); atividadeRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>Marcar como lidas</button></div>}</div><span className={s.avatarTopo}>ED</span></div>
        </header>

        <main id="visao-conteudo" className={s.conteudo}>
          <div className={s.cabecalho}><div><p>SEU DIA, EM FOCO</p><h1>Visão geral<span>.</span></h1><span>Um olhar sobre tudo o que acontece no seu estúdio.</span></div><Link href="/operacao-local" className={s.botaoPrimario}><Plus size={17} />Abrir galerias</Link></div>
          <div className={s.colunas}>
            <div className={s.principal}>
              <section className={`${s.painel} ${s.estudio}`} aria-labelledby="titulo-estudio">
                <div className={s.estudioCima}><div className={s.avatarEstudio}><Aperture size={57} strokeWidth={1} /><span>EST.</span></div><div className={s.estudioInfo}><span className={s.sobretitulo}>SEU ESPAÇO CRIATIVO</span><h2 id="titulo-estudio">Estúdio demonstração</h2><p>Você cuida do olhar. A gente organiza o resto.</p><div className={s.dadosEstudio}><span><MapPin size={14} />Brasil</span><span><Camera size={14} />Fotografia & histórias</span></div></div><Link href="/previa/equipe" className={s.botaoIcone} aria-label="Ver equipe do estúdio"><Settings2 size={17} /></Link></div>
                <div className={s.numeros}>{[['Galerias no seu estúdio', '24', s.linhaRosa], ['Fotografias compartilhadas', '1.860', s.linhaMenta], ['Histórias entregues', '18', s.linhaLima]].map(([nome, valor, cor]) => <div key={nome}><span>{nome}</span><strong>{valor}</strong><i className={cor} /></div>)}</div>
              </section>

              <section className={`${s.painel} ${s.resumo}`} aria-labelledby="titulo-resumo"><div className={s.tituloSecao}><h2 id="titulo-resumo">O que precisa do seu olhar</h2><label className={s.periodo}><span className="sr-only">Período do resumo</span><select value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="mes">Este mês</option><option value="semana">Esta semana</option></select><ChevronDown size={14} /></label></div><div className={s.resumoCards}>
                {[{ nome: 'Seleções em andamento', nota: 'Clientes escolhendo suas fotos', valor: periodo === 'mes' ? '08' : '03', cor: s.lima, filtro: 'selecao' as const, icone: Images }, { nome: 'Álbuns para aprovar', nota: 'O próximo passo é do cliente', valor: periodo === 'mes' ? '03' : '02', cor: s.menta, filtro: 'aprovacao' as const, icone: FileCheck2 }, { nome: 'Histórias entregues', nota: 'Prontas para serem revividas', valor: periodo === 'mes' ? '12' : '04', cor: s.rosa, filtro: 'entregue' as const, icone: CheckCheck }].map(item => <button key={item.nome} className={`${s.resumoCard} ${item.cor}`} aria-pressed={filtro === item.filtro} onClick={() => filtrar(item.filtro)}><span className={s.resumoCardCima}><strong>{item.nome}</strong><span><item.icone size={17} /></span></span><span className={s.resumoCardBaixo}><small>{item.nota}</small><b>{item.valor}</b></span></button>)}
              </div></section>

              <section className={`${s.painel} ${s.galerias}`} id="galerias-recentes" aria-labelledby="titulo-galerias"><div className={s.tituloSecao}><h2 id="titulo-galerias">Galerias recentes <span>({lista.length})</span></h2><button className={s.botaoIcone} aria-label={ordenar ? 'Ordenar por atualização' : 'Ordenar por nome'} aria-pressed={ordenar} onClick={() => setOrdenar(!ordenar)}><SlidersHorizontal size={17} /></button></div><div className={s.filtros} role="group" aria-label="Filtrar galerias">{(Object.keys(rotulos) as Filtro[]).map(chave => <button key={chave} aria-pressed={filtro === chave} className={filtro === chave ? s.filtroAtivo : ''} onClick={() => setFiltro(chave)}>{rotulos[chave]}</button>)}</div>
                <div className={s.gradeGalerias}>{lista.slice(0, 2).map(g => <button className={s.galeriaCard} key={g.id} onClick={() => abrirGaleria(g)}><span className={s.fotoGaleria}><img src={g.imagem} alt={g.cliente} /><span className={`${s.status} ${g.status === 'selecao' ? s.lima : g.status === 'aprovacao' ? s.rosa : s.menta}`}>{rotulos[g.status]}</span><span className={s.abrirFoto}><ExternalLink size={16} /></span><span className={s.contagemFoto}><Images size={13} />{g.fotos} fotos</span></span><span className={s.galeriaTexto}><small>{g.cliente}</small><strong>{g.nome}</strong><span><Clock3 size={12} />{g.atualizacao}<i>Ver galeria</i></span></span></button>)}</div>
                {!lista.length && <div className={s.vazio}><Search size={25} /><h3>Nenhuma galeria por aqui</h3><p>Tente outro nome ou escolha um status diferente.</p><button onClick={() => { setBusca(''); setFiltro('todas') }}>Limpar filtros</button></div>}
                <Link className={s.linkRodape} href="/operacao-local"><FolderOpen size={16} />{lista.length > 2 ? 'Ver mais na central de galerias' : 'Ir para todas as galerias'}</Link>
              </section>
            </div>

            <aside className={`${s.painel} ${s.atividades}`} aria-labelledby="titulo-atividades" ref={atividadeRef}>
              <div className={s.tituloSecao}><h2 id="titulo-atividades">Acontecendo agora</h2><span className={s.indicadorAtividade} /></div><p className={s.descricaoAtividades}>Os pequenos passos das suas histórias.</p>
              <div className={s.feedDestaque}><div className={s.feedFoto}><img src="/images/estilos/moderno.webp" alt="Casal em um ensaio de casamento" /><span><Check size={12} />Nova seleção</span></div><div className={s.feedDestaqueTexto}><small>HOJE · 10:42</small><h3>O olhar do cliente<br />encontrou suas favoritas.</h3><p>32 fotos escolhidas. Uma nova história pronta para virar álbum.</p><Link href="/operacao-local">Conferir seleção<ExternalLink size={14} /></Link></div></div>
              <div className={s.timeline}>{atividades.map(a => <article key={a.id} className={s.atividade}><div className={`${s.atividadeIcone} ${s[a.cor]}`}><a.icone size={16} /></div><div><div className={s.atividadeHora}><span>{a.hora}</span>{!lidas && <i aria-label="Não lida" />}</div><h3>{a.titulo}</h3><p>{a.texto}</p><Link href={a.destino}>{a.acao}<ExternalLink size={12} /></Link></div></article>)}</div>
              <div className={s.agendamento}><div className={s.agendamentoTitulo}><CalendarDays size={16} /><span>NA SUA AGENDA</span></div><h3>Um novo encontro.</h3><p>Ensaio no estúdio principal</p><div><span><b>24</b>NOV</span><p>Terça-feira<br /><strong>14h às 15h</strong></p><Link href="/previa/agenda" aria-label="Abrir agenda"><ExternalLink size={17} /></Link></div></div>
              <span className={s.avisoFeed}>Prévia de interface · atividades ilustrativas</span>
            </aside>
          </div>
          <footer className={s.rodape}><span>Feito para o seu olhar ir mais longe.</span><span>SeuÁlbum · Prévia do novo workspace</span></footer>
        </main>
      </div>
    </div>
    <dialog ref={dialog} className={s.dialog} onCancel={() => setGaleria(null)} onClick={e => { if (e.target === e.currentTarget) fecharGaleria() }} aria-labelledby="titulo-galeria">
      {galeria && <><div className={s.dialogFoto}><img src={galeria.imagem} alt={galeria.cliente} /><button className={s.botaoIcone} aria-label="Fechar galeria" onClick={fecharGaleria}><X size={20} /></button></div><div className={s.dialogTexto}><span className={s.sobretitulo}>{galeria.cliente}</span><h2 id="titulo-galeria">{galeria.nome}</h2><p>{galeria.fotos} fotografias · {rotulos[galeria.status]}</p><div className={s.progresso}><span>Andamento da coleção <strong>{galeria.progresso}%</strong></span><progress max={100} value={galeria.progresso} /></div><p className={s.avisoDialog}>Coleção ilustrativa deste redesign. Na central de galerias você pode enviar fotos e testar seleção, prova e entrega.</p><Link href="/operacao-local" className={s.botaoPrimario}><ImagePlus size={17} />Abrir central de galerias</Link></div></>}
    </dialog>
  </div>
}
