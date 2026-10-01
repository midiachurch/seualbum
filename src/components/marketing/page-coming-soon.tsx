import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PageComingSoonProps {
  eyebrow: string
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}

/**
 * Placeholder editorial para rotas da nova IA cujo conteúdo real ainda será
 * cadastrado (Diretriz 6: "criar a estrutura preparada para receber o conteúdo").
 */
export function PageComingSoon({ eyebrow, title, description, actionHref, actionLabel }: PageComingSoonProps) {
  return (
    <section className="font-marketing flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-overline text-[#595959]">{eyebrow}</p>
      <h1 className="text-display-l mt-4 max-w-3xl text-[#444444]">{title}</h1>
      <p className="text-body mt-6 max-w-xl text-[#595959]">{description}</p>
      {actionHref && actionLabel ? (
        <Button
          asChild
          size="lg"
          className="btn-marketing mt-8 border-2 border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </section>
  )
}
