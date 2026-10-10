import { describe, expect, it } from 'vitest'
import {
  apontamentosDoPainel,
  checklistDaVersao,
  linhaDoTempoDeVersoes,
  prazoDeResposta,
  resumoDosAjustes,
  situacaoDoProjeto,
  statusDoPainel,
  versoesLiberadas,
} from './painel'
import type { ApprovalEntry, DesignVersion, Lamina, ProjectStatus, ProofComment } from '@/types/platform'

const lamina = (id: string, ordem: number, extra: Partial<Lamina> = {}): Lamina => ({
  id,
  ordem,
  url: `https://r2.teste/${id}.jpg`,
  largura: 6000,
  altura: 3000,
  ...extra,
})

const versao = (numero: number, laminas: Lamina[], status: DesignVersion['status'] = 'aprovada'): DesignVersion => ({
  id: `v${numero}`,
  numero,
  data: `2026-10-0${numero}T12:00:00.000Z`,
  responsavelId: 'designer',
  arquivo: '',
  comentarios: null,
  status,
  laminas,
})

const comentario = (id: string, v: number, extra: Partial<ProofComment> = {}): ProofComment => ({
  id,
  pageIndex: 0,
  versao: v,
  texto: `texto ${id}`,
  autor: 'Ana',
  data: '2026-10-05T10:00:00.000Z',
  ...extra,
})

const aprovacao = (v: number, status: ApprovalEntry['status'], data = '2026-10-06T10:00:00.000Z'): ApprovalEntry => ({
  id: `a${v}-${status}`,
  versao: v,
  data,
  usuario: 'Ana',
  status,
  comentario: null,
})

// v1: capa + 3 lâminas; v2 parcial (troca só a 2); v3 é rascunho interno.
const v1 = versao(1, [lamina('c1', 1, { ehCapa: true }), lamina('a1', 2), lamina('b1', 3), lamina('d1', 4)])
const v2 = versao(2, [
  lamina('c2', 1, { ehCapa: true, alterada: false }),
  lamina('a2', 2, { alterada: true }),
  lamina('b2', 3, { alterada: false }),
  lamina('d2', 4, { alterada: false }),
])
const v3 = versao(3, [lamina('x3', 1)], 'em_producao')

describe('statusDoPainel', () => {
  const projeto = (status: ProjectStatus, approvals: ApprovalEntry[] = []) => ({ status, approvals, codigoRastreio: null, enviadoEm: null })

  it.each([
    ['aguardando_fotos', 'aguardando_fotos'],
    ['projeto_criado', 'em_preparacao'],
    ['em_diagramacao', 'em_preparacao'],
    ['aguardando_aprovacao_cliente', 'aguardando_aprovacao'],
    ['alteracoes_solicitadas', 'em_ajustes'],
    ['em_ajustes', 'em_ajustes'],
    ['aprovado_aguardando_pagamento', 'aprovado'],
    ['aprovado', 'em_producao'],
    ['enviado', 'em_producao'],
    ['finalizado', 'entregue'],
    ['arquivado', 'entregue'],
  ] as const)('%s → %s', (status, esperado) => {
    expect(statusDoPainel(projeto(status))).toBe(esperado)
  })

  it('revisão interna depois de um pedido de ajustes continua "em ajustes" para o casal', () => {
    expect(statusDoPainel(projeto('em_revisao_interna'))).toBe('em_preparacao')
    expect(statusDoPainel(projeto('em_revisao_interna', [aprovacao(1, 'alteracao_solicitada')]))).toBe('em_ajustes')
  })

  it('despachado mostra o rastreio', () => {
    const s = situacaoDoProjeto({ status: 'enviado', approvals: [], codigoRastreio: 'BR123', enviadoEm: '2026-10-08T00:00:00.000Z' })
    expect(s).toMatchObject({ status: 'em_producao', despachado: true, rastreio: 'BR123', label: 'Despachado pela gráfica' })
  })

  it('white label: fechamento pendente aparece só como "Aprovado"', () => {
    expect(situacaoDoProjeto({ status: 'aprovado_aguardando_pagamento', approvals: [], codigoRastreio: null, enviadoEm: null }).label).toBe('Aprovado')
  })
})

describe('prazoDeResposta', () => {
  const agora = new Date('2026-10-09T12:00:00.000Z')

  it('sem prazo, nada a mostrar', () => {
    expect(prazoDeResposta(null, agora)).toBeNull()
    expect(prazoDeResposta('não é data', agora)).toBeNull()
  })

  it('conta os dias que faltam', () => {
    expect(prazoDeResposta('2026-10-14T12:00:00.000Z', agora)).toMatchObject({ dias: 5, vencido: false, urgente: false })
    expect(prazoDeResposta('2026-10-14T12:00:00.000Z', agora)?.texto).toMatch(/^Responda em até 5 dias/)
  })

  it('último dia e prazo vencido ficam urgentes', () => {
    expect(prazoDeResposta('2026-10-09T20:00:00.000Z', agora)).toMatchObject({ vencido: false, urgente: true, texto: 'Responda até hoje' })
    expect(prazoDeResposta('2026-10-08T12:00:00.000Z', agora)).toMatchObject({ vencido: true, urgente: true })
  })
})

