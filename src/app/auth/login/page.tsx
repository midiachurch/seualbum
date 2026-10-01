import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { DevLoginPanel } from '@/components/auth/dev-login-panel'
import { perfisDevConfigurados } from '@/lib/actions/dev-login'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage() {
  // Atalhos de teste só com `next dev`; no build de produção o bloco nem existe.
  const devLogin = process.env.NODE_ENV === 'development' ? await perfisDevConfigurados() : null

  return (
    <>
      {devLogin ? <DevLoginPanel configurados={devLogin} /> : null}
      <h1 className="text-display-l text-[#444444]">Área do cliente</h1>
      <p className="text-body mt-2 text-[#595959]">
        Acompanhe seus álbuns e envie novos pedidos.
      </p>

      <div className="mt-8">
        {/* useSearchParams() exige Suspense para a página poder ser pré-renderizada. */}
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-[#595959]">
        Ainda não tem conta?{' '}
        <Link href="/auth/register" className="font-medium text-[#171717] hover:underline">
          Criar conta do estúdio
        </Link>
      </p>
    </>
  )
}
