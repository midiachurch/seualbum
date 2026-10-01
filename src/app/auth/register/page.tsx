import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Criar conta' }

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-display-l text-[#444444]">Crie a conta do seu estúdio</h1>
      <p className="text-body mt-2 text-[#595959]">
        Leva menos de um minuto. Você só paga quando enviar o primeiro álbum.
      </p>

      <div className="mt-8">
        <Suspense fallback={<div className="h-96" />}>
          <RegisterForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-[#595959]">
        Já tem conta?{' '}
        <Link href="/auth/login" className="font-medium text-[#171717] hover:underline">
          Entrar
        </Link>
      </p>
    </>
  )
}
