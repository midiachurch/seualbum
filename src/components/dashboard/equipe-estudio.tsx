'use client'

import { useState, useTransition } from 'react'
import { adicionarMembroEquipe, removerMembroEquipe } from '@/lib/actions/equipe'
import { PAPEIS_CONVITE, PAPEIS_EQUIPE } from '@/lib/equipe-papeis'
import type { EquipeMembroRow, PapelOrganizacao } from '@/types/database'

type Props = { organizacaoId: string; nome: string; meuPapel: PapelOrganizacao; meuId: string; membros: EquipeMembroRow[] }

export function EquipeEstudio({ organizacaoId, nome, meuPapel, meuId, membros }: Props) {
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<(typeof PAPEIS_CONVITE)[number]>('editor')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const podeGerir = meuPapel === 'dono' || meuPapel === 'admin'
  const papeisPermitidos = meuPapel === 'dono' ? PAPEIS_CONVITE : PAPEIS_CONVITE.filter(p => p !== 'admin')
  const podeRemover = (m: EquipeMembroRow) => m.papel !== 'dono' && (m.user_id === meuId || meuPapel === 'dono' || (meuPapel === 'admin' && m.papel !== 'admin'))
  return <section className="space-y-4 rounded-2xl border p-5" aria-label={`Equipe de ${nome}`}>
    <div>
      <h2 className="text-xl font-semibold">{nome}</h2>
      <p className="text-sm text-muted-foreground">Seu papel: {PAPEIS_EQUIPE[meuPapel].rotulo}. {PAPEIS_EQUIPE[meuPapel].descricao}</p>
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    <ul className="divide-y rounded-xl border">
      {membros.map(m => <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <p className="font-medium">{m.nome}{m.user_id === meuId ? ' (você)' : ''}</p>
          <p className="text-sm text-muted-foreground">{m.email} · {PAPEIS_EQUIPE[m.papel].rotulo}</p>
        </div>
        {podeRemover(m) && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
          setErro(''); setAviso('')
          iniciar(async () => {
            const r = await removerMembroEquipe(organizacaoId, m.user_id)
            if (!r.ok) setErro(r.erro)
            else setAviso(m.user_id === meuId ? 'Você saiu da equipe.' : `${m.nome} foi removido(a) da equipe.`)
          })
        }}>{m.user_id === meuId ? 'Sair da equipe' : 'Remover'}</button>}
      </li>)}
    </ul>
    {podeGerir && <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" onSubmit={e => {
      e.preventDefault(); setErro(''); setAviso('')
      iniciar(async () => {
        const r = await adicionarMembroEquipe(organizacaoId, email, papel)
        if (!r.ok) setErro(r.erro)
        else { setEmail(''); setAviso('Pessoa adicionada à equipe.') }
      })
    }}>
      <label className="grid gap-1 text-sm">E-mail de quem já tem conta
        <input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 rounded-lg border px-3" autoComplete="off" />
      </label>
      <label className="grid gap-1 text-sm">Papel
        <select value={papel} onChange={e => setPapel(e.target.value as typeof papel)} className="min-h-11 rounded-lg border px-3">
          {papeisPermitidos.map(p => <option key={p} value={p}>{PAPEIS_EQUIPE[p].rotulo}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">{pendente ? 'Salvando…' : 'Adicionar'}</button>
    </form>}
    <p className="text-xs text-muted-foreground">Clientes finais não fazem parte da equipe: eles acessam apenas as galerias que você compartilha.</p>
  </section>
}
