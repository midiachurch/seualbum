import Link from 'next/link'
import { BookImage } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Miniatura do álbum nas listas do fotógrafo. Quando há o que abrir, a
 * miniatura inteira é o link (prova ou download) — ninguém precisa caçar o
 * botão pequeno de ação.
 */
export function AlbumThumb({
  src,
  nome,
  destino,
  className,
}: {
  src: string | null
  nome: string
  destino: { href: string; externo: boolean } | null
  className?: string
}) {
  const conteudo = src ? (
    // eslint-disable-next-line @next/next/no-img-element -- lâmina via link assinado do Storage (expira; next/image não se aplica).
    <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
  ) : (
    <BookImage className="h-6 w-6 text-[#595959]" aria-hidden />
  )
  const classe = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#F5F5F5]',
    destino && 'transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]',
    className,
  )

  if (!destino) return <div className={classe}>{conteudo}</div>
  const rotulo = destino.externo ? `Baixar o álbum ${nome}` : `Abrir a prova de ${nome}`
  return destino.externo ? (
    <a href={destino.href} target="_blank" rel="noopener noreferrer" aria-label={rotulo} className={classe}>
      {conteudo}
    </a>
  ) : (
    <Link href={destino.href} aria-label={rotulo} className={classe}>
      {conteudo}
    </Link>
  )
}

/** Nome do álbum: link para o mesmo destino da miniatura, quando houver. */
export function AlbumNome({
  nome,
  destino,
  className,
}: {
  nome: React.ReactNode
  destino: { href: string; externo: boolean } | null
  className?: string
}) {
  if (!destino) return <span className={className}>{nome}</span>
  const classe = cn('underline-offset-2 hover:underline', className)
  return destino.externo ? (
    <a href={destino.href} target="_blank" rel="noopener noreferrer" className={classe}>
      {nome}
    </a>
  ) : (
    <Link href={destino.href} className={classe}>
      {nome}
    </Link>
  )
}
