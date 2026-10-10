import type { Metadata } from 'next'
import { AttentionCard } from '@/components/cliente/attention-card'
import { ClientProjectCard } from '@/components/cliente/client-project-card'
import { NoProjectsEmptyState } from '@/components/cliente/no-projects-empty-state'
import { ProvaAguardandoCard } from '@/components/cliente/painel/prova-aguardando-card'
import {
  getComentariosDasProvas,
  getCurrentClient,
  getMarcasDoCliente,
  getProjects,
  getRevisoesDasProvas,
} from '@/lib/supabase/queries'
import { checklistDaVersao, prazoDeResposta, statusDoPainel, versoesLiberadas } from '@/lib/prova/painel'

export const metadata: Metadata = { title: 'Meus álbuns' }

/**
 * Painel do cliente final: o que espera a resposta dele primeiro (prova com
 * prazo e progresso da revisão), depois os álbuns com o status de cada um.
 */
export default async function ClienteDashboardPage() {
  const client = await getCurrentClient()
  const primeiroNome = client?.nome.split(' ')[0] ?? 'Você'
  const allProjects = await getProjects()
  const projects = allProjects.filter((p) => p.clientId === client?.id)

  const aguardando = projects.filter((p) => statusDoPainel(p) === 'aguardando_aprovacao')
  const idsAguardando = aguardando.map((p) => p.id)
  const [comentarios, revisoes, marcas] = await Promise.all([
    getComentariosDasProvas(idsAguardando),
    getRevisoesDasProvas(idsAguardando),
    getMarcasDoCliente(),
  ])

  // White label: o estúdio do casal assina o painel (nome e logo, se houver).
  const estudioPorFotografo = new Map(marcas.map((m) => [m.fotografoId, m]))
  const estudios = [...new Set(projects.map((p) => p.fotografoId))]
    .map((id) => estudioPorFotografo.get(id))
    .filter((m) => m !== undefined)
  const estudioUnico = estudios.length === 1 ? estudios[0] : null

  const faltamFotos = projects.flatMap((project) => {
    if (statusDoPainel(project) !== 'aguardando_fotos' || !project.metaFotos) return []
    const faltam = Math.max(0, project.metaFotos - project.photos.length)
    if (faltam === 0) return []
    return [
      {
        key: `${project.id}-fotos`,
        title: `Faltam ${faltam} fotos para o projeto ${project.nome}`,
        description: 'Envie o restante para começarmos a diagramação.',
        href: `/cliente/projetos/${project.id}?aba=fotos`,
      },
    ]
  })

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        {estudioUnico ? (
          <div className="flex items-center gap-3">
            {estudioUnico.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo do estúdio no bucket público (URL externa).
              <img src={estudioUnico.logoUrl} alt={estudioUnico.estudio} className="h-10 max-w-[140px] object-contain" />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">{estudioUnico.estudio}</p>
          </div>
        ) : null}
        <div>
          <p className="text-sm text-[#595959]">Olá, {primeiroNome} 👋</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#171717]">Seus álbuns estão por aqui</h1>
        </div>
      </section>

      {aguardando.length > 0 || faltamFotos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B6B6B]">Precisa da sua atenção</h2>
          <div className="space-y-3">
            {aguardando.map((project) => {
              const liberadas = versoesLiberadas(project.designVersions)
              const atual = liberadas[liberadas.length - 1]
              const capa = project.photos.find((p) => p.capa) ?? project.photos[0]
              const checklist = atual
                ? checklistDaVersao(atual, comentarios.get(project.id) ?? [], revisoes?.get(project.id) ?? [])
                : null
              return (
                <ProvaAguardandoCard
                  key={project.id}
                  projetoId={project.id}
                  nome={project.nome}
                  versao={atual?.numero ?? null}
                  capaUrl={capa?.url ?? null}
                  prazo={prazoDeResposta(project.dataLimiteAprovacao)}
                  checklist={checklist}
                />
              )
            })}
            {faltamFotos.map((alerta) => (
              <AttentionCard key={alerta.key} icon="fotos" title={alerta.title} description={alerta.description} href={alerta.href} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B6B6B]">Meus projetos</h2>
        {projects.length === 0 ? (
          <NoProjectsEmptyState />
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <ClientProjectCard
                key={project.id}
                project={project}
                estudio={estudioUnico ? null : (estudioPorFotografo.get(project.fotografoId)?.estudio ?? null)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
