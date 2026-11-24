'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { criarHoldPublico } from '@/lib/actions/agendar'
import { formatarReais, nomeDoFuso, rotuloDataHora, type GrupoDeSlots } from '@/lib/agenda/formatacao'
import type { AgendaRecursoPublico } from '@/types/database'

type Props = { recurso: AgendaRecursoPublico; grupos: GrupoDeSlots[] }

export function AgendarPublico({ recurso, grupos }: Props) {
  const router = useRouter()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  // Um id por abertura do formulário: duplo clique ou retry reaproveitam a mesma reserva.
  const [tentativa] = useState(() => crypto.randomUUID())

  if (!grupos.length) {
    return <p role="status" className="rounded-2xl border p-5 text-sm">Não há horários livres neste período. Veja outras datas abaixo ou fale com o estúdio.</p>
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Duração de {recurso.duracao_min} min. Horários no fuso de {nomeDoFuso(recurso.fuso)}.
        {recurso.sinal_centavos ? ` Sinal de ${formatarReais(recurso.sinal_centavos)} (simulado nesta versão).` : ''}
      </p>
      <div className="space-y-4">
        {grupos.map(g => (
          <section key={g.dia} aria-label={g.rotulo}>
            <h2 className="mb-2 text-sm font-medium capitalize">{g.rotulo}</h2>
            <ul className="flex flex-wrap gap-2">
              {g.slots.map(s => (
                <li key={s.inicio}>
                  <button type="button" aria-pressed={escolhido === s.inicio} onClick={() => { setEscolhido(s.inicio); setErro('') }}
                    className={`min-h-11 min-w-16 rounded-lg border px-3 text-sm ${escolhido === s.inicio ? 'bg-foreground text-background' : ''}`}>{s.hora}</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {escolhido && (
        <form className="space-y-3 rounded-2xl border p-5" onSubmit={e => {
          e.preventDefault(); setErro('')
          iniciar(async () => {
            const r = await criarHoldPublico({ slug: recurso.slug, inicio: escolhido, nome, email, telefone, tentativa })
            if (!r.ok) { setErro(r.erro); router.refresh(); return }
            router.push(`/agendar/${recurso.slug}/reserva/${r.id}`)
          })
        }}>
          <p className="text-sm">Horário escolhido: <strong>{rotuloDataHora(escolhido, recurso.fuso)}</strong>. Seguramos por 10 minutos para você confirmar.</p>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <label className="grid gap-1 text-sm">Nome
            <input required minLength={2} maxLength={120} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" className="min-h-11 rounded-lg border px-3" />
          </label>
          <label className="grid gap-1 text-sm">E-mail
            <input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="min-h-11 rounded-lg border px-3" />
          </label>
          <label className="grid gap-1 text-sm">Telefone (opcional)
            <input type="tel" maxLength={30} value={telefone} onChange={e => setTelefone(e.target.value)} autoComplete="tel" className="min-h-11 rounded-lg border px-3" />
          </label>
          <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-50">{pendente ? 'Reservando…' : 'Reservar este horário'}</button>
        </form>
      )}
    </div>
  )
}
