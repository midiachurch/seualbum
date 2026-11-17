import type { Metadata } from 'next'
import Link from 'next/link'
import { Images, Heart, Link2, ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
export const metadata: Metadata = {
  title: 'Galerias digitais para fotógrafos',
  description:
    'Compartilhe suas fotos em uma galeria privada e receba a seleção do cliente, sem cadastro para quem escolhe.',
  alternates: { canonical: '/' },
}
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Seu Álbum · Galerias digitais
            </p>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A história é sua.
              <br />
              <span className="text-primary">A escolha é do cliente.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              Entregue suas fotos em uma galeria privada e receba a seleção organizada. Simples para você,
              fácil para quem escolhe.
            </p>
            <Link
              href="/auth/login"
              className="mt-8 inline-flex min-h-14 items-center gap-3 rounded-xl bg-primary px-7 font-medium text-white"
            >
              Entrar nas minhas galerias
              <ArrowRight size={18} />
            </Link>
            <p className="mt-4 text-sm text-slate-500">
              Seu cliente acessa com link e código, sem criar conta.
            </p>
          </div>
          <div className="rounded-3xl bg-[#eef1f7] p-6 sm:p-10">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <Images className="text-primary" size={32} />
              <p className="mt-5 text-xl font-semibold">Um espaço para cada história</p>
              <div className="mt-6 grid grid-cols-3 gap-3" aria-hidden>
                {[
                  'bg-[#dce4d8]',
                  'bg-[#dadfe9]',
                  'bg-[#eaded1]',
                  'bg-[#e6dadb]',
                  'bg-[#dce5e8]',
                  'bg-[#e6e4d8]',
                ].map((c, i) => (
                  <div key={c} className={`flex aspect-square items-center justify-center rounded-lg ${c}`}>
                    <Images size={24} className="text-slate-500" />
                    {i === 2 && <Heart size={18} className="fill-primary text-primary" />}
                  </div>
                ))}
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm text-slate-600">
                <Heart size={17} />
                Favoritas salvas. Seleção organizada.
              </p>
            </div>
          </div>
        </section>
        <section id="como-funciona" className="border-t bg-slate-50">
          <div className="container py-16">
            <h2 className="text-2xl font-semibold">Das suas fotos à seleção final</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {[
                {
                  icon: Images,
                  title: '01. Organize',
                  text: 'Crie a galeria e adicione suas fotos. Acompanhe cada envio.',
                },
                {
                  icon: Link2,
                  title: '02. Compartilhe',
                  text: 'Gere um link privado e um código de acesso para o cliente.',
                },
                {
                  icon: Heart,
                  title: '03. Receba a seleção',
                  text: 'O cliente escolhe as favoritas. Você recebe cada revisão e exporta o CSV.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon size={24} className="text-primary" />
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
