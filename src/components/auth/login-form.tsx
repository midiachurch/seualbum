'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { GoogleButton } from '@/components/auth/google-button'
import { PLATFORM_ROLE_LABEL, rotaDoPapel, type PlatformRole } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

const DEMO_ROLES: PlatformRole[] = ['admin', 'gestor', 'operador', 'designer', 'fotografo', 'cliente']

/** Cliente -> /cliente, equipe (admin/gestor/operador) -> /admin, fotógrafo -> /dashboard. */
function destinoPorRole(role: PlatformRole) {
  return rotaDoPapel(role)
}

/** `?erro=` que o /auth/callback devolve quando o link ou o Google falham. */
const ERROS_DO_CALLBACK: Record<string, string> = {
  codigo_ausente: 'O login não foi concluído. Tente novamente.',
  link_invalido: 'Link expirado ou inválido. Entre novamente.',
  google: 'Não foi possível entrar com o Google. Tente novamente.',
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [erro, setErro] = useState<string | null>(
    () => ERROS_DO_CALLBACK[searchParams.get('erro') ?? ''] ?? null,
  )
  const [carregando, setCarregando] = useState(false)

  // Destino original preservado pelo middleware (ex.: um link direto para
  // /admin/projetos/123 que exigiu login). Só aceitamos caminhos internos —
  // um `next` absoluto viraria open redirect. Sem isso, o destino é decidido
  // pelo papel do usuário (ver `destinoPorRole`), não por um `/dashboard` fixo.
  const nextParam = searchParams.get('next')
  const explicitNext = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCarregando(true)
    setErro(null)

    const form = new FormData(event.currentTarget)

    try {
      if (DEMO_MODE) {
        const role = (String(form.get('role') ?? 'admin') as PlatformRole) || 'admin'
        const next = explicitNext ?? destinoPorRole(role)
        form.set('next', next)
        await fetch('/auth/demo-login', { method: 'POST', body: form })
        router.replace(next)
        router.refresh()
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(form.get('email')),
        password: String(form.get('password')),
      })

      if (error || !data.user) {
        setErro('E-mail ou senha inválidos.')
        setCarregando(false)
        return
      }

      let next = explicitNext
      if (!next) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        next = destinoPorRole((profile?.role as PlatformRole | undefined) ?? 'fotografo')
      }

      // refresh() força os Server Components a relerem a sessão recém-criada.
      router.replace(next)
      router.refresh()
    } catch {
      // Ex.: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes — sem isso o cliente
      // nem chega a fazer a requisição, então sem catch o botão travaria.
      setErro('Não foi possível conectar ao servidor. Verifique a configuração do projeto.')
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-4">
      <GoogleButton modo="login" next={explicitNext} />
      <form onSubmit={onSubmit} className="space-y-4">
        {DEMO_MODE ? (
          <>
            <p className="rounded-lg bg-[#F5F5F5] p-3 text-xs text-[#595959]">
              Modo de demonstração: nenhum Supabase configurado ainda. Qualquer e-mail e senha
              funcionam para entrar — escolha o perfil que quer visualizar.
            </p>
            <div className="space-y-2">
              <Label htmlFor="role">Entrar como</Label>
              <select
                id="role"
                name="role"
                defaultValue="admin"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {DEMO_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {PLATFORM_ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required={!DEMO_MODE}
          />
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        <Button type="submit" variant="brand" className="w-full" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
