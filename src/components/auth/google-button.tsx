'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

type Props = {
  /** 'cadastro' = /auth/register: a conta nasce como fotógrafo/estúdio. */
  modo: 'login' | 'cadastro'
  /** Caminho interno para depois do login; sem ele o callback decide pelo papel. */
  next?: string | null
}

export function GoogleButton({ modo, next }: Props) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (DEMO_MODE) return null

  async function entrar() {
    setCarregando(true)
    setErro(null)

    const callback = new URL('/auth/callback', window.location.origin)
    if (next) callback.searchParams.set('next', next)
    if (modo === 'cadastro') callback.searchParams.set('cadastro', 'google')

    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback.toString(),
          // Sempre mostra a escolha de conta, útil para quem tem várias.
          queryParams: { prompt: 'select_account' },
        },
      })
      // Sem erro o navegador já está indo para o Google.
      if (error) throw error
    } catch {
      setErro('Não foi possível entrar com o Google. Tente novamente.')
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="brandOutline"
        className="w-full gap-2"
        onClick={entrar}
        disabled={carregando}
      >
        <GoogleIcon />
        {carregando ? 'Redirecionando…' : modo === 'cadastro' ? 'Criar conta com Google' : 'Entrar com Google'}
      </Button>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex items-center gap-3 text-xs text-[#595959]">
        <span className="h-px flex-1 bg-[#E5E5E5]" />
        ou com e-mail
        <span className="h-px flex-1 bg-[#E5E5E5]" />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  )
}
