import { notFound } from 'next/navigation'
import { StoreEstudio } from '@/components/dashboard/store-estudio'
import { requireUser } from '@/lib/supabase/queries'

export default async function StorePage() {
  const { profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo') notFound()
  const organizacoes = supabase ? await supabase.from('organizacoes').select('id,nome,created_at').order('created_at') : null
  const lista = organizacoes?.data ?? []
  const blocos = supabase ? await Promise.all(lista.map(async o => {
    const [papel, produtos, projetos, vinculos, pedidos, divergencias] = await Promise.all([
      supabase.rpc('papel_na_organizacao', { p_org: o.id }),
      supabase.from('store_produtos').select('*').eq('organizacao_id', o.id).order('nome'),
      supabase.from('projetos').select('id,nome').eq('organizacao_id', o.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('store_projeto_produtos').select('projeto_id,produto_id'),
      supabase.from('store_pedidos').select('id,organizacao_id,projeto_id,chave,comprador_nome,comprador_email,contexto,status,moeda,total_centavos,comissao_centavos,liquido_centavos,provedor,created_at,pago_em,encerrado_em').eq('organizacao_id', o.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('store_divergencias').select('*').eq('organizacao_id', o.id).order('created_at', { ascending: false }).limit(20),
    ])
    return { o, papel, produtos, projetos, vinculos, pedidos, divergencias }
  })) : []
  return <main className="space-y-6">
    <div>
      <h1 className="text-3xl font-semibold">Loja</h1>
      <p className="mt-1 text-sm text-muted-foreground">Venda de coleções, fotos e produtos ao seu cliente, direto da galeria. O estúdio é o vendedor.</p>
    </div>
    {organizacoes?.error ? <p role="status" className="text-sm">Loja temporariamente indisponível.</p>
      : !lista.length ? <p className="text-sm text-muted-foreground">Seu estúdio ainda não tem uma organização.</p>
      : blocos.map(({ o, papel, produtos, projetos, vinculos, pedidos, divergencias }) => papel.error || !papel.data || produtos.error
        ? <p key={o.id} role="status" className="text-sm">Loja de {o.nome} temporariamente indisponível.</p>
        : <StoreEstudio key={o.id} organizacaoId={o.id} nome={o.nome} papel={papel.data} produtos={produtos.data ?? []} projetos={projetos.data ?? []}
            vinculos={(vinculos.data ?? []).map(v => `${v.projeto_id}:${v.produto_id}`)} pedidos={pedidos.data ?? []} divergencias={divergencias.data ?? []} />)}
  </main>
}
