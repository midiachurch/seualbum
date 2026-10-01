import type { Metadata } from 'next'
import { AttentionCard } from '@/components/cliente/attention-card'
import { ClientProjectCard } from '@/components/cliente/client-project-card'
import { NoProjectsEmptyState } from '@/components/cliente/no-projects-empty-state'
import { getCurrentClient, getProjects } from '@/lib/supabase/queries'
import { clientStageOf } from '@/types/platform'

export const metadata: Metadata = { title: 'Meus álbuns' }

export default async function ClienteDashboardPage() {
  const client = await getCurrentClient()
  const primeiroNome = client?.nome.split(' ')[0] ?? 'Você'
  const allProjects = await getProjects()
  const projects = allProjects.filter((p) => p.clientId === client?.id)

  const alertas = projects.flatMap((project) => {
    const stage = clientStageOf(project.status)
    const items: { key: string; icon: 'fotos' | 'prova'; title: string; description: string; href: string }[] = []

    if (stage === 'aguardando_fotos' && project.metaFotos) {
      const faltam = Math.max(0, project.metaFotos - project.photos.length)
      if (faltam > 0) {
        items.push({
          key: `${project.id}-fotos`,
          icon: 'fotos',
          title: `Faltam ${faltam} fotos para o projeto ${project.nome}`,
          description: 'Envie o restante para começarmos a diagramação.',
          href: `/cliente/projetos/${project.id}?aba=fotos`,
        })
      }
    }

    if (stage === 'prova_liberada') {
      items.push({
        key: `${project.id}-prova`,
        icon: 'prova',
        title: 'Sua prova digital está pronta!',
        description: `${project.nome} — dê uma olhada e aprove quando quiser.`,
        href: `/cliente/projetos/${project.id}/prova`,
      })
    }

    return items
  })

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-[#595959]">Olá, {primeiroNome} 👋</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#171717]">Seus álbuns estão por aqui</h1>
      </section>

      {alertas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B6B6B]">
            Precisa da sua atenção
          </h2>
          <div className="space-y-3">
            {alertas.map((alerta) => (
              <AttentionCard
                key={alerta.key}
                icon={alerta.icon}
                title={alerta.title}
                description={alerta.description}
                href={alerta.href}
              />
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
              <ClientProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
