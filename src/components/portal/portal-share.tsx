'use client'
import { useState, useTransition } from 'react'
import { criarAcessoPortal, revogarAcessoPortal } from '@/lib/actions/portal'
export function PortalShare({ projetoId }: { projetoId: string }) {
  const [pendente, iniciar] = useTransition()
  const [acesso, setAcesso] = useState<{ caminho: string; codigo: string } | null>(null)
  const [mensagem, setMensagem] = useState('')
  return <section className="space-y-4 rounded-2xl border p-6">
    <h1 className="text-2xl font-semibold">Compartilhar galeria privada</h1>
    <p className="text-sm text-muted-foreground">O cliente entra com link e código, sem criar conta. Um novo acesso revoga os links anteriores. Link válido por 30 dias; sessão por até 8 horas.</p>
    <button className="min-h-11 rounded-full bg-primary px-5 text-primary-foreground" disabled={pendente} onClick={() => iniciar(async () => {
      const r = await criarAcessoPortal(projetoId)
      if (r.ok) { setAcesso(r); setMensagem('Acesso criado. Envie o link e o código ao cliente por canais separados.') } else setMensagem(r.erro)
    })}>Gerar ou renovar acesso</button>
    <button className="ml-3 min-h-11 rounded-full border px-5" disabled={pendente} onClick={() => iniciar(async () => {
      const r = await revogarAcessoPortal(projetoId)
      setMensagem(r.ok ? 'Acesso revogado. As sessões anteriores não podem fazer novas operações.' : r.erro)
      if (r.ok) setAcesso(null)
    })}>Revogar acesso</button>
    {acesso && <div className="space-y-2 rounded-xl bg-secondary p-4"><p className="break-all">Link: <a className="underline" href={acesso.caminho}>{acesso.caminho}</a></p><p>Código: <strong>{acesso.codigo}</strong></p><p className="text-xs">Este código é exibido somente agora. Guarde-o antes de sair.</p></div>}
    <p role="status">{mensagem}</p>
  </section>
}
