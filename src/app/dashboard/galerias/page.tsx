import Link from 'next/link'
import {notFound} from 'next/navigation'
import {requireUser} from '@/lib/supabase/queries'
import {NewGallery} from '@/components/portal/new-gallery'
export default async function GaleriasPage(){
 const {user,profile,supabase}=await requireUser()
 if(profile?.role!=='fotografo')notFound()
 const avisos=supabase?await supabase.from('selecao_notificacoes').select('id,selecao_id,created_at').order('created_at',{ascending:false}).limit(20):null
 const ids=avisos?.data?.map(a=>a.selecao_id)??[]
 const entregas=supabase&&ids.length?await supabase.from('selecoes_entregues').select('id,projeto_id,revisao,foto_ids').in('id',ids):null
 const resultado=supabase?await supabase.from('projetos').select('id,nome,created_at').eq('fotografo_id',user.id).order('created_at',{ascending:false}).limit(100):null
 return <main className="space-y-6"><h1 className="text-3xl font-semibold">Galerias digitais</h1><NewGallery />
 <section className="space-y-3 rounded-2xl border p-5" aria-label="Seleções recebidas"><h2 className="text-xl font-semibold">Seleções recebidas</h2>
 {avisos?.error?<p className="text-sm">Notificações temporariamente indisponíveis.</p>:!entregas?.data?.length?<p className="text-sm text-muted-foreground">As entregas dos clientes aparecerão aqui.</p>:<ul className="space-y-3">{entregas.data.map(e=><li key={e.id}><Link className="underline" href={`/dashboard/albuns/${e.projeto_id}/compartilhar`}>Seleção entregue · revisão {e.revisao} · {e.foto_ids.length} fotos</Link></li>)}</ul>}
 </section>
 {resultado?.error?<p role="alert">Não foi possível carregar as galerias.</p>:<section className="grid gap-4 sm:grid-cols-2">{resultado?.data?.map(p=><Link key={p.id} href={`/dashboard/albuns/${p.id}/compartilhar`} className="rounded-2xl border p-5"><h2 className="font-semibold">{p.nome}</h2><p className="mt-2 text-sm text-muted-foreground">Fotografias, acesso privado e seleção</p></Link>)}</section>}
 {!resultado?.data?.length&&!resultado?.error?<p className="text-sm text-muted-foreground">Crie sua primeira galeria para disponibilizar as fotografias.</p>:null}
 </main>
}
