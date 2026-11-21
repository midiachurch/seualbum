import { notFound } from 'next/navigation'
import { getProject, requireUser } from '@/lib/supabase/queries'
import { GestaoGaleria } from '@/components/portal/gestao-galeria'
import { SelectionDeliveryPanel } from '@/components/cliente/selecao-entregue/selection-delivery-panel'
import { ClientPhotosManager } from '@/components/cliente/client-photos-manager'
import { PortalShare } from '@/components/portal/portal-share'
export default async function CompartilharPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, profile, supabase } = await requireUser()
  const { id } = await params
  const projeto = await getProject(id)
  if (!projeto || projeto.fotografoId !== user.id || profile?.role !== 'fotografo') notFound()
  // Coleções e download (0056): a RLS decide o que este usuário enxerga; se a migration ainda não existe, a seção some.
  const [colecoes, vinculos, config] = supabase ? await Promise.all([
    supabase.from('colecoes_foto').select('id,nome,ordem').eq('projeto_id', id).order('ordem'),
    supabase.from('colecao_fotos').select('colecao_id,foto_id'),
    supabase.from('galeria_download_config').select('liberado,expira_em,limite_fotos').eq('projeto_id', id).maybeSingle(),
  ]) : [null, null, null]
  const gestao = colecoes && !colecoes.error && vinculos && !vinculos.error
  const porColecao = new Map<string, string[]>()
  for (const v of vinculos?.data ?? []) porColecao.set(v.colecao_id, [...(porColecao.get(v.colecao_id) ?? []), v.foto_id])
  return <div className="space-y-6"><PortalShare projetoId={id} /><ClientPhotosManager projetoId={id} initialPhotos={projeto.photos} />
    {gestao && <GestaoGaleria projetoId={id} fotos={projeto.photos.map((p, i) => ({ id: p.id, url: p.url, nome: p.nomeArquivo ?? `Foto ${i + 1}` }))}
      colecoes={(colecoes.data ?? []).map(c => ({ id: c.id, nome: c.nome, fotoIds: porColecao.get(c.id) ?? [] }))}
      download={{ liberado: config?.data?.liberado ?? false, expiraEm: config?.data?.expira_em ?? null, limite: config?.data?.limite_fotos ?? 500 }} />}
    <SelectionDeliveryPanel projetoId={id} /></div>
}
