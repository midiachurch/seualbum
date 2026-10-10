import { describe, expect, it } from 'vitest'
import {
  descreverPrazo,
  diaDoPrazo,
  filtrarItens,
  formatarHoras,
  linkEditor,
  linkProva,
  linkPublicarAprovacao,
  ordenarPorUrgencia,
  origemDoItem,
  prazoDoDia,
  semMigracaoDiagramacao,
  validarItens,
  type DiagramacaoItemRow,
} from './regras'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const A1 = '33333333-3333-4333-8333-333333333333'
const D1 = '44444444-4444-4444-8444-444444444444'

function item(p: Partial<DiagramacaoItemRow>): DiagramacaoItemRow {
  return {
    tipo: 'projeto',
    id: P1,
    projeto_id: P1,
    layout_id: null,
    numero: 1040,
    nome: 'Casamento Ana',
    status: 'em_diagramacao',
    etapa: 'em_diagramacao',
    responsavel_id: null,
    responsavel_nome: null,
    fotografo_id: null,
    estudio: 'Estúdio Luz',
    cliente_nome: null,
    prazo: '2026-10-20T02:59:00.000Z',
    prazo_cliente: null,
    prioridade: 'normal',
    em_espera: false,
    em_espera_motivo: null,
    em_espera_desde: null,
    versao_atual: null,
    versao_status: null,
    apontamentos_abertos: 0,
    aprovacao_token: null,
    aprovacao_status: null,
    aprovado_em: null,
    ultima_atividade: null,
    created_at: '2026-10-01T00:00:00.000Z',
    atrasado: false,
    cliente_atrasado: false,
    ...p,
  }
}

describe('links do centro de controle', () => {
  it('projeto abre o editor do projeto e a prova da esteira só com versão', () => {
    const p = item({})
    expect(linkEditor(p)).toBe(`/admin/projetos/${P1}/editor`)
    expect(linkProva(p)).toBeNull()
    expect(linkProva(item({ versao_atual: 2 }))).toBe(`/admin/projetos/${P1}/prova`)
    expect(linkPublicarAprovacao(p)).toBeNull()
  })

  it('avulso abre o editor do álbum; a prova é o link sem login; sem link, publica pelo editor', () => {
    const a = item({ tipo: 'avulso', id: A1, layout_id: A1, projeto_id: null })
    expect(linkEditor(a)).toBe(`/admin/albuns/${A1}`)
    expect(linkProva(a)).toBeNull()
    expect(linkPublicarAprovacao(a)).toBe(`/admin/albuns/${A1}?abrir=compartilhar`)
    expect(linkProva({ ...a, aprovacao_token: 'abc' })).toBe('/album/abc')
  })

  it('origem: estúdio do projeto ou cliente do avulso', () => {
    expect(origemDoItem(item({}))).toBe('Estúdio Luz')
    expect(origemDoItem(item({ tipo: 'avulso', cliente_nome: 'Carla' }))).toBe('Avulso · Carla')
    expect(origemDoItem(item({ tipo: 'avulso' }))).toBe('Avulso')
  })
})

describe('validarItens', () => {
  it('aceita projetos e avulsos e tira repetidos', () => {
    expect(
      validarItens([
        { tipo: 'projeto', id: P1 },
        { tipo: 'projeto', id: P1 },
        { tipo: 'avulso', id: A1 },
      ]),
    ).toEqual([
      { tipo: 'projeto', id: P1 },
      { tipo: 'avulso', id: A1 },
    ])
  })

  it('recusa lista vazia, tipo desconhecido, id inválido e lista grande demais', () => {
    expect(validarItens([])).toBeNull()
    expect(validarItens('x')).toBeNull()
    expect(validarItens([{ tipo: 'pedido', id: P1 }])).toBeNull()
    expect(validarItens([{ tipo: 'projeto', id: 'abc' }])).toBeNull()
    expect(validarItens([{ tipo: 'projeto', id: P1 }, { tipo: 'projeto', id: P2 }], 1)).toBeNull()
  })
})

