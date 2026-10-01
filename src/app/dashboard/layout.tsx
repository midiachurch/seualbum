import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DashboardNavDesktop, DashboardNavMobile } from '@/components/dashboard/dashboard-nav'
import { getPlatformRole, requireUser } from '@/lib/supabase/queries'
import { rotaDoPapel } from '@/types/platform'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defesa em profundidade: o middleware já barrou o anônimo, mas o layout não
  // depende do matcher para decidir se pode renderizar dados de cliente.
  const { profile } = await requireUser()
  // Área exclusiva do estúdio: equipe vai para /admin, cliente final para
  // /cliente (o middleware já faz isso; aqui é a segunda barreira).
  const role = await getPlatformRole()
  if (role !== 'fotografo') redirect(rotaDoPapel(role))

  return (
    <div className="flex min-h-screen flex-col">
      <header className="font-marketing border-b border-[#EAEAEA] bg-white">
        <div className="container flex h-16 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex min-h-[44px] shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
              <img src="/brand/logo-dark.png" alt="Seu Álbum" className="h-8 w-auto" />
            </Link>
            <DashboardNavDesktop />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#595959] sm:inline">
              {profile?.nome_completo}
            </span>
            <form action="/auth/signout" method="post">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-11 text-[#595959] hover:text-[#171717]"
              >
                Sair
              </Button>
            </form>
          </div>
        </div>
        <DashboardNavMobile />
      </header>

      <main className="container flex-1 py-10">{children}</main>
    </div>
  )
}
