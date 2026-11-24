import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'
import { isDemoMode } from '@/lib/demo-mode'
import { getCurrentClient, requireClientPortal } from '@/lib/supabase/queries'

/**
 * Portal do cliente com a identidade comum do workspace e navegação própria.
 * Mantém autorização e o estado de conta ainda não vinculada ao estúdio.
 */
export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  await requireClientPortal()
  const client = await getCurrentClient()
  // Conta de cliente ainda não ligada a um cadastro em `clientes`. Redirecionar
  // daria loop (/cliente é a única área deste papel) — explica e oferece sair.
  if (!client) {
    return (
      <WorkspaceShell previaDisponivel={previaLocalAtiva()} area="cliente" role="cliente" nome="Seu espaço" demonstracao={isDemoMode()}><div className="flex flex-col items-center justify-center gap-4 rounded-2xl border bg-white/60 px-6 py-20 text-center">
        <h1 className="text-xl font-bold tracking-tight text-[#171717]">Seu acesso ainda está sendo preparado</h1>
        <p className="max-w-sm text-sm text-[#595959]">
          O estúdio ainda não vinculou esta conta a um álbum. Fale com o seu fotógrafo para liberar o acesso.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-[44px] rounded-lg px-4 text-sm font-semibold text-[#171717] underline underline-offset-4">
            Sair
          </button>
        </form>
      </div></WorkspaceShell>
    )
  }

  return <WorkspaceShell previaDisponivel={previaLocalAtiva()} area="cliente" role="cliente" nome={client.nome} demonstracao={isDemoMode()} suporteHref={`https://wa.me/55${client.telefone.replace(/\D/g, '')}`}>{children}</WorkspaceShell>
}
