import { ClientBottomNav } from '@/components/cliente/client-bottom-nav'
import { getCurrentClient, requireClientPortal } from '@/lib/supabase/queries'
import { initials } from '@/lib/utils'

/**
 * Shell isolado do portal B2C — mobile-first de propósito: sem sidebar,
 * navegação inferior fixa, conteúdo centrado numa largura de "telefone"
 * mesmo no desktop (o cliente final não deveria enxergar densidade de admin).
 */
export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  await requireClientPortal()
  const client = await getCurrentClient()
  // Conta de cliente ainda não ligada a um cadastro em `clientes`. Redirecionar
  // daria loop (/cliente é a única área deste papel) — explica e oferece sair.
  if (!client) {
    return (
      <div className="font-marketing flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAFA] px-6 text-center">
        <h1 className="text-xl font-bold tracking-tight text-[#171717]">Seu acesso ainda está sendo preparado</h1>
        <p className="max-w-sm text-sm text-[#595959]">
          O estúdio ainda não vinculou esta conta a um álbum. Fale com o seu fotógrafo para liberar o acesso.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-[44px] rounded-lg px-4 text-sm font-semibold text-[#171717] underline underline-offset-4">
            Sair
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="font-marketing flex min-h-screen flex-col bg-[#FAFAFA]">
      <header className="sticky top-0 z-30 border-b border-[#EAEAEA] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
          <img src="/brand/logo-dark.png" alt="Seu Álbum" className="h-7 w-auto" />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-xs font-semibold text-white">
            {initials(client.nome)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-6">{children}</main>

      <ClientBottomNav whatsapp={client.telefone} />
    </div>
  )
}
