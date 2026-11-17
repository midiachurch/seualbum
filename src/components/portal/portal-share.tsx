'use client'
import { useEffect, useState, useTransition } from 'react'
import { Copy, ShieldCheck, Link2 } from 'lucide-react'
import { criarAcessoPortal, revogarAcessoPortal, consultarEstadoPortal } from '@/lib/actions/portal'
export function PortalShare({ projetoId }: { projetoId: string }) {
  const [pending, start] = useTransition(),
    [access, setAccess] = useState<{ caminho: string; codigo: string } | null>(null)
  const [state, setState] = useState('carregando'),
    [expiry, setExpiry] = useState<string | null>(null),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState<'renovar' | 'revogar' | null>(null)
  useEffect(() => {
    let active = true
    consultarEstadoPortal(projetoId).then((r) => {
      if (active) {
        setState(r.ok ? r.estado : 'indisponivel')
        if (r.ok) setExpiry(r.expiraEm)
      }
    })
    return () => {
      active = false
    }
  }, [projetoId])
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Copiado.')
    } catch {
      setMessage('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }
  function generate() {
    start(async () => {
      const r = await criarAcessoPortal(projetoId)
      if (r.ok) {
        setAccess(r)
        setState('ativo')
        setExpiry(null)
        setConfirm(null)
        setMessage(
          'Novo acesso criado. Todos os links anteriores foram substituídos. Envie o link e o código por canais separados.',
        )
      } else setMessage(r.erro)
    })
  }
  const labels: Record<string, string> = {
    carregando: 'Consultando acesso…',
    nao_criado: 'Acesso ainda não criado',
    ativo: 'Acesso ativo',
    revogado: 'Acesso revogado',
    expirado: 'Acesso expirado',
    indisponivel: 'Não foi possível consultar o acesso',
  }
  return (
    <section className="space-y-6 rounded-2xl border bg-white p-5 sm:p-8" aria-labelledby="compartilhar">
      <header>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <ShieldCheck size={16} aria-hidden />
          Somente quem você convidar
        </p>
        <h2 id="compartilhar" className="mt-3 text-2xl font-semibold">
          Compartilhar galeria
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
          Envie o link e o código ao cliente. Ele entra, escolhe as favoritas e entrega a seleção sem precisar
          de cadastro.
        </p>
      </header>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="font-medium">{labels[state]}</p>
        {expiry && (
          <p className="mt-1 text-sm text-slate-600">
            Validade até {new Date(expiry).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.
          </p>
        )}
        {(state === 'revogado' || state === 'expirado') && (
          <p className="mt-2 text-sm text-slate-600">
            O cliente precisa de um novo link e código para entrar.
          </p>
        )}
        {state === 'ativo' && !access && (
          <p className="mt-2 text-sm text-slate-600">
            O código e o link não são recuperados após sair desta tela. Se não os guardou, gere um novo
            acesso. O anterior será substituído.
          </p>
        )}
      </div>
      {access && (
        <div className="space-y-5 rounded-xl border p-4 sm:p-5">
          <div>
            <label htmlFor="link-portal" className="text-sm font-medium">
              Link privado
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="link-portal"
                readOnly
                value={
                  typeof window !== 'undefined'
                    ? new URL(access.caminho, window.location.origin).href
                    : access.caminho
                }
                className="min-h-12 min-w-0 flex-1 rounded-lg border bg-slate-50 px-3 text-sm"
              />
              <button
                aria-label="Copiar link"
                onClick={() => copy(new URL(access.caminho, window.location.origin).href)}
                className="min-h-12 rounded-lg border px-4"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="codigo-portal" className="text-sm font-medium">
              Código de acesso
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="codigo-portal"
                readOnly
                value={access.codigo}
                className="min-h-12 min-w-0 flex-1 rounded-lg border bg-slate-50 px-3 font-mono text-xl tracking-widest"
              />
              <button
                aria-label="Copiar código"
                onClick={() => copy(access.codigo)}
                className="min-h-12 rounded-lg border px-4"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Guarde estas informações antes de sair. O código é exibido apenas agora.
          </p>
          <a
            href={access.caminho}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline"
          >
            <Link2 size={16} />
            Abrir portal do cliente
          </a>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          className="min-h-12 rounded-xl bg-primary px-5 font-medium text-white"
          disabled={pending || state === 'carregando'}
          onClick={() => {
            if (state === 'ativo') setConfirm('renovar')
            else generate()
          }}
        >
          {pending ? 'Aguarde…' : state === 'ativo' ? 'Gerar novo acesso' : 'Gerar link e código'}
        </button>
        {state === 'ativo' && (
          <button
            className="min-h-12 rounded-xl border px-5 text-red-700"
            disabled={pending}
            onClick={() => setConfirm('revogar')}
          >
            Revogar acesso
          </button>
        )}
      </div>
      {confirm && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-950">
            {confirm === 'renovar'
              ? 'Substituir o acesso? O link e o código anteriores deixarão de funcionar.'
              : 'Revogar o acesso? O link atual e suas sessões deixarão de permitir novas operações.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={pending}
              className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm text-white"
              onClick={() => {
                if (confirm === 'renovar') generate()
                else
                  start(async () => {
                    const r = await revogarAcessoPortal(projetoId)
                    if (r.ok) {
                      setAccess(null)
                      setState('revogado')
                      setConfirm(null)
                      setMessage('Acesso revogado. As sessões anteriores não podem fazer novas operações.')
                    } else setMessage(r.erro)
                  })
              }}
            >
              Confirmar {confirm === 'renovar' ? 'substituição' : 'revogação'}
            </button>
            <button
              disabled={pending}
              className="min-h-11 px-3 text-sm underline"
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      <p className="text-xs leading-relaxed text-slate-600">
        Acesso por 30 dias, sessões de até 8 horas. Ao revogar, novas operações são negadas; imagens já
        abertas podem permanecer disponíveis por até 60 segundos.
      </p>
      <p role="status" className="text-sm">
        {message}
      </p>
    </section>
  )
}
