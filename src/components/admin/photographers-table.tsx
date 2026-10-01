'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import type { Photographer } from '@/types/platform'

/** Módulo Fotógrafos (seção 6) — parceiros profissionais da plataforma. */
export function PhotographersTable({ photographers }: { photographers: Photographer[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | Photographer['status']>('todos')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return photographers.filter((p) => {
      const matchesSearch =
        !term ||
        p.nome.toLowerCase().includes(term) ||
        p.estudio.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'todos' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [photographers, search, statusFilter])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fotógrafos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {photographers.length} {photographers.length === 1 ? 'parceiro cadastrado' : 'parceiros cadastrados'}.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, estúdio ou e-mail…"
          className="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum fotógrafo encontrado" description="Ajuste os filtros para ver outros resultados." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Estúdio</th>
                <th scope="col" className="px-4 py-3 font-semibold">Contato</th>
                <th scope="col" className="px-4 py-3 font-semibold">Cidade</th>
                <th scope="col" className="px-4 py-3 font-semibold">Projetos</th>
                <th scope="col" className="px-4 py-3 font-semibold">Último acesso</th>
                <th scope="col" className="px-4 py-3 font-semibold">Plano</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">
                    {p.estudio}
                    <br />
                    <span className="font-normal text-muted-foreground">{p.nome}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.email}
                    <br />
                    {p.telefone}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.cidade}</td>
                  <td className="px-4 py-3">
                    {p.projetosCount} <span className="text-muted-foreground">({p.projetosAtivos} ativos)</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.ultimoAcessoEm)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.plano ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === 'ativo'
                          ? 'inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800'
                          : 'inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground'
                      }
                    >
                      {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/fotografos/${p.id}`}>Ver perfil</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
