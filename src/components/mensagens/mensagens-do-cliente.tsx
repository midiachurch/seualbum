import { ConversaThread } from '@/components/mensagens/conversa-thread'
import type { OpcaoLamina, PaginaDeMensagens } from '@/lib/mensagens'
import { initials } from '@/lib/utils'

/**
 * Aba "Mensagens" do portal do cliente final: um único fio, com o próprio
 * estúdio, e a marca do ESTÚDIO (nome e logo) — nada de seualbum.
 */
export function MensagensDoCliente({
  estudio,
  logoUrl,
  fio,
  meuId,
  laminas,
}: {
  estudio: string
  logoUrl: string | null
  fio: { conversaId: string; inicial: PaginaDeMensagens } | null
  meuId: string
  laminas: OpcaoLamina[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo do estúdio pode vir de domínios diferentes (R2 público ou Storage antigo).
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-full border border-[#EAEAEA] bg-white object-contain" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-xs font-semibold text-white">
            {initials(estudio)}
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-[#171717]">{estudio}</p>
          <p className="text-xs text-[#6B6B6B]">Fale direto com o seu fotógrafo sobre o álbum.</p>
        </div>
      </div>
      {fio ? (
        <ConversaThread key={fio.conversaId} conversaId={fio.conversaId} meuId={meuId} perfil="cliente" inicial={fio.inicial} laminas={laminas} />
      ) : (
        <p className="rounded-2xl border border-dashed border-[#DADADA] p-8 text-center text-sm text-[#6B6B6B]">
          As mensagens não estão disponíveis agora. Tente de novo em instantes.
        </p>
      )}
    </div>
  )
}
