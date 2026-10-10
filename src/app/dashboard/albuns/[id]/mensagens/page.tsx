import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PainelMensagensProjeto } from '@/components/mensagens/painel-mensagens-projeto'
import { abrirFio, opcoesDeLaminas } from '@/lib/mensagens-servidor'
import { ehUuid } from '@/lib/mensagens'
import { getProject, requireUser } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Mensagens do álbum' }

/**
 * Mensagens de um álbum pelo estúdio: com a equipe seualbum e com o cliente
 * final. `[id]` é o id do projeto, como na prova (`/dashboard/albuns/[id]/prova`).
 */
export default async function MensagensDoAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const project = await getProject(id)
  if (!project || project.fotografoId !== user.id) notFound()

  const [equipe, cliente] = await Promise.all([
    abrirFio('estudio_equipe', { projetoId: id }),
    abrirFio('cliente_estudio', { projetoId: id }),
  ])

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/dashboard/meus-albuns">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para meus álbuns
        </Link>
      </Button>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">#{project.numero}</p>
        <h1 className="text-2xl font-bold tracking-tight">Mensagens · {project.nome}</h1>
      </header>
      <PainelMensagensProjeto
        meuId={user.id}
        perfil="fotografo"
        laminas={opcoesDeLaminas(project, { somenteLiberadas: true })}
        abas={[
          { valor: 'equipe', rotulo: 'Equipe seualbum', fio: equipe, vazio: 'Não foi possível abrir a conversa com a equipe.' },
          { valor: 'cliente', rotulo: 'Cliente', fio: cliente, vazio: 'Não foi possível abrir a conversa com o cliente.' },
        ]}
      />
    </div>
  )
}