describe('prazos', () => {
  it('dia do input vale até 23:59 de Brasília', () => {
    expect(prazoDoDia('2026-10-20')).toBe('2026-10-21T02:59:00.000Z')
    expect(diaDoPrazo('2026-10-21T02:59:00.000Z')).toBe('2026-10-20')
  })

  it('recusa datas inexistentes ou fora do formato', () => {
    expect(prazoDoDia('2026-02-31')).toBeNull()
    expect(prazoDoDia('20/10/2026')).toBeNull()
    expect(prazoDoDia('1999-01-01')).toBeNull()
    expect(prazoDoDia(null)).toBeNull()
    expect(diaDoPrazo(null)).toBe('')
  })

  it('descreve vencido, hoje e futuro', () => {
    const agora = new Date('2026-10-10T12:00:00Z').getTime()
    expect(descreverPrazo('2026-10-07T12:00:00Z', agora)).toBe('Venceu há 3 dias')
    expect(descreverPrazo('2026-10-10T18:00:00Z', agora)).toBe('Vence hoje')
    expect(descreverPrazo('2026-10-12T12:00:00Z', agora)).toBe('Vence em 2 dias')
    expect(descreverPrazo(null, agora)).toBe('Sem prazo')
  })

  it('formata o tempo médio em horas ou dias', () => {
    expect(formatarHoras(null)).toBe('—')
    expect(formatarHoras(18.4)).toBe('18 h')
    expect(formatarHoras(60)).toBe('2,5 dias')
  })
})

describe('filtros e ordem', () => {
  const itens = [
    item({ id: P1, nome: 'Casamento Ana', responsavel_id: D1, responsavel_nome: 'Diana', prioridade: 'alta' }),
    item({ id: P2, nome: 'Formatura José', etapa: 'aguardando_cliente', atrasado: false, cliente_atrasado: true, estudio: 'Foto Sul' }),
    item({ tipo: 'avulso', id: A1, numero: null, nome: 'Ensaio Bia', estudio: null, cliente_nome: 'Bia', atrasado: true, em_espera: false }),
    item({ id: '55555555-5555-4555-8555-555555555555', nome: 'Pausado', em_espera: true }),
    item({ id: '66666666-6666-4666-8666-666666666666', nome: 'Aprovado', etapa: 'aprovado' }),
  ]

  it('filtra por etapa, responsável, estúdio, tipo e atraso', () => {
    expect(filtrarItens(itens, { etapa: 'aguardando_cliente' }).map((i) => i.id)).toEqual([P2])
    expect(filtrarItens(itens, { responsavel: D1 }).map((i) => i.id)).toEqual([P1])
    expect(filtrarItens(itens, { responsavel: 'sem' })).toHaveLength(4)
    expect(filtrarItens(itens, { estudio: 'Foto Sul' }).map((i) => i.id)).toEqual([P2])
    expect(filtrarItens(itens, { tipo: 'avulso' }).map((i) => i.id)).toEqual([A1])
    expect(filtrarItens(itens, { soAtrasados: true }).map((i) => i.id)).toEqual([P2, A1])
    expect(filtrarItens(itens, { mostrarEmEspera: false })).toHaveLength(4)
    expect(filtrarItens(itens, { prioridade: 'alta' }).map((i) => i.id)).toEqual([P1])
  })

  it('busca sem acento por nome, número, cliente e responsável', () => {
    expect(filtrarItens(itens, { busca: 'jose' }).map((i) => i.id)).toEqual([P2])
    expect(filtrarItens(itens, { busca: 'diana' }).map((i) => i.id)).toEqual([P1])
    expect(filtrarItens(itens, { busca: 'bia' }).map((i) => i.id)).toEqual([A1])
    expect(filtrarItens(itens, { busca: '#1040' })).toHaveLength(4)
  })

  it('ordena: atrasados, cliente atrasado, prioridade; em espera e aprovados no fim', () => {
    expect(ordenarPorUrgencia(itens).map((i) => i.nome)).toEqual(['Ensaio Bia', 'Formatura José', 'Casamento Ana', 'Pausado', 'Aprovado'])
  })
})

describe('semMigracaoDiagramacao', () => {
  it('reconhece view/RPC/colunas ausentes, mas não outros erros', () => {
    expect(semMigracaoDiagramacao('relation "public.diagramacao_itens" does not exist')).toBe(true)
    expect(semMigracaoDiagramacao('Could not find the function public.diagramacao_resumo(p_urgentes) in the schema cache')).toBe(true)
    expect(semMigracaoDiagramacao("Could not find the 'prioridade' column of 'projetos' in the schema cache")).toBe(true)
    expect(semMigracaoDiagramacao('new row violates check constraint "projetos_prioridade_check"')).toBe(false)
    expect(semMigracaoDiagramacao(null)).toBe(false)
  })
})
