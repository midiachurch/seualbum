import 'server-only'
import type { AgendaRecursoRow, AgendaReservaRow, EquipeMembroRow, StoreProdutoRow, StorePedidoRow, StudioFunilRow, StudioTarefaListaRow, StudioModeloRow } from '@/types/database'
import type { ConteudoSite } from '@/lib/sites/tipos'

export const org = '10000000-0000-4000-8000-000000000001'
export const dono = '10000000-0000-4000-8000-000000000002'
export const projeto = '10000000-0000-4000-8000-000000000003'
export const data = '2026-11-21T12:00:00Z'
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const membros: EquipeMembroRow[] = [
  { user_id: dono, nome: 'Estúdio demonstração', email: 'estudio@example.invalid', papel: 'dono', status: 'ativo' },
  { user_id: id(2), nome: 'Designer exemplo', email: 'design@example.invalid', papel: 'editor', status: 'ativo' },
  { user_id: id(3), nome: 'Atendimento exemplo', email: 'atendimento@example.invalid', papel: 'admin', status: 'ativo' },
]
export const produtos: StoreProdutoRow[] = [
  { id: id(10), organizacao_id: org, nome: 'Coleção digital completa', descricao: 'Entrega das imagens escolhidas em alta resolução.', tipo: 'colecao_digital', preco_centavos: 24900, comissao_bps: 500, ativo: true, criado_por: dono, created_at: data },
  { id: id(11), organizacao_id: org, nome: 'Foto avulsa', descricao: 'Uma imagem digital.', tipo: 'foto_avulsa', preco_centavos: 2500, comissao_bps: 500, ativo: true, criado_por: dono, created_at: data },
  { id: id(12), organizacao_id: org, nome: 'Impressão 20 × 30', descricao: 'Valor ilustrativo, sem pedido externo.', tipo: 'impressao', preco_centavos: 4900, comissao_bps: 500, ativo: true, criado_por: dono, created_at: data },
]
export const pedidos: StorePedidoRow[] = [{ id: id(13), organizacao_id: org, projeto_id: projeto, chave: 'exemplo-1', comprador_nome: 'Cliente exemplo', comprador_email: 'cliente@example.invalid', contexto: 'venda_estudio', status: 'pago', moeda: 'BRL', total_centavos: 24900, comissao_centavos: 1245, liquido_centavos: 23655, provedor: 'simulado', created_at: data, pago_em: data, encerrado_em: null }]
export const recursos: AgendaRecursoRow[] = [{ id: id(20), organizacao_id: org, nome: 'Estúdio principal', slug: 'estudio-exemplo', tipo: 'espaco', descricao: 'Sessões de retratos e ensaios.', fuso: 'America/Sao_Paulo', duracao_min: 60, buffer_min: 15, intervalo_min: 30, antecedencia_min_min: 120, antecedencia_max_dias: 90, cancelamento_antecedencia_h: 24, sinal_centavos: 10000, publicado: false, ativo: true, created_at: data, updated_at: data }]
export const reservas: AgendaReservaRow[] = [{ id: id(21), organizacao_id: org, recurso_id: recursos[0].id, status: 'confirmada', inicio: '2026-11-24T17:00:00Z', fim: '2026-11-24T18:00:00Z', ocupa_ate: '2026-11-24T18:15:00Z', contato_nome: 'Cliente exemplo', contato_email: 'cliente@example.invalid', contato_telefone: null, expira_em: null, confirmada_em: data, cancelada_em: null, cancelada_por: null, motivo_cancelamento: null, concluida_em: null, cliente_id: null, sinal_centavos: 10000, sinal_status: 'pago', remarcacoes: 0, created_at: data, updated_at: data }]
export const negocios: StudioFunilRow[] = (['lead', 'contato', 'proposta', 'fechado'] as const).map((etapa, i) => ({ id: id(30 + i), cliente_id: id(40 + i), cliente_nome: ['Ensaio de família', 'Retratos profissionais', 'Casamento exemplo', 'Formatura exemplo'][i], cliente_email: 'cliente@example.invalid', cliente_telefone: null, titulo: ['Novo ensaio', 'Sessão corporativa', 'Cobertura de casamento', 'Álbum de formatura'][i], etapa, motivo_perda: null, origem: 'site', valor_estimado: [650, 1200, 4500, 890][i], responsavel_id: dono, responsavel_nome: membros[0].nome, projeto_id: null, projeto_nome: null, orcamento_id: null, etapa_em: data, dias_na_etapa: i + 1, proxima_acao_titulo: 'Retornar contato', proxima_acao_prazo: '2026-11-24T12:00:00Z', tarefas_abertas: 1, tarefas_atrasadas: 0 }))
export const tarefas: StudioTarefaListaRow[] = [{ id: id(50), titulo: 'Enviar proposta do ensaio', descricao: 'Conferir disponibilidade e apresentar as opções.', responsavel_id: dono, responsavel_nome: membros[0].nome, prazo: '2026-11-24T12:00:00Z', prioridade: 'alta', status: 'aberta', cliente_id: negocios[0].cliente_id, cliente_nome: negocios[0].cliente_nome, negocio_id: negocios[0].id, projeto_id: null, orcamento_id: null, atrasada: false, pode_editar: true, concluida_em: null }]
export const modelos: StudioModeloRow[] = [{ id: id(60), organizacao_id: org, nome: 'Retorno de proposta', finalidade: 'followup_proposta', canal: 'email', assunto: 'Vamos conversar sobre seu ensaio?', corpo: 'Olá! Podemos ajudar com os próximos passos do seu projeto.', ativo: true, criado_por: dono, created_at: data, updated_at: data }]
export const conteudo: ConteudoSite = { v: 1, tema: { cor: '#714d38', fonte: 'serif', modo: 'claro' }, seo: { titulo: 'Estúdio demonstração' }, paginas: [{ slug: 'inicio', titulo: 'Início', blocos: [
  { id: 'hero-1', tipo: 'hero', dados: { titulo: 'Histórias que merecem ficar.', subtitulo: 'Retratos, famílias e celebrações. Um portfólio de demonstração.', cta_texto: 'Conheça nossos serviços', cta_url: '#servicos' } },
  { id: 'sobre-1', tipo: 'sobre', dados: { titulo: 'Fotografar é guardar encontros.', html: '<p>Este é um exemplo do site que cada estúdio pode montar com seus próprios textos, serviços e imagens.</p>' } },
  { id: 'servicos', tipo: 'servicos', dados: { titulo: 'Serviços', itens: [{ nome: 'Ensaio de família', descricao: 'Uma hora de sessão e coleção digital.', preco: 'R$ 650 · valor ilustrativo' }, { nome: 'Retratos profissionais', preco: 'R$ 1.200 · valor ilustrativo' }] } },
  { id: 'rodape-1', tipo: 'rodape', dados: { texto: 'Estúdio demonstração · Prévia local' } },
] }] }
export const site = { id: id(70), organizacao_id: org, slug: 'estudio-exemplo', nome: 'Estúdio demonstração', status: 'rascunho' as const, rascunho_rev: 1, versao_publicada_id: null, publicado_em: null }
