import type { BillingType, Plan } from '@/types/database'

/** Ciclo selecionado no toggle da seção de preços. */
export type BillingCycle = BillingType

/**
 * Família comercial do plano. Convenção de slug no catálogo: `{familia}-{ciclo}`
 * (ex.: `plus-mensal`). É o que permite o toggle trocar o preço mantendo a
 * mesma coluna na tabela comparativa.
 */
export type PlanFamily = 'essencial' | 'plus' | 'studio'

export const PLAN_FAMILY_ORDER: PlanFamily[] = ['essencial', 'plus', 'studio']

export function planFamily(plan: Plan): PlanFamily {
  const [familia] = plan.slug.split('-')
  return (PLAN_FAMILY_ORDER as string[]).includes(familia)
    ? (familia as PlanFamily)
    : 'essencial'
}

/** Escolhe o valor da linha conforme a família do plano da coluna. */
function byFamily<T>(plan: Plan, map: Record<PlanFamily, T>): T {
  return map[planFamily(plan)]
}

// -----------------------------------------------------------------------------
// Fallback do catálogo
// -----------------------------------------------------------------------------

/**
 * Espelha o seed de `supabase/migrations/0001_init.sql`. Serve para a landing
 * renderizar em dev antes do Supabase estar provisionado e para não derrubar a
 * home comercial se o banco ficar indisponível.
 */
export const FALLBACK_PLANS: Plan[] = (
  [
    ['essencial-avulso', 'Essencial', 'Para o fotógrafo que entrega poucos álbuns por ano.', 'avulso', 249, null, 7, 1, false, 1],
    ['plus-avulso', 'Plus', 'O equilíbrio entre prazo, curadoria e revisões.', 'avulso', 389, null, 4, 3, true, 2],
    ['studio-avulso', 'Studio', 'Volume alto com gerente de conta dedicado.', 'avulso', 590, null, 2, 5, false, 3],
    ['essencial-mensal', 'Essencial', 'Até 2 álbuns por mês.', 'assinatura', 399, 2, 7, 1, false, 1],
    ['plus-mensal', 'Plus', 'Até 5 álbuns por mês com curadoria inclusa.', 'assinatura', 890, 5, 4, 3, true, 2],
    ['studio-mensal', 'Studio', 'Alto volume com SLA contratual.', 'assinatura', 1690, 12, 2, 5, false, 3],
  ] as const
).map(
  ([slug, nome, descricao, cobranca, preco, albuns, prazo, revisoes, destaque, ordem]) =>
    ({
      id: slug,
      slug,
      nome_plano: nome,
      descricao,
      tipo_cobranca: cobranca as BillingType,
      preco,
      moeda: 'BRL',
      albuns_inclusos: albuns,
      prazo_dias: prazo,
      revisoes_inclusas: revisoes,
      features_json: [],
      destaque,
      ativo: true,
      ordem,
      created_at: '',
      updated_at: '',
    }) satisfies Plan,
)

// -----------------------------------------------------------------------------
// Bullets do card
// -----------------------------------------------------------------------------

/** Destaques exibidos dentro do card. A tabela abaixo cobre o detalhamento. */
export function planHighlights(plan: Plan): string[] {
  const base = [
    plan.tipo_cobranca === 'assinatura'
      ? `Até ${plan.albuns_inclusos} álbuns por mês`
      : 'Pagamento por álbum entregue',
    `Entrega em ${plan.prazo_dias} dias úteis`,
    `${plan.revisoes_inclusas} ${plan.revisoes_inclusas === 1 ? 'rodada' : 'rodadas'} de alteração`,
  ]

  return [
    ...base,
    ...byFamily(plan, {
      essencial: ['Diagramação em até 40 lâminas', 'Suporte por e-mail'],
      plus: ['Curadoria e seleção de fotos', 'Arquivo editável (.psd)', 'Suporte por WhatsApp'],
      studio: [
        'Curadoria e seleção de fotos',
        'Arquivo editável (.psd)',
        'Gerente de conta dedicado',
        'Prioridade na fila de produção',
      ],
    }),
  ]
}

// -----------------------------------------------------------------------------
// Tabela comparativa
// -----------------------------------------------------------------------------

export interface ComparisonRow {
  label: string
  hint?: string
  /** `true`/`false` viram ícone; string é renderizada como texto. */
  render: (plan: Plan) => string | boolean
}

