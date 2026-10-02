import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AprovacaoCliente, type AlbumPublico } from '@/components/album-editor/aprovacao-cliente'
import { createPublicClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo-mode'

export const metadata: Metadata = { title: 'Aprovação do álbum', robots: { index: false, follow: false } }

type Bruto = {
  id: string
  numero: number
  status: AlbumPublico['status']
  laminas: { path: string; largura: number; altura: number; rotulo: string }[]
  mensagem_cliente: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  album: string
  cliente: string | null
  comentarios: { id: string; lamina_indice: number; x: number | null; y: number | null; texto: string; autor_nome: string; origem: 'cliente' | 'equipe'; criado_em: string }[]
}

/**
 * Link de aprovação de um álbum avulso — sem login. O token do endereço é a
 * única credencial: a função do banco devolve a aprovação, e as lâminas são
 * assinadas com o cliente anônimo (a policy só libera os arquivos dela).
 */
export default async function AprovacaoPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (isDemoMode() || !/^[0-9a-f]{64}$/.test(token)) notFound()
  const supabase = createPublicClient()
  const { data } = await supabase.rpc('album_aprovacao_publica', { p_token: token })
  const bruto = data as Bruto | null
  if (!bruto) notFound()

  const { data: assinadas } = await supabase.storage.from('albuns_fotos').createSignedUrls(
    bruto.laminas.map((l) => l.path),
    6 * 60 * 60,
  )
  const url = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]))

  const album: AlbumPublico = {
    token,
    numero: bruto.numero,
    status: bruto.status,
    nome: bruto.album,
    cliente: bruto.cliente,
    laminas: bruto.laminas.map((l) => ({ url: url.get(l.path) ?? null, rotulo: l.rotulo, largura: l.largura, altura: l.altura })),
    mensagemCliente: bruto.mensagem_cliente,
    decididoPorNome: bruto.decidido_por_nome,
    decididoEm: bruto.decidido_em,
    comentarios: bruto.comentarios.map((c) => ({
      id: c.id,
      laminaIndice: c.lamina_indice,
      x: c.x === null ? null : Number(c.x),
      y: c.y === null ? null : Number(c.y),
      texto: c.texto,
      autor: c.autor_nome,
      origem: c.origem,
      criadoEm: c.criado_em,
    })),
  }
  return <AprovacaoCliente album={album} />
}
