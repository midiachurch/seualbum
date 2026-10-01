'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, Camera, Heart, Loader2, PenTool, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { devLoginAction, type PerfilDevLogin } from '@/lib/actions/dev-login'

/** Atalhos de login do ambiente local. Quem decide se renderiza é a página (NODE_ENV). */
export function DevLoginPanel({ configurados }: { configurados: Record<PerfilDevLogin, boolean> }) {
  const [pendente, startTransition] = useTransition()
  const [clicado, setClicado] = useState<PerfilDevLogin | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function entrar(perfil: PerfilDevLogin) {
    setErro(null)
    setClicado(perfil)
    startTransition(async () => {
      // Em sucesso a action redireciona e isto nem retorna.
      const result = await devLoginAction(perfil)
      if (result?.erro) setErro(result.erro)
    })
  }

  const botoes: { perfil: PerfilDevLogin; rotulo: string; Icone: typeof ShieldCheck }[] = [
    { perfil: 'admin', rotulo: 'Entrar como ADMIN (Equipe)', Icone: ShieldCheck },
    { perfil: 'designer', rotulo: 'Entrar como DESIGNER (Produção)', Icone: PenTool },
    { perfil: 'fotografo', rotulo: 'Entrar como FOTÓGRAFO (Cliente)', Icone: Camera },
    { perfil: 'cliente', rotulo: 'Entrar como CLIENTE (Casal)', Icone: Heart },
  ]

  return (
    <section
      aria-labelledby="dev-login"
      className="mb-8 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4"
    >
      <h2 id="dev-login" className="text-xs font-bold uppercase tracking-wider text-amber-900">
        Ambiente de desenvolvimento
      </h2>
      <p className="mt-1 text-sm text-amber-900/80">Login de teste em um clique. Não aparece em produção.</p>

      <div className="mt-3 grid gap-2">
        {botoes.map(({ perfil, rotulo, Icone }) => (
          <Button
            key={perfil}
            type="button"
            variant="brand"
            onClick={() => entrar(perfil)}
            disabled={pendente}
            className="h-12 justify-start text-base"
          >
            {pendente && clicado === perfil ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Icone className="h-5 w-5" aria-hidden />
            )}
            {rotulo}
            {!configurados[perfil] ? (
              <span className="ml-auto text-xs font-normal text-white/70">sem credencial</span>
            ) : null}
          </Button>
        ))}
      </div>

      {erro ? (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}
    </section>
  )
}
