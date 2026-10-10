import type { Metadata } from 'next'
import { ControleDiagramacao, type MembroEquipe } from '@/components/admin/diagramacao/controle-diagramacao'
import { getItensDiagramacao } from '@/lib/supabase/diagramacao'
import { getTeamMembers, requirePlatformAccess } from '@/lib/supabase/queries'
import { ETAPAS_DIAGRAMACAO, ehUuid, type EtapaDiagramacao, type FiltrosDiagramacao } from '@/lib/diagramacao/regras'
import { EXECUTORES_ROLES, PLATFORM_ROLE_LABEL, hasPermission } from '@/types/platform'

export const metadata: Metadata = { title: 'Diagramação' }

/**
 * Centro de controle da diagramação (migration 0038). Admin/gestor/operador
 * abrem; só admin/gestor atribuem, priorizam e pausam. O designer não entra
 * aqui: a casa dele continua sendo a própria fila (/admin/design).
 */
export default async function DiagramacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>
}) {
  const { role } = await requirePlatformAccess('projetos')
  const podeGerir = !role || hasPermission(role, 'projetos', 'atribuir')
  const { etapa, responsavel, atrasados } = await searchParams

  const [{ dados: itens, semMigracao }, membros] = await Promise.all([getItensDiagramacao(), getTeamMembers()])

  // Quem pode receber diagramação: designers e operadores primeiro, depois a gestão.
  const equipe: MembroEquipe[] = membros
    .filter((m) => m.status === 'ativo')
    .sort(
      (a, b) =>
        Number(EXECUTORES_ROLES.includes(b.role)) - Number(EXECUTORES_ROLES.includes(a.role)) || a.nome.localeCompare(b.nome, 'pt-BR'),
    )
    .map((m) => ({ id: m.id, nome: `${m.nome} (${PLATFORM_ROLE_LABEL[m.role]})`, papel: m.role }))

  const filtrosIniciais: FiltrosDiagramacao = {
    etapa: typeof etapa === 'string' && (ETAPAS_DIAGRAMACAO as string[]).includes(etapa) ? (etapa as EtapaDiagramacao) : '',
    responsavel: typeof responsavel === 'string' && (responsavel === 'sem' || ehUuid(responsavel)) ? responsavel : '',
    soAtrasados: atrasados === '1',
  }

  return (
    <ControleDiagramacao
      itens={itens}
      equipe={equipe}
      podeGerir={podeGerir}
      semMigracao={semMigracao}
      filtrosIniciais={filtrosIniciais}
    />
  )
}
