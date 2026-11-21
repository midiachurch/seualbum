'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { comentarProvaPortal } from '@/lib/actions/portal'
import type { PortalProva } from '@/lib/portal/prova'

export function PortalProof({ link, prova }: { link: string; prova: PortalProva }) {
  const router = useRouter()
  const [lamina, setLamina] = useState(prova.laminas[0]?.id ?? '')
  const [texto, setTexto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()
  const tentativa = useRef<{ payload: string; chave: string } | null>(null)
  function enviar(tipo: 'comentario' | 'ajustes') {
    const selecionada = tipo === 'comentario' ? lamina : null
    const payload = JSON.stringify([prova.id, selecionada, tipo, texto.trim()])
    if (tentativa.current?.payload !== payload) tentativa.current = { payload, chave: crypto.randomUUID() }
    const chave = tentativa.current.chave
    iniciar(async () => {
      const resultado = await comentarProvaPortal(link, prova.id, selecionada, tipo, texto, chave)
      setMensagem(resultado.ok ? (tipo === 'ajustes' ? 'Solicitação de ajustes enviada ao fotógrafo.' : 'Comentário enviado ao fotógrafo.') : resultado.erro)
      if (resultado.ok) { tentativa.current = null; setTexto(''); setConfirmando(false); router.refresh() }
    })
  }
  return <section className="mx-auto mb-12 max-w-6xl space-y-5 rounded-2xl border p-5" aria-labelledby="prova-titulo">
    <header><h2 id="prova-titulo" className="text-2xl font-semibold">Prova do álbum · versão {prova.numero}</h2><p className="mt-2 text-sm text-muted-foreground">{prova.aberta ? 'Revise as lâminas e envie seus comentários ao fotógrafo.' : 'Esta versão está disponível para consulta. Aguarde uma nova liberação para revisar.'}</p></header>
    {prova.laminas.length ? <><label className="block" htmlFor="prova-lamina">Lâmina</label><select id="prova-lamina" value={lamina} onChange={(e) => setLamina(e.target.value)} className="min-h-11 rounded-lg border bg-background px-4">{prova.laminas.map((l) => <option key={l.id} value={l.id}>Lâmina {l.ordem}</option>)}</select>
      {/* eslint-disable-next-line @next/next/no-img-element -- rota revalida capacidade antes de assinar mídia privada. */}
      <img key={lamina} src={`/portal/${link}/lamina/${lamina}`} alt={`Prova da lâmina ${prova.laminas.find((l) => l.id === lamina)?.ordem ?? ''}`} className="max-h-[70vh] w-full rounded-xl bg-secondary object-contain" />
      <p className="text-sm text-muted-foreground">Se a imagem não carregar, contate o fotógrafo para verificar a disponibilidade do arquivo.</p></> : <p>As lâminas desta versão ainda não estão disponíveis.</p>}
    {prova.aberta && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); enviar('comentario') }}><label className="block" htmlFor="prova-comentario">Comentário sobre a lâmina</label><textarea id="prova-comentario" value={texto} onChange={(e) => setTexto(e.target.value)} required maxLength={2000} rows={4} className="w-full rounded-xl border bg-background p-3" /><div className="flex flex-wrap gap-3"><button disabled={pendente || !lamina || !texto.trim()} className="min-h-11 rounded-full bg-primary px-5 text-primary-foreground">Enviar comentário</button><button type="button" disabled={pendente || !texto.trim()} onClick={() => setConfirmando(true)} className="min-h-11 rounded-full border px-5">Solicitar ajustes nesta versão</button></div>{confirmando && <div className="space-y-3 rounded-xl bg-secondary p-4"><p>Enviar o texto como solicitação de ajustes e encerrar a revisão desta versão?</p><button type="button" disabled={pendente} onClick={() => enviar('ajustes')} className="min-h-11 rounded-full border px-5">Confirmar solicitação de ajustes</button><button type="button" disabled={pendente} onClick={() => setConfirmando(false)} className="ml-3 min-h-11 underline">Continuar revisando</button></div>}</form>}
    <p role="status">{mensagem}</p>
    <h3 className="text-lg font-semibold">Comentários enviados pelo portal</h3><ol className="space-y-3">{prova.comentarios.map((c) => <li key={c.id} className="rounded-xl bg-secondary p-4"><p className="whitespace-pre-wrap">{c.texto}</p><p className="mt-2 text-sm text-muted-foreground">{c.tipo === 'ajustes' ? 'Solicitação de ajustes' : `Lâmina ${prova.laminas.find((l) => l.id === c.lamina_id)?.ordem ?? 'da versão'}`} · Cliente pelo portal · {new Date(c.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></li>)}</ol>
  </section>
}
