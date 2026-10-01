import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { getPlatformRole, requireAdmin } from '@/lib/supabase/queries'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Segunda barreira de autorização: o middleware checa o role, mas o layout
  // não pode depender do `matcher` para proteger dados de todos os clientes.
  const { profile } = await requireAdmin()
  const role = await getPlatformRole()

  return (
    <div className="font-marketing flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[#EAEAEA] bg-white">
        <div className="flex h-16 items-center justify-between gap-6 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
              <img src="/brand/logo-dark.png" alt="Seu Álbum" className="h-8 w-auto" />
            </Link>
            <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#444444]">
              Operação
            </span>
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
                className="text-[#595959] hover:bg-[#F5F5F5] hover:text-[#171717]"
              >
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <AdminSidebar role={role} />
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  )
}
