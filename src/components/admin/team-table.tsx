'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toggleTeamMemberStatus } from '@/lib/actions/projetos'
import { createTeamAccount } from '@/lib/actions/contas'
import { PLATFORM_ROLE_LABEL, type PlatformRole, type TeamMember } from '@/types/platform'
import { formatDate } from '@/lib/utils'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

const ASSIGNABLE_ROLES: PlatformRole[] = ['admin', 'gestor', 'operador', 'designer']

interface FormState {
  nome: string
  email: string
  role: PlatformRole
}

const EMPTY_FORM: FormState = { nome: '', email: '', role: 'operador' }

/**
 * Módulo Equipe (seção 18) — usuários internos e seus papéis. `canManage`
 * vem da matriz de permissões: o gestor só visualiza, só o admin edita.
 */
export function TeamTable({
  initialMembers,
  canManage,
}: {
  initialMembers: TeamMember[]
  canManage: boolean
}) {
  const [members, setMembers] = useState(initialMembers)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null)

  async function save() {
    if (!form.nome.trim() || !form.email.trim()) return
    const member: TeamMember = {
      id: `eq-novo-${Date.now()}`,
      nome: form.nome,
      email: form.email,
      role: form.role,
      status: 'ativo',
      createdAt: new Date().toISOString(),
    }

    if (DEMO_MODE) {
      setMembers((prev) => [member, ...prev])
      setForm(EMPTY_FORM)
      setAdding(false)
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      const { tempPassword } = await createTeamAccount({
        email: form.email,
        nomeCompleto: form.nome,
        role: form.role as 'admin' | 'gestor' | 'operador' | 'designer',
      })
      setMembers((prev) => [member, ...prev])
      setCredencial({ email: form.email, senha: tempPassword })
      setForm(EMPTY_FORM)
      setAdding(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a conta.')
    } finally {
      setSalvando(false)
    }
  }

  function toggleStatus(id: string) {
    const novoStatus = members.find((m) => m.id === id)?.status === 'ativo' ? 'inativo' : 'ativo'
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: novoStatus } : m)))
    if (!DEMO_MODE) toggleTeamMemberStatus(id, novoStatus).catch(() => {})
  }

  function changeRole(id: string, role: PlatformRole) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? 'usuário interno' : 'usuários internos'}.
          </p>
        </div>
        {canManage && !adding ? (
          <Button size="sm" variant="brand" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo usuário
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Novo usuário</h2>
            <Button variant="ghost" size="icon" onClick={() => setAdding(false)} aria-label="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-nome">Nome</Label>
              <Input id="eq-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-email">E-mail</Label>
              <Input id="eq-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-role">Função</Label>
              <select
                id="eq-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PlatformRole }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {PLATFORM_ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>
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
              {salvando ? 'Criando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      ) : null}

      {credencial ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Conta criada para {credencial.email}</p>
          <p className="mt-1">
            Senha temporária: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{credencial.senha}</code> — repasse à
            pessoa por um canal seguro (ela deve trocá-la no primeiro acesso).
          </p>
          <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setCredencial(null)}>
            Fechar
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
              <th scope="col" className="px-4 py-3 font-semibold">E-mail</th>
              <th scope="col" className="px-4 py-3 font-semibold">Função</th>
              <th scope="col" className="px-4 py-3 font-semibold">Desde</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 font-medium">{member.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <select
                      value={member.role}
                      onChange={(e) => changeRole(member.id, e.target.value as PlatformRole)}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {PLATFORM_ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    PLATFORM_ROLE_LABEL[member.role]
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(member.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {canManage ? (
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(member.id)}>
                      {member.status === 'ativo' ? 'Desativar' : 'Reativar'}
                    </Button>
                  ) : (
                    <span
                      className={
                        member.status === 'ativo'
                          ? 'inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800'
                          : 'inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground'
                      }
                    >
                      {member.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
