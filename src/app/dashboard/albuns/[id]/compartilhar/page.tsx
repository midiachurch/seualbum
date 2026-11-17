import { notFound } from 'next/navigation'
import { getProject, requireUser } from '@/lib/supabase/queries'
import { SelectionDeliveryPanel } from '@/components/cliente/selecao-entregue/selection-delivery-panel'
import { ClientPhotosManager } from '@/components/cliente/client-photos-manager'
import { PortalShare } from '@/components/portal/portal-share'
export default async function CompartilharPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, profile } = await requireUser()
  const { id } = await params
  const projeto = await getProject(id)
  if (!projeto || projeto.fotografoId !== user.id || profile?.role !== 'fotografo') notFound()
  return <div className="space-y-6"><PortalShare projetoId={id} /><ClientPhotosManager projetoId={id} initialPhotos={projeto.photos} /><SelectionDeliveryPanel projetoId={id} /></div>
}
