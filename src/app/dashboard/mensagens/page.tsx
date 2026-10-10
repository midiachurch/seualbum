import Link from 'next/link'
import type { Metadata } from 'next'
import { CaixaDeEntrada } from '@/components/mensagens/caixa-de-entrada'
import { ConversaThread } from '@/components/mensagens/conversa-thread'
import { NovaConversa } from '@/components/mensagens/nova-conversa'
import { EmptyState } from '@/components/ui/empty-state'
import { abrirConversa, listarConversas } from '@/lib/actions/mensagens'
import { carregarFio, listarProjetosDoEstudio } from '@/lib/mensagens-servidor'
import { ehUuid, tituloDaConversa } from '@/lib/mensagens'
import { requireUser } from '@/lib/supabase/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mensagens' }

type Aba = 'equipe' | 'clientes'

/**
 * Caixa de entrada do estúdio: "Equipe seualbum" (fio geral + fios por
 * projeto com a equipe) e "Meus clientes" (um fio por projeto com o cliente
 * final, que vê só a marca do estúdio). O layout já garante o papel fotógrafo.
 */
export default async function DashboardMensagensPage({ searchParams }: { searchParams: Promise<{ aba?: string; c?: string }> }) {
  const { user } = await requireUser()
  const busca = await searchParams
  const aba: Aba = busca.aba === 'clientes' ? 'clientes' : 'equipe'

  // O fio geral com a equipe sempre existe para o estúdio.
  const geral = await abrirConversa({ canal: 'estudio_equipe' })
  const [equipe, clientes, projetos] = await Promise.all([
    listarConversas({ canal: 'estudio_equipe', incluirVazias: true, limite: 200 }),
    listarConversas({ canal: 'cliente_estudio', incluirVazias: true, limite: 200 }),
    listarProjetosDoEstudio(),
  ])
  const fiosEquipe = equipe.ok ? equipe.conversas : []
  const fiosClientes = clientes.ok ? clientes.conversas : []
  const todas = aba === 'equipe' ? fiosEquipe : fiosClientes

  const pedida = ehUuid(busca.c) ? busca.c : null
  const selecionada = pedida ?? (aba === 'equipe' && geral.ok ? geral.conversaId : null)
  const conversas = todas.filter((c) => c.id === selecionada || c.ultimaMensagemEm || !c.projetoId)
  const aberta = selecionada ? todas.find((c) => c.id === selecionada) ?? null : null
  const fio = aberta ? await carregarFio(aberta.id) : null

  const naoLidas = (lista: typeof todas) => lista.reduce((s, c) => s + c.naoLidas, 0)
  const href = (a: Aba, c?: string) => `/dashboard/mensagens?aba=${a}${c ? `&c=${c}` : ''}`
  const hrefDe = Object.fromEntries(conversas.map((c) => [c.id, href(aba, c.id)]))
  const opcoesProjetos = projetos.map((p) => ({ valor: p.id, rotulo: `#${p.numero} ${p.nome}` }))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-sm text-muted-foreground">
            {aba === 'equipe'
              ? 'Fale com a equipe seualbum sobre o estúdio ou sobre um álbum.'
              : 'Converse com seus clientes sobre o álbum deles — eles veem só a marca do seu estúdio.'}
          </p>
        </div>
        <NovaConversa
          canal={aba === 'equipe' ? 'estudio_equipe' : 'cliente_estudio'}
          campo="projetoId"
          rotulo={aba === 'equipe' ? 'Falar sobre um álbum…' : 'Falar com o cliente de…'}
          opcoes={opcoesProjetos}
          hrefDoFio={`/dashboard/mensagens?aba=${aba}`}
        />
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Caixas">
        {(
          [
            ['equipe', 'Equipe seualbum', naoLidas(fiosEquipe)],
            ['clientes', 'Meus clientes', naoLidas(fiosClientes)],
          ] as const
        ).map(([valor, rotulo, n]) => (
          <Link
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            href={href(valor)}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-medium',
              aba === valor ? 'bg-[#171717] text-white' : 'bg-[#F5F5F5] text-[#595959] hover:text-[#171717]',
            )}
          >
            {rotulo}
            {n > 0 ? (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                  aba === valor ? 'bg-white text-[#171717]' : 'bg-[#171717] text-white',
                )}
              >
                {n}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {!equipe.ok || !clientes.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {!equipe.ok ? equipe.erro : !clientes.ok ? clientes.erro : null}
        </p>
      ) : null}

      <CaixaDeEntrada
        conversas={conversas}
        selecionadaId={aberta?.id ?? null}
        perfil="fotografo"
        hrefDe={hrefDe}
        hrefVoltar={href(aba)}
        vazio={
          <EmptyState
            title="Nenhuma conversa ainda"
            description={
              aba === 'clientes'
                ? 'Escolha um álbum acima para falar com o cliente. Quando um cliente escrever, a conversa aparece aqui.'
                : 'Escolha um álbum acima para falar com a equipe sobre ele.'
            }
          />
        }
      >
        {aberta && fio ? (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {aberta.projetoId ? (
                <Link href={`/dashboard/albuns/${aberta.projetoId}/mensagens`} className="underline underline-offset-2">
                  {tituloDaConversa(aberta, 'fotografo')}
                </Link>
              ) : (
                tituloDaConversa(aberta, 'fotografo')
              )}
            </h2>
            <ConversaThread key={aberta.id} conversaId={aberta.id} meuId={user.id} perfil="fotografo" inicial={fio.inicial} />
          </div>
        ) : pedida ? (
          <p className="text-sm text-muted-foreground">Conversa não encontrada.</p>
        ) : null}
      </CaixaDeEntrada>
    </div>
  )
}
