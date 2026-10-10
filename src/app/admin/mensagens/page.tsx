import Link from 'next/link'
import type { Metadata } from 'next'
import { CaixaDeEntrada } from '@/components/mensagens/caixa-de-entrada'
import { ConversaThread } from '@/components/mensagens/conversa-thread'
import { NovaConversa } from '@/components/mensagens/nova-conversa'
import { EmptyState } from '@/components/ui/empty-state'
import { listarConversas } from '@/lib/actions/mensagens'
import { carregarFio, listarEstudios } from '@/lib/mensagens-servidor'
import { ehUuid, type CanalConversa } from '@/lib/mensagens'
import { requirePlatformAccess } from '@/lib/supabase/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mensagens' }

type Busca = { c?: string; estudio?: string; projeto?: string; nao_lidas?: string; canal?: string }

const AVISO_CLIENTE =
  'Conversa interna do estúdio com o cliente final. A equipe só lê, para dar suporte — o cliente e o estúdio não veem que a equipe leu.'

/**
 * Caixa de entrada da equipe: fios com os estúdios (geral e por projeto) e,
 * para a operação, os fios cliente ↔ estúdio em modo leitura (suporte).
 * Filtros por estúdio, projeto e não lidas ficam na URL.
 */
export default async function AdminMensagensPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const { user, role } = await requirePlatformAccess('mensagens')
  const busca = await searchParams
  // Designer: só os fios dos projetos atribuídos a ele (a RLS garante).
  const operacao = role !== 'designer'
  const canal: CanalConversa = operacao && busca.canal === 'cliente_estudio' ? 'cliente_estudio' : 'estudio_equipe'
  const estudio = ehUuid(busca.estudio) ? busca.estudio : null
  const projeto = ehUuid(busca.projeto) ? busca.projeto : null
  const somenteNaoLidas = busca.nao_lidas === '1'
  const selecionada = ehUuid(busca.c) ? busca.c : null

  const [lista, estudios] = await Promise.all([
    listarConversas({ canal, fotografoId: estudio, incluirVazias: true, limite: 200 }),
    operacao ? listarEstudios() : Promise.resolve([]),
  ])
  const todas = lista.ok ? lista.conversas : []
  // A conversa aberta continua na lista mesmo que o filtro a esconderia
  // (abrir marca como lida e ela sairia de "não lidas").
  const conversas = todas.filter(
    (c) =>
      c.id === selecionada ||
      ((c.ultimaMensagemEm || !c.projetoId) &&
        (!projeto || c.projetoId === projeto) &&
        (!somenteNaoLidas || c.naoLidas > 0)),
  )
  const aberta = selecionada ? todas.find((c) => c.id === selecionada) ?? null : null
  const fio = aberta ? await carregarFio(aberta.id) : null

  const projetos = estudio
    ? [...new Map(todas.filter((c) => c.projetoId).map((c) => [c.projetoId!, `#${c.projetoNumero} ${c.projetoNome}`])).entries()]
    : []

  const href = (extra: Partial<Busca>) => {
    const q = new URLSearchParams()
    const final: Busca = { canal: canal === 'cliente_estudio' ? canal : undefined, estudio: estudio ?? undefined, projeto: projeto ?? undefined, nao_lidas: somenteNaoLidas ? '1' : undefined, ...extra }
    for (const [k, v] of Object.entries(final)) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `/admin/mensagens?${s}` : '/admin/mensagens'
  }
  const hrefDe = Object.fromEntries(conversas.map((c) => [c.id, href({ c: c.id })]))

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          {operacao
            ? 'Conversas com os estúdios — gerais e por projeto. Mensagens do sistema registram prova publicada, aprovada e ajustes pedidos.'
            : 'Conversas com os estúdios sobre os projetos atribuídos a você.'}
        </p>
      </header>

      {operacao ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de conversa">
          {(
            [
              ['estudio_equipe', 'Estúdios ↔ equipe'],
              ['cliente_estudio', 'Clientes ↔ estúdios (suporte)'],
            ] as const
          ).map(([valor, rotulo]) => (
            <Link
              key={valor}
              role="tab"
              aria-selected={canal === valor}
              href={href({ canal: valor === 'cliente_estudio' ? valor : undefined, projeto: undefined, c: undefined })}
              className={cn(
                'inline-flex min-h-[36px] items-center rounded-full px-4 text-sm font-medium',
                canal === valor ? 'bg-[#171717] text-white' : 'bg-[#F5F5F5] text-[#595959] hover:text-[#171717]',
              )}
            >
              {rotulo}
            </Link>
          ))}
        </div>
      ) : null}

      <form method="get" action="/admin/mensagens" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        {canal === 'cliente_estudio' ? <input type="hidden" name="canal" value="cliente_estudio" /> : null}
        {operacao ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Estúdio
            <select name="estudio" defaultValue={estudio ?? ''} className="h-9 min-w-[200px] rounded-lg border border-input bg-background px-2 text-sm text-foreground">
              <option value="">Todos</option>
              {estudios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.estudio}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {projetos.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Projeto
            <select name="projeto" defaultValue={projeto ?? ''} className="h-9 min-w-[200px] rounded-lg border border-input bg-background px-2 text-sm text-foreground">
              <option value="">Todos</option>
              {projetos.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="nao_lidas" value="1" defaultChecked={somenteNaoLidas} className="h-4 w-4" />
          Só não lidas
        </label>
        <button type="submit" className="h-9 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white hover:bg-[#2E2E2E]">
          Filtrar
        </button>
        {estudio || projeto || somenteNaoLidas ? (
          <Link href={href({ estudio: undefined, projeto: undefined, nao_lidas: undefined, c: undefined })} className="text-sm text-muted-foreground underline underline-offset-2">
            Limpar
          </Link>
        ) : null}
        {operacao && canal === 'estudio_equipe' ? (
          <div className="ml-auto">
            <NovaConversa
              canal="estudio_equipe"
              campo="fotografoId"
              rotulo="Falar com um estúdio…"
              opcoes={estudios.map((e) => ({ valor: e.id, rotulo: e.estudio }))}
              hrefDoFio="/admin/mensagens"
            />
          </div>
        ) : null}
      </form>

      {!lista.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {lista.erro}
        </p>
      ) : null}

      <CaixaDeEntrada
        conversas={conversas}
        selecionadaId={aberta?.id ?? null}
        perfil="equipe"
        hrefDe={hrefDe}
        hrefVoltar={href({ c: undefined })}
        vazio={
          <EmptyState
            title={somenteNaoLidas ? 'Nenhuma conversa não lida' : 'Nenhuma conversa ainda'}
            description={
              canal === 'cliente_estudio'
                ? 'Quando um estúdio conversar com um cliente final, o fio aparece aqui para suporte.'
                : 'Quando um estúdio escrever — ou alguém da equipe abrir uma conversa — ela aparece aqui.'
            }
          />
        }
      >
        {aberta && fio ? (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {aberta.estudio}
              {aberta.projetoId ? (
                <>
                  {' · '}
                  <Link href={`/admin/projetos/${aberta.projetoId}`} className="underline underline-offset-2">
                    #{aberta.projetoNumero} {aberta.projetoNome}
                  </Link>
                </>
              ) : (
                ' · Geral'
              )}
            </h2>
            <ConversaThread
              key={aberta.id}
              conversaId={aberta.id}
              meuId={user.id}
              perfil="equipe"
              inicial={fio.inicial}
              somenteLeitura={aberta.canal === 'cliente_estudio'}
              aviso={aberta.canal === 'cliente_estudio' ? AVISO_CLIENTE : undefined}
            />
          </div>
        ) : selecionada ? (
          <p className="text-sm text-muted-foreground">Conversa não encontrada.</p>
        ) : null}
      </CaixaDeEntrada>
    </div>
  )
}
