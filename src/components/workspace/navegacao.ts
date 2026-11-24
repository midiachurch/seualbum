import { canAccess, type ModuleKey, type PlatformRole } from '@/types/platform'

export type AreaWorkspace = 'fotografo' | 'admin' | 'cliente' | 'previa' | 'local' | 'editor'
export type ItemWorkspace = { nome: string; href: string; icone: string; grupo: string; modulo?: ModuleKey; acao?: string }
const item = (nome: string, href: string, icone: string, grupo = 'Workspace', modulo?: ModuleKey): ItemWorkspace => ({ nome, href, icone, grupo, modulo })
const fotografo = [
  item('Visão geral', '/dashboard', 'visao'), item('Galerias digitais', '/dashboard/galerias', 'galerias'),
  item('Meus álbuns', '/dashboard/meus-albuns', 'albuns'), item('Novo pedido', '/dashboard/novo-pedido', 'novo'),
  item('Orçamentos', '/dashboard/orcamentos', 'clientes', 'Seu negócio'), item('Agenda', '/dashboard/agenda', 'agenda', 'Seu negócio'),
  item('Estúdio', '/dashboard/estudio', 'estudio', 'Seu negócio'), item('Loja', '/dashboard/store', 'loja', 'Seu negócio'),
  item('Site e portfólio', '/dashboard/site', 'site', 'Seu negócio'), item('Catálogo', '/dashboard/catalogo', 'catalogo', 'Seu negócio'),
  item('Mensagens', '/dashboard/mensagens', 'mensagens', 'Colaboração'), item('Equipe', '/dashboard/equipe', 'equipe', 'Colaboração'),
]
const admin = [
  item('Visão geral', '/admin', 'visao', 'Workspace', 'dashboard'), item('Projetos', '/admin/projetos', 'galerias', 'Workspace', 'projetos'),
  item('Pedidos', '/admin/pedidos', 'pedidos', 'Workspace', 'projetos'), item('Clientes', '/admin/clientes', 'clientes', 'Workspace', 'clientes'),
  item('Fotógrafos', '/admin/fotografos', 'camera', 'Workspace', 'fotografos'),
  item('Fila de design', '/admin/design', 'design', 'Produção', 'design'), item('Álbuns e editor', '/admin/albuns', 'albuns', 'Produção', 'design'),
  item('Diagramação', '/admin/diagramacao', 'estudio', 'Produção', 'projetos'), item('Produção', '/admin/producao', 'producao', 'Produção', 'projetos'),
  item('Expedição', '/admin/producao/grafica', 'entregas', 'Produção', 'projetos'),
  item('Mensagens', '/admin/mensagens', 'mensagens', 'Colaboração', 'mensagens'), item('Equipe', '/admin/equipe', 'equipe', 'Colaboração', 'equipe'),
  item('Biblioteca de mídia', '/admin/midia', 'galerias', 'Conteúdo e loja', 'midia'), item('Banners', '/admin/vitrine/banners', 'site', 'Conteúdo e loja', 'vitrine'),
  item('Portfólio', '/admin/vitrine/portfolio', 'camera', 'Conteúdo e loja', 'vitrine'), item('Páginas do site', '/admin/vitrine/paginas', 'site', 'Conteúdo e loja', 'vitrine'),
  item('Catálogo de álbuns', '/admin/catalogo', 'catalogo', 'Conteúdo e loja', 'vitrine'), item('Adicionais', '/admin/catalogo/adicionais', 'novo', 'Conteúdo e loja', 'vitrine'),
]
const previa = [
  item('Visão geral', '/previa/visao-geral', 'visao'), item('Galerias e eventos', '/operacao-local', 'galerias'),
  item('Agenda', '/previa/agenda', 'agenda', 'Seu negócio'), item('Clientes e propostas', '/previa/estudio', 'clientes', 'Seu negócio'),
  item('Loja e pedidos', '/previa/loja', 'loja', 'Seu negócio'), item('Site e portfólio', '/previa/sites', 'site', 'Seu negócio'),
  item('Tarefas', '/previa/estudio?aba=tarefas', 'tarefas', 'Colaboração'), item('Modelos de mensagem', '/previa/estudio?aba=modelos', 'modelos', 'Colaboração'),
  item('Comunicação', '/previa/estudio?aba=saida', 'mensagens', 'Colaboração'), item('Equipe', '/previa/equipe', 'equipe', 'Colaboração'),
  item('Editor de álbuns', '/editor-preview', 'albuns', 'Criação'), item('Todas as áreas', '/previa', 'catalogo', 'Criação'),
]
export function navegacaoWorkspace(area: AreaWorkspace, role?: PlatformRole | null, previaDisponivel = true): ItemWorkspace[] {
  if (area === 'admin') return admin.filter(i => role && i.modulo && canAccess(role, i.modulo)
    && (role !== 'designer' || ['/admin/design', '/admin/albuns'].includes(i.href)))
  if (area === 'fotografo') return fotografo
  if (area === 'cliente') return [item('Meus álbuns', '/cliente', 'albuns'), item('Mensagens', '/cliente/mensagens', 'mensagens')]
  if (area === 'local') return [item('Visão geral', '/previa/visao-geral', 'visao'), ...[
    ['galerias', 'Galerias', 'galerias'], ['eventos', 'Eventos', 'agenda'], ['catalogo', 'Catálogo', 'catalogo'], ['operacao', 'Operação', 'estudio'],
  ].map(([acao, nome, icone]) => ({ nome, href: `/operacao-local?area=${acao}`, icone, grupo: 'Operação local', acao })), ...previa.filter(i => ['Agenda', 'Equipe', 'Site e portfólio', 'Editor de álbuns', 'Todas as áreas'].includes(i.nome))].filter(i => previaDisponivel || !i.href.startsWith('/previa'))
  if (area === 'editor' && !previaDisponivel) return [item('Editor de álbuns', '/editor-preview', 'albuns'), item('Conhecer a plataforma', '/', 'site')]
  return previa
}

export function itemWorkspaceAtivo(itens: ItemWorkspace[], pathname: string, query: string, acao?: string) {
  const candidatos = itens.filter(i => {
    if (acao && i.acao) return i.acao === acao
    const [caminho, busca] = i.href.split('?')
    if (busca) return pathname === caminho && new URLSearchParams(busca).get('aba') === new URLSearchParams(query).get('aba')
    if (['/dashboard', '/admin', '/cliente', '/previa', '/previa/visao-geral'].includes(caminho)) return pathname === caminho
    if (caminho === '/dashboard/meus-albuns' && pathname.startsWith('/dashboard/albuns/')) return true
    return pathname === caminho || pathname.startsWith(caminho + '/')
  })
  return candidatos.sort((a, b) => b.href.length - a.href.length)[0]
}
