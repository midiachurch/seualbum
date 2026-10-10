'use client'

import { useState } from 'react'
import { ConversaThread } from '@/components/mensagens/conversa-thread'
import type { OpcaoLamina, PaginaDeMensagens, PerfilMensagens } from '@/lib/mensagens'
import { cn } from '@/lib/utils'

export type AbaMensagens = {
  valor: string
  rotulo: string
  fio: { conversaId: string; inicial: PaginaDeMensagens; somenteLeitura?: boolean; aviso?: string } | null
  /** Texto quando não há fio (ex.: o cliente ainda não escreveu). */
  vazio?: string
}

/** Aba "Mensagens" de um projeto: um ou dois fios (equipe / cliente). */
export function PainelMensagensProjeto({
  abas,
  meuId,
  perfil,
  laminas,
}: {
  abas: AbaMensagens[]
  meuId: string
  perfil: PerfilMensagens
  laminas?: OpcaoLamina[]
}) {
  const [ativa, setAtiva] = useState(abas[0]?.valor)
  const aba = abas.find((a) => a.valor === ativa) ?? abas[0]
  if (!aba) return null

  return (
    <div className="space-y-3">
      {abas.length > 1 ? (
        <div role="tablist" aria-label="Conversas do projeto" className="flex flex-wrap gap-2">
          {abas.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="tab"
              aria-selected={a.valor === aba.valor}
              onClick={() => setAtiva(a.valor)}
              className={cn(
                'min-h-[36px] rounded-full px-4 text-sm font-medium transition-colors',
                a.valor === aba.valor ? 'bg-[#171717] text-white' : 'bg-[#F5F5F5] text-[#595959] hover:text-[#171717]',
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      ) : null}

      {aba.fio ? (
        <ConversaThread
          key={aba.fio.conversaId}
          conversaId={aba.fio.conversaId}
          meuId={meuId}
          perfil={perfil}
          inicial={aba.fio.inicial}
          somenteLeitura={aba.fio.somenteLeitura}
          aviso={aba.fio.aviso}
          laminas={laminas}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-[#DADADA] p-8 text-center text-sm text-[#6B6B6B]">
          {aba.vazio ?? 'Nenhuma conversa ainda.'}
        </p>
      )}
    </div>
  )
}
