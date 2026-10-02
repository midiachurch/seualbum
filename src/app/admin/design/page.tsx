import type { Metadata } from 'next'
import { DesignQueue, type CartaoDesign, type ColunaDesign } from '@/components/admin/design/design-queue'
import {
  getApontamentosPendentes,
  getCurrentTeamMember,
  getPhotographers,
  getProjects,
  requirePlatformAccess,
} from '@/lib/supabase/queries'
import { hasPermission, type ProjectStatus } from '@/types/platform'

export const metadata: Metadata = { title: 'Fila de design' }

/**
 * Workspace do designer: só o que precisa de diagramação, numa linha do
 * tempo em 4 colunas — do "a diagramar" ao "com o cliente". Sem financeiro,
 * sem cadastro de clientes (o papel `designer` nem enxerga esses dados na
 * RLS, migration 0021). Admin/gestor/operador também abrem esta visão.
 */
const COLUNAS: { chave: ColunaDesign; statuses: ProjectStatus[] }[] = [
  { chave: 'diagramar', statuses: ['fotos_recebidas', 'pronto_para_diagramacao', 'em_diagramacao'] },
  { chave: 'ajustes', statuses: ['alteracoes_solicitadas', 'em_ajustes'] },
  { chave: 'revisao', statuses: ['em_revisao_interna'] },
  { chave: 'cliente', statuses: ['aguardando_aprovacao_cliente'] },
]

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { role } = await requirePlatformAccess('design')
  const { subir } = await searchParams
  const podeSubir = !role || hasPermission(role, 'design', 'editar')

  const [projetos, membro, fotografos] = await Promise.all([getProjects(), getCurrentTeamMember(), getPhotographers()])
  const naFila = projetos.filter((p) => COLUNAS.some((c) => c.statuses.includes(p.status)))
  const pendentes = await getApontamentosPendentes(naFila.map((p) => p.id))

  const cartoes: CartaoDesign[] = naFila.map((p) => {
    const ultima = [...p.designVersions].sort((a, b) => b.numero - a.numero)[0] ?? null
    const coluna = COLUNAS.find((c) => c.statuses.includes(p.status))!.chave
    return {
      id: p.id,
      numero: p.numero,
      nome: p.nome,
      status: p.status,
      coluna,
      estudio: fotografos.find((f) => f.id === p.fotografoId)?.estudio ?? null,
      meu: Boolean(membro && p.responsavelId === membro.id),
      semResponsavel: p.responsavelId === null,
      dataLimiteProducao: p.dataLimiteProducao,
      dataLimiteAprovacao: p.dataLimiteAprovacao,
      fotos: p.photos.length,
      // A capa não conta na franquia do plano (0023).
      ultimaVersao: ultima
        ? { numero: ultima.numero, laminas: (ultima.laminas ?? []).filter((l) => !l.ehCapa).length, status: ultima.status }
        : null,
      laminasInclusas: p.laminasInclusas ?? null,
      // Na coluna de ajustes, o que falta aplicar é o que ficou aberto na última versão.
      pinsPendentes: ultima ? (pendentes.get(`${p.id}:${ultima.numero}`) ?? 0) : 0,
      album: { formato: p.album.formato, orientacao: p.album.orientacao },
    }
  })

  const subirInicial = typeof subir === 'string' && cartoes.some((c) => c.id === subir) ? subir : null

  return <DesignQueue cartoes={cartoes} podeSubir={podeSubir} subirInicial={subirInicial} />
}
