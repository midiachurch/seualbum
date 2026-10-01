import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-marketing flex min-h-screen flex-col bg-[#F5F5F5]">
      <header className="container flex h-16 items-center">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
          <img src="/brand/logo-dark.png" alt="Seu Álbum" className="h-8 w-auto" />
        </Link>
      </header>

      <main className="container flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#EAEAEA] bg-white p-8 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  )
}