describe('linhaDoTempoDeVersoes', () => {
  it('só versões liberadas, da mais nova para a mais antiga, com o que mudou', () => {
    const etapas = linhaDoTempoDeVersoes(
      [v3, v2, v1],
      [aprovacao(1, 'alteracao_solicitada')],
      [comentario('k1', 1, { resolvido: true }), comentario('k2', 1), comentario('k3', 2)],
      'aguardando_aprovacao_cliente',
    )
    expect(etapas.map((e) => [e.numero, e.situacao, e.parcial, e.alteradas, e.total, e.apontamentos, e.resolvidos])).toEqual([
      [2, 'aguardando_voce', true, 1, 4, 1, 0],
      [1, 'ajustes_pedidos', false, 4, 4, 2, 1],
    ])
    expect(etapas[1].decididaEm).toBe('2026-10-06T10:00:00.000Z')
  })

  it('versão aprovada e versão antiga sem decisão', () => {
    const etapas = linhaDoTempoDeVersoes([v1, v2], [aprovacao(2, 'aprovado')], [], 'aprovado')
    expect(etapas.map((e) => e.situacao)).toEqual(['aprovada', 'substituida'])
  })

  it('a decisão mais recente da versão vale', () => {
    const etapas = linhaDoTempoDeVersoes(
      [v1],
      [aprovacao(1, 'alteracao_solicitada', '2026-10-06T10:00:00.000Z'), aprovacao(1, 'aprovado', '2026-10-07T10:00:00.000Z')],
      [],
      'aprovado',
    )
    expect(etapas[0].situacao).toBe('aprovada')
  })
})

describe('checklistDaVersao', () => {
  it('aprovada, com comentários, vista e não vista — e o progresso', () => {
    const c = checklistDaVersao(
      v2,
      [
        comentario('p1', 2, { laminaId: 'b2', posicaoX: 10, posicaoY: 10 }),
        comentario('p2', 2, { laminaId: 'd2', resolvido: true }),
        comentario('antigo', 1, { laminaId: 'a1' }),
      ],
      [
        { laminaId: 'c2', versao: 2, estado: 'aprovada' },
        { laminaId: 'a2', versao: 2, estado: 'vista' },
        { laminaId: 'b2', versao: 2, estado: 'aprovada' },
      ],
    )
    expect(c.itens.map((i) => [i.rotulo, i.estado, i.alterada])).toEqual([
      ['Capa', 'aprovada', false],
      ['Lâmina 2', 'vista', true],
      // Comentário aberto pesa mais que o "ok".
      ['Lâmina 3', 'com_comentarios', false],
      // Só comentário resolvido: conta como vista.
      ['Lâmina 4', 'vista', false],
    ])
    expect(c).toMatchObject({ total: 4, revisadas: 2, aprovadas: 1, comComentarios: 1, vistas: 2, naoVistas: 0 })
  })

  it('sem marcação nenhuma tudo começa como não vista; comentário antigo usa o índice', () => {
    const c = checklistDaVersao(v1, [comentario('legado', 1, { pageIndex: 2 })], [])
    expect(c.itens.map((i) => i.estado)).toEqual(['nao_vista', 'nao_vista', 'com_comentarios', 'nao_vista'])
    expect(c.revisadas).toBe(1)
  })

  it('sem versão, checklist vazio', () => {
    expect(checklistDaVersao(undefined, [], [])).toMatchObject({ total: 0, revisadas: 0 })
  })
})

describe('apontamentosDoPainel', () => {
  it('abertos primeiro; resolvido aponta a versão que trouxe o ajuste', () => {
    const lista = apontamentosDoPainel(
      [
        comentario('r1', 1, { laminaId: 'b1', resolvido: true, autorId: 'u-casal' }),
        comentario('a2', 2, { laminaId: 'a2', autorId: 'u-estudio' }),
        comentario('r2', 2, { laminaId: 'd2', resolvido: true }),
      ],
      [v1, v2, v3],
      'u-casal',
    )
    expect(lista.map((a) => [a.comentario.id, a.rotulo, a.aberto, a.resolvidoNaVersao, a.meu])).toEqual([
      ['a2', 'Lâmina 2', true, null, false],
      // Resolvido na v2, mas a v3 ainda é rascunho: nenhuma versão liberada depois.
      ['r2', 'Lâmina 4', false, null, false],
      ['r1', 'Lâmina 3', false, 2, true],
    ])
  })
})

describe('resumoDosAjustes', () => {
  it('mesmo formato da prova: lâmina, ponto/área numerados e só a versão pedida', () => {
    const texto = resumoDosAjustes(
      [
        comentario('x', 1, { texto: 'versão velha' }),
        comentario('a', 2, { pageIndex: 2, texto: 'trocar a foto', posicaoX: 10, posicaoY: 10, areaLargura: 20, areaAltura: 20 }),
        comentario('b', 2, { pageIndex: 0, texto: 'capa mais clara' }),
        comentario('c', 2, { pageIndex: 3, texto: 'tirar o texto', posicaoX: 50, posicaoY: 50 }),
      ],
      2,
    )
    expect(texto).toBe('Lâmina 3 (área 1): trocar a foto | Lâmina 1: capa mais clara | Lâmina 4 (pin 2): tirar o texto')
  })
})

describe('versoesLiberadas', () => {
  it('esconde rascunho interno e ordena', () => {
    expect(versoesLiberadas([v3, v2, v1]).map((v) => v.numero)).toEqual([1, 2])
  })
})
