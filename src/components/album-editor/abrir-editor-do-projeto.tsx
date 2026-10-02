'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { criarLayoutDoProjeto } from '@/lib/actions/album-editor'

/** Primeira abertura do editor num projeto: cria o documento e recarrega a página. */
export function AbrirEditorDoProjeto({ projetoId }: { projetoId: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    // `criarLayoutDoProjeto` é idempotente: duas chamadas devolvem o mesmo documento.
    void criarLayoutDoProjeto(projetoId).then((r) => {
      if (!ativo) return
      if (r.ok) router.refresh()
      else setErro(r.erro)
    })
    return () => {
      ativo = false
    }
  }, [projetoId, router])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#141414] p-6 text-center text-white">
      {erro ? (
        <>
          <AlertCircle className="h-8 w-8 text-amber-400" aria-hidden />
          <p className="max-w-sm text-sm">{erro}</p>
          <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
            <Link href={`/admin/projetos/${projetoId}`}>Voltar ao projeto</Link>
          </Button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparando o editor deste projeto…
        </p>
      )}
    </div>
  )
}