export interface ComparisonGroup {
  titulo: string
  linhas: ComparisonRow[]
}

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    titulo: 'Produção',
    linhas: [
      {
        label: 'Prazo de entrega',
        hint: 'Contado a partir da confirmação do briefing.',
        render: (p) => `${p.prazo_dias} dias úteis`,
      },
      {
        label: 'Alterações inclusas',
        hint: 'Rodadas de ajuste após o envio da prova.',
        render: (p) => `${p.revisoes_inclusas} ${p.revisoes_inclusas === 1 ? 'rodada' : 'rodadas'}`,
      },
      {
        label: 'Curadoria de fotos',
        hint: 'Seleção das melhores imagens a partir do material bruto.',
        render: (p) => byFamily(p, { essencial: false, plus: true, studio: true }),
      },
      {
        label: 'Lâminas incluídas',
        render: (p) => byFamily(p, { essencial: 'Até 40', plus: 'Até 80', studio: 'Ilimitadas' }),
      },
      {
        label: 'Prioridade na fila',
        render: (p) => byFamily(p, { essencial: false, plus: false, studio: true }),
      },
    ],
  },
  {
    titulo: 'Entrega',
    linhas: [
      {
        label: 'Prova online para aprovação',
        render: () => true,
      },
      {
        label: 'Arquivo editável (.psd)',
        render: (p) => byFamily(p, { essencial: false, plus: true, studio: true }),
      },
      {
        label: 'Exportação pronta para gráfica',
        render: (p) => byFamily(p, { essencial: 'JPG', plus: 'JPG + PDF/X-1a', studio: 'JPG + PDF/X-1a' }),
      },
      {
        label: 'Layout compatível com sua gráfica',
        render: () => true,
      },
    ],
  },
  {
    titulo: 'Suporte e conta',
    linhas: [
      {
        label: 'Canal de atendimento',
        render: (p) =>
          byFamily(p, { essencial: 'E-mail', plus: 'WhatsApp', studio: 'Gerente dedicado' }),
      },
      {
        label: 'Tempo de resposta',
        render: (p) => byFamily(p, { essencial: '48h', plus: '24h', studio: '4h' }),
      },
      {
        label: 'Contrato de nível de serviço (SLA)',
        render: (p) => byFamily(p, { essencial: false, plus: false, studio: true }),
      },
      {
        label: 'Nota fiscal e faturamento PJ',
        render: () => true,
      },
    ],
  },
]

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------

export interface FaqItem {
  pergunta: string
  resposta: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    pergunta: 'Como eu envio as fotos do álbum?',
    resposta:
      'Você cola o link do Google Drive, Dropbox ou WeTransfer no formulário de novo pedido. Não é preciso subir arquivo nenhum pela plataforma — basta garantir que o link esteja com permissão de leitura para qualquer pessoa.',
  },
  {
    pergunta: 'Qual a diferença entre o plano avulso e a assinatura?',
    resposta:
      'No avulso você paga por álbum entregue, sem compromisso mensal. Na assinatura você tem uma cota de álbuns por mês com preço por unidade menor, prioridade na fila e o mesmo prazo contratado. A assinatura compensa a partir de dois álbuns por mês.',
  },
  {
    pergunta: 'O prazo de entrega começa a contar quando?',
    resposta:
      'A partir do momento em que confirmamos o briefing e o acesso às fotos. Se o link estiver incompleto ou sem permissão, o relógio só inicia depois do ajuste.',
  },
  {
    pergunta: 'E se eu não gostar da diagramação?',
    resposta:
      'Cada plano inclui rodadas de alteração. Você recebe uma prova online, marca os ajustes e devolve para a produção. Rodadas extras podem ser contratadas à parte.',
  },
  {
    pergunta: 'Vocês trabalham com qual software?',
    resposta:
      'Diagramamos em SmartAlbums e Adobe InDesign/Photoshop, e entregamos no template da sua gráfica. Nos planos Plus e Studio você também recebe o arquivo editável.',
  },
  {
    pergunta: 'Posso cancelar a assinatura a qualquer momento?',
    resposta:
      'Sim. O cancelamento vale para o próximo ciclo e você mantém o direito aos álbuns já contratados no mês corrente.',
  },
  {
    pergunta: 'Meu cliente final fica sabendo que vocês diagramaram?',
    resposta:
      'Não. O serviço é white label: toda a comunicação, a prova de aprovação e os arquivos finais saem sem qualquer marca nossa.',
  },
]
