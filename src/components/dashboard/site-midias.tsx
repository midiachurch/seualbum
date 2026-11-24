'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { removerMidiaSite } from '@/lib/actions/sites'
import { MIMES_MIDIA_SITE, TAMANHO_MAXIMO_MIDIA_SITE } from '@/lib/sites/chaves'
import type { MidiaListaUI } from '@/lib/sites/ui'
import { uploadMidiaSite } from '@/lib/upload-site-midia'

/** Biblioteca de imagens públicas do site: só o que está aqui pode entrar nos blocos. */
export function SiteMidias({ organizacaoId, midias, podeEditar, aoMudar }: { organizacaoId: string; midias: MidiaListaUI[]; podeEditar: boolean; aoMudar: () => void }) {
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendente, iniciar] = useTransition()
  const campo = useRef<HTMLInputElement>(null)

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setErro(''); setAviso(''); setEnviando(true)
    let ok = 0
    for (const f of Array.from(arquivos)) {
      if (!MIMES_MIDIA_SITE.has(f.type)) { setErro(`${f.name}: use JPG, PNG ou WebP.`); continue }
      if (f.size > TAMANHO_MAXIMO_MIDIA_SITE) { setErro(`${f.name}: maior que 10 MB.`); continue }
      try { await uploadMidiaSite(organizacaoId, f); ok++ } catch (e) { setErro(e instanceof Error ? e.message : 'Falha no envio.') }
    }
    setEnviando(false)
    if (campo.current) campo.current.value = ''
    if (ok) { setAviso(`${ok} imagem(ns) enviada(s).`); aoMudar() }
  }

  return (
    <section className="space-y-3 rounded-2xl border p-5" aria-labelledby="site-midias-t">
      <div>
        <h3 id="site-midias-t" className="text-lg font-semibold">Biblioteca de imagens do site</h3>
        <p className="text-sm text-muted-foreground">Imagens públicas (JPG, PNG ou WebP, até 10 MB). Envie versões otimizadas: originais privados dos clientes nunca vão para o site.</p>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
      {podeEditar && (
        <label className="grid gap-1 text-sm">Enviar imagens
          <input ref={campo} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={enviando} onChange={(e) => void enviar(e.target.files)} className="min-h-11 rounded-lg border px-3 py-2" />
        </label>
      )}
      {enviando && <p role="status" className="text-sm">Enviando…</p>}
      {midias.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma imagem ainda.</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {midias.map((m) => (
            <li key={m.id} className="space-y-1 text-xs">
              {m.url ? <Image src={m.url} alt="" width={160} height={160} unoptimized className="aspect-square w-full rounded-lg object-cover" /> : <div className="aspect-square w-full rounded-lg bg-muted" />}
              <p className="truncate" title={m.nome}>{m.nome}</p>
              {podeEditar && (
                <button type="button" disabled={pendente} className="min-h-11 w-full rounded-lg border px-2 disabled:opacity-50" aria-label={`Remover imagem ${m.nome}`}
                  onClick={() => { setErro(''); setAviso(''); iniciar(async () => { const r = await removerMidiaSite(m.id); if (!r.ok) setErro(r.erro); else aoMudar() }) }}>Remover</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
