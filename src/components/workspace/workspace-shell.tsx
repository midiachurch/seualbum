'use client'

import { Suspense, useState, type ReactNode, type ComponentProps } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Aperture, LayoutGrid, Images, CalendarDays, ShoppingBag, Users, Globe, MessageCircle, Search, Menu, X, LogOut, Camera, BookOpen, Plus, Package, Truck, ListTodo, FileText, SlidersHorizontal, Layers, CircleHelp, Command, ChevronDown, ExternalLink } from 'lucide-react'
import { SeloNaoLidas } from '@/components/mensagens/selo-nao-lidas'
import { PLATFORM_ROLE_LABEL, type PlatformRole } from '@/types/platform'
import { itemWorkspaceAtivo, navegacaoWorkspace, type AreaWorkspace, type ItemWorkspace } from './navegacao'
import { Bricolage_Grotesque } from 'next/font/google'
import s from './workspace.module.css'

// Fonte de títulos e números do workspace; o corpo segue na fonte da marca.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' })

const icones = { visao: LayoutGrid, galerias: Images, agenda: CalendarDays, loja: ShoppingBag, clientes: Users, equipe: Users, site: Globe, mensagens: MessageCircle, albuns: BookOpen, novo: Plus, camera: Camera, catalogo: Layers, estudio: SlidersHorizontal, pedidos: Package, design: Aperture, producao: Package, entregas: Truck, tarefas: ListTodo, modelos: FileText }
const areas: Record<AreaWorkspace, string> = { fotografo: 'Seu estúdio', admin: 'Operação', cliente: 'Suas histórias', previa: 'Seu estúdio', local: 'Galerias e operação', editor: 'Seu espaço criativo' }
function WorkspaceShellContent({ children, area, role, nome = 'Seu estúdio', demonstracao = false, acaoLocal, aoNavegarLocal, ferramentas = false, suporteHref, previaDisponivel = false }: {
  children: ReactNode; area: AreaWorkspace; role?: PlatformRole | null; nome?: string; demonstracao?: boolean;
  acaoLocal?: string; aoNavegarLocal?: (acao: string) => void; ferramentas?: boolean; suporteHref?: string; previaDisponivel?: boolean;
}) {
  const pathname = usePathname()
  const [menu, setMenu] = useState(false)
  const [busca, setBusca] = useState('')
  const query = useSearchParams().toString()
  const itens = [...navegacaoWorkspace(area, role, previaDisponivel)]
  if (suporteHref) itens.push({ nome: 'Falar com o estúdio', href: suporteHref, icone: 'mensagens', grupo: 'Atendimento' })
  const ativo = itemWorkspaceAtivo(itens, pathname, query, acaoLocal)
  const grupos = [...new Set(itens.map(i => i.grupo))]
  const encontrados = busca.trim() ? itens.filter(i => i.nome.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(busca.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, ''))) : []
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const mensagens = itens.find(i => i.icone === 'mensagens')
  const telaDeFerramentas = ferramentas || /\/editor(?:\/|$)|\/admin\/albuns\/[^/]+$/.test(pathname)
  const navegar = (i: ItemWorkspace) => { setMenu(false); setBusca(''); if (i.acao && aoNavegarLocal) aoNavegarLocal(i.acao) }
  const linkItem = (i: ItemWorkspace, resultado = false) => {
    const Icone = icones[i.icone as keyof typeof icones] ?? Layers
    const conteudo = <><span className={s.icone}><Icone size={17} strokeWidth={1.65} /></span><span>{i.nome}</span>{i.icone === 'mensagens' && !demonstracao && <SeloNaoLidas invertido={ativo?.href === i.href} />}</>
    const props = { className: `${s.item} ${!resultado && ativo?.href === i.href ? s.itemAtivo : ''}`, 'aria-current': !resultado && ativo?.href === i.href ? 'page' as const : undefined }
    if (i.href.startsWith('https://')) return <a key={i.href} href={i.href} {...props} target="_blank" rel="noopener noreferrer" onClick={() => navegar(i)}>{conteudo}</a>
    return i.acao && aoNavegarLocal ? <button key={i.href} type="button" {...props} onClick={() => navegar(i)}>{conteudo}</button> : <Link key={i.href} prefetch={false} href={i.href} {...props} onClick={() => navegar(i)}>{conteudo}</Link>
  }
  return <div className={`${display.variable} ${s.workspace} ${telaDeFerramentas ? s.ferramentas : ''}`} data-workspace={area}>
    <a href="#workspace-conteudo" className={s.pular}>Pular para o conteúdo</a>
    {menu && <button className={s.overlay} aria-label="Fechar menu" onClick={() => setMenu(false)} />}
    <aside id="workspace-menu" className={`${s.sidebar} ${menu ? s.sidebarAberta : ''}`} aria-label="Menu principal">
      <Link href={itens[0]?.href ?? '/previa'} className={s.marca}><Aperture size={29} strokeWidth={1.5} /><span>seu<b>álbum</b><small>O SEU ESTÚDIO, CONECTADO.</small></span></Link>
      <div className={s.rotuloMenu}><span>{areas[area]}</span><button className={s.fecharMenu} aria-label="Recolher menu" onClick={() => setMenu(false)}><X size={18} /></button></div>
      <nav aria-label={area === 'admin' ? 'Admin' : area === 'cliente' ? 'Navegação do cliente' : 'Painel'}>{grupos.map(grupo => <div key={grupo} className={s.grupo}>{grupo !== 'Workspace' && <p>{grupo}<ChevronDown size={12} /></p>}{itens.filter(i => i.grupo === grupo).map(i => linkItem(i))}</div>)}</nav>
      <div className={s.sidebarFim}><p className={s.assinatura}>Seu trabalho,<br /><strong>em movimento.</strong></p>{previaDisponivel && <Link href="/previa" className={s.explorar}>Explorar todas as áreas<ExternalLink size={13} /></Link>}<div className={s.perfil}><span className={s.avatar}>{iniciais || 'SA'}</span><div><strong>{nome}</strong><small>{role ? PLATFORM_ROLE_LABEL[role] : demonstracao ? 'Ambiente de demonstração' : areas[area]}</small></div>{!['previa', 'local', 'editor'].includes(area) && <form action="/auth/signout" method="post"><button aria-label="Sair da conta" title="Sair da conta"><LogOut size={17} /></button></form>}</div></div>
    </aside>
    <div className={s.corpo}>
      <header className={s.topbar}><button className={s.abrirMenu} aria-label="Abrir menu" aria-expanded={menu} aria-controls="workspace-menu" onClick={() => setMenu(true)}><Menu size={21} /></button><div className={s.buscaContainer}><label className={s.busca}><Search size={18} /><input aria-label="Buscar uma área do painel" placeholder="Buscar uma área do painel..." value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca('') }} />{busca ? <button aria-label="Limpar busca do painel" onClick={() => setBusca('')}><X size={16} /></button> : <Command size={14} className={s.atalho} />}</label>{busca.trim() && <div className={s.resultados} aria-label="Resultados de busca"><p>Áreas do painel</p>{encontrados.length ? encontrados.map(i => linkItem(i, true)) : <div className={s.semResultado}>Nenhuma área encontrada. Tente “galerias”, “loja” ou “mensagens”.</div>}</div>}</div><div className={s.acoesTopo}><span className={s.ambiente}>{demonstracao ? 'Demonstração local' : areas[area]}</span>{previaDisponivel && <Link href="/previa" className={s.acaoIcone} aria-label="Explorar todas as áreas"><CircleHelp size={19} /></Link>}{mensagens && <Link href={mensagens.href} prefetch={false} className={s.acaoIcone} aria-label="Abrir mensagens"><MessageCircle size={19} />{!demonstracao && <SeloNaoLidas className="absolute -right-1 -top-1" />}</Link>}<span className={s.avatar} title={nome}>{iniciais || 'SA'}</span></div></header>
      <div className={s.trilha}><span>{areas[area]}</span><span>/</span><strong>{ativo?.nome ?? 'Detalhes do projeto'}</strong></div>
      <main id="workspace-conteudo" data-ferramentas={telaDeFerramentas || undefined} className={`${s.conteudo} ${area === 'cliente' ? s.conteudoCliente : ''}`}>{children}</main>
      {!telaDeFerramentas && <footer className={s.rodape}><span>Feito para o seu olhar ir mais longe.</span><span>SeuÁlbum{demonstracao ? ' · Ambiente local' : ''}</span></footer>}
    </div>
  </div>
}

export function WorkspaceShell(props: ComponentProps<typeof WorkspaceShellContent>) {
  return <Suspense fallback={<div className={s.workspace}><div /><div className={s.corpo}>{props.children}</div></div>}><WorkspaceShellContent {...props} /></Suspense>
}
