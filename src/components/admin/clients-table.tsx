'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { createClienteRecord, createClientAccount } from '@/lib/actions/contas'
import { formatDate } from '@/lib/utils'
import type { Client, Photographer } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

interface FormState {
  nome: string
  email: string
  telefone: string
  cidade: string
  estado: string
  origem: string
  fotografoResponsavelId: string
  observacoesInternas: string
  criarAcessoPortal: boolean
}

const EMPTY_FORM: FormState = {
  nome: '',
  email: '',
  telefone: '',
  cidade: '',
  estado: '',
  origem: '',
  fotografoResponsavelId: '',
  observacoesInternas: '',
  criarAcessoPortal: false,
}

/**
 * Módulo Clientes (seção 5). Prévia funcional com estado local — cadastros
 * feitos aqui não têm página de perfil própria ainda (essa é preenchida só
 * pelos clientes fictícios da seed), até existir persistência real.
 */
export function ClientsTable({
  initialClients,
  photographers,
}: {
  initialClients: Client[]
  photographers: Photographer[]
}) {
  const [clients, setClients] = useState(initialClients)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | Client['status']>('todos')
  const [fotografoFilter, setFotografoFilter] = useState<'todos' | string>('todos')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null)

  const photographerName = (id: string | null) =>
    photographers.find((p) => p.id === id)?.estudio ?? '—'

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return clients.filter((client) => {
      const matchesSearch =
        !term ||
        client.nome.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        client.telefone.includes(term)
      const matchesStatus = statusFilter === 'todos' || client.status === statusFilter
      const matchesFotografo =
        fotografoFilter === 'todos' || client.fotografoResponsavelId === fotografoFilter
      return matchesSearch && matchesStatus && matchesFotografo
    })
  }, [clients, search, statusFilter, fotografoFilter])

  async function save() {
    if (!form.nome.trim() || !form.email.trim()) return
    if (!DEMO_MODE && !form.fotografoResponsavelId) {
      setErro('Selecione o fotógrafo responsável.')
      return
    }

    const newClient: Client = {
      id: `cli-novo-${Date.now()}`,
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      cidade: form.cidade,
      estado: form.estado,
      origem: form.origem || 'Cadastro manual',
      fotografoResponsavelId: form.fotografoResponsavelId || null,
      projetosCount: 0,
      ultimoProjetoEm: null,
      status: 'ativo',
      createdAt: new Date().toISOString(),
      observacoesInternas: form.observacoesInternas || null,
    }

    if (DEMO_MODE) {
      setClients((prev) => [newClient, ...prev])
      setForm(EMPTY_FORM)
      setAdding(false)
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      const clienteId = await createClienteRecord({
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        cidade: form.cidade,
        estado: form.estado,
        origem: form.origem,
        fotografoId: form.fotografoResponsavelId,
        observacoesInternas: form.observacoesInternas || null,
      })
      setClients((prev) => [{ ...newClient, id: clienteId }, ...prev])

      if (form.criarAcessoPortal) {
        const { tempPassword } = await createClientAccount({ email: form.email, nomeCompleto: form.nome, linkClienteId: clienteId })
        setCredencial({ email: form.email, senha: tempPassword })
      }

      setForm(EMPTY_FORM)
      setAdding(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o cliente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}.
          </p>
        </div>
        {!adding ? (
          <Button size="sm" variant="brand" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo cliente
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Novo cliente</h2>
            <Button variant="ghost" size="icon" onClick={() => setAdding(false)} aria-label="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cli-nome">Nome completo</Label>
              <Input id="cli-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-email">E-mail</Label>
              <Input id="cli-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-telefone">Telefone / WhatsApp</Label>
              <Input id="cli-telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-origem">Origem</Label>
              <Input id="cli-origem" value={form.origem} onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))} placeholder="Indicação, Instagram, Site…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-cidade">Cidade</Label>
              <Input id="cli-cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-estado">Estado</Label>
              <Input id="cli-estado" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} placeholder="UF" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cli-fotografo">Fotógrafo responsável</Label>
              <select
                id="cli-fotografo"
                value={form.fotografoResponsavelId}
                onChange={(e) => setForm((f) => ({ ...f, fotografoResponsavelId: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhum</option>
                {photographers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.estudio}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cli-obs">Observações internas</Label>
              <Input
                id="cli-obs"
                value={form.observacoesInternas}
                onChange={(e) => setForm((f) => ({ ...f, observacoesInternas: e.target.value }))}
                placeholder="Visível só para a equipe"
              />
            </div>
            {!DEMO_MODE ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.criarAcessoPortal}
                  onChange={(e) => setForm((f) => ({ ...f, criarAcessoPortal: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Criar acesso ao portal do cliente (gera login e senha temporária)
              </label>
            ) : null}
          </div>
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="brand" onClick={save} disabled={!form.nome.trim() || !form.email.trim() || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      ) : null}

      {credencial ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Acesso ao portal criado para {credencial.email}</p>
          <p className="mt-1">
            Senha temporária: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{credencial.senha}</code> — repasse ao
            cliente por um canal seguro (ele deve trocá-la no primeiro acesso).
          </p>
          <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setCredencial(null)}>
            Fechar
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone…"
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
        <select
          value={fotografoFilter}
          onChange={(e) => setFotografoFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="todos">Todos os fotógrafos</option>
          {photographers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.estudio}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Ajuste os filtros ou cadastre o primeiro cliente para começar."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
                <th scope="col" className="px-4 py-3 font-semibold">Contato</th>
                <th scope="col" className="px-4 py-3 font-semibold">Cidade/UF</th>
                <th scope="col" className="px-4 py-3 font-semibold">Fotógrafo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Projetos</th>
                <th scope="col" className="px-4 py-3 font-semibold">Último projeto</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3 font-medium">{client.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {client.email}
                    <br />
                    {client.telefone}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {client.cidade}/{client.estado}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {photographerName(client.fotografoResponsavelId)}
                  </td>
                  <td className="px-4 py-3">{client.projetosCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(client.ultimoProjetoEm)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        client.status === 'ativo'
                          ? 'inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800'
                          : 'inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground'
                      }
                    >
                      {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/clientes/${client.id}`}>Ver perfil</Link>
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
