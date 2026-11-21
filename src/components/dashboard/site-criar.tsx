'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { criarSite } from '@/lib/actions/sites'

const slugDe = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38)

/** Primeiro site da organização: nome e endereço. O conteúdo inicial nasce com uma capa. */
export function SiteCriar({ organizacaoId, nomeSugerido }: { organizacaoId: string; nomeSugerido: string }) {
  const router = useRouter()
  const [nome, setNome] = useState(nomeSugerido)
  const [slug, setSlug] = useState(slugDe(nomeSugerido))
  const [editouSlug, setEditouSlug] = useState(false)
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  return (
    <form className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => {
      e.preventDefault(); setErro('')
      iniciar(async () => { const r = await criarSite(organizacaoId, nome, slug); if (!r.ok) setErro(r.erro); else router.refresh() })
    }}>
      <label className="grid gap-1 text-sm">Nome do estúdio no site
        <input value={nome} maxLength={120} required onChange={(e) => { setNome(e.target.value); if (!editouSlug) setSlug(slugDe(e.target.value)) }} className="min-h-11 rounded-lg border px-3" />
      </label>
      <label className="grid gap-1 text-sm">Endereço do site (/s/…)
        <input value={slug} maxLength={40} required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" onChange={(e) => { setSlug(e.target.value.toLowerCase()); setEditouSlug(true) }} className="min-h-11 rounded-lg border px-3" />
      </label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">{pendente ? 'Criando…' : 'Criar meu site'}</button>
      {erro && <p role="alert" className="text-sm text-destructive sm:col-span-3">{erro}</p>}
    </form>
  )
}
