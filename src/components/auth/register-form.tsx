'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { lembrarPlanoDaVitrine } from '@/lib/plano-vitrine'
import { GoogleButton } from '@/components/auth/google-button'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // `?erro=google`: o /auth/callback volta para cá se o Google falhar/for cancelado.
  const [erro, setErro] = useState<string | null>(() =>
    searchParams.get('erro') === 'google' ? 'Não foi possível criar a conta com o Google. Tente novamente.' : null,
  )
  const [aviso, setAviso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  // Plano escolhido no card de preços, para pré-selecionar no primeiro pedido.
  const plano = searchParams.get('plano')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCarregando(true)
    setErro(null)

    const form = new FormData(event.currentTarget)
    // Antes do signUp: com confirmação de e-mail o link volta sem `?plano`.
    lembrarPlanoDaVitrine(plano)

    try {
      if (DEMO_MODE) {
        const next = plano ? `/dashboard/novo-pedido?plano=${plano}` : '/dashboard'
        form.set('next', next)
        // Cadastro público é sempre o fluxo do fotógrafo/estúdio (seção 16).
        form.set('role', 'fotografo')
        await fetch('/auth/demo-login', { method: 'POST', body: form })
        router.replace(next)
        router.refresh()
        return
      }

      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email: String(form.get('email')),
        password: String(form.get('password')),
        options: {
          // Lido pelo trigger handle_new_user() para popular public.profiles
          // (e public.fotografos, já que o cadastro público é sempre fotógrafo).
          data: {
            role: 'fotografo',
            estudio: String(form.get('nome_estudio')),
            nome_completo: String(form.get('nome_contato') || form.get('nome_estudio')),
            telefone: String(form.get('telefone') ?? ''),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/novo-pedido`,
        },
      })

      if (error) {
        setErro(error.message)
        setCarregando(false)
        return
      }

      // Sem sessão imediata = confirmação de e-mail está ligada no projeto.
      if (!data.session) {
        setAviso('Enviamos um link de confirmação para o seu e-mail.')
        setCarregando(false)
        return
      }

      router.replace(plano ? `/dashboard/novo-pedido?plano=${plano}` : '/dashboard')
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
      {/* A ida ao Google perde o estado da página: o plano vai na URL de volta. */}
      <GoogleButton
        modo="cadastro"
        next={plano ? `/dashboard/novo-pedido?plano=${encodeURIComponent(plano)}` : '/dashboard/novo-pedido'}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        {DEMO_MODE ? (
          <p className="rounded-lg bg-[#F5F5F5] p-3 text-xs text-[#595959]">
            Modo de demonstração: nenhum Supabase configurado ainda. Qualquer e-mail e senha
            funcionam para criar a sessão e navegar pelo painel.
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="nome_estudio">Nome do estúdio</Label>
          <Input id="nome_estudio" name="nome_estudio" required minLength={2} maxLength={120} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nome_contato">Seu nome</Label>
            <Input id="nome_contato" name="nome_contato" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">WhatsApp</Label>
            <Input id="telefone" name="telefone" type="tel" placeholder="(11) 90000-0000" />
          </div>
        </div>

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
            autoComplete="new-password"
            required={!DEMO_MODE}
            minLength={DEMO_MODE ? undefined : 8}
          />
          {!DEMO_MODE ? (
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
          ) : null}
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm text-emerald-700">
            {aviso}
          </p>
        ) : null}

        <Button type="submit" variant="brand" className="w-full" disabled={carregando}>
          {carregando ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </div>
  )
}
