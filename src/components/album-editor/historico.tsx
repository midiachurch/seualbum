'use client'

import { useEffect, useState } from 'react'
import { History, Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { listarVersoesAlbum, obterVersaoAlbum, salvarVersaoManual } from '@/lib/actions/album-editor'
import type { DocumentoAlbum } from '@/lib/album/documento'
import type { VersaoDoAlbum } from '@/lib/supabase/queries'

const TIPO: Record<VersaoDoAlbum['tipo'], string> = {
  auto: 'Automática',
  manual: 'Salva',
  restauracao: 'Antes de restaurar',
  aprovacao: 'Enviada ao cliente',
  publicacao: 'Final',
}

function haQuanto(em: number) {
  const min = Math.round((Date.now() - em) / 60_000)
  if (min < 1) return 'Há instantes'
  if (min < 60) return `Há ${min} min`
  return `Há ${Math.round(min / 60)} h`
}

function quando(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(hoje.getTime() - 86_400_000)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === hoje.toDateString()) return `Hoje — ${hora}`
  if (d.toDateString() === ontem.toDateString()) return `Ontem — ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — ${hora}`
}

/**
 * Histórico do álbum: pontos de restauração automáticos (a cada 15 min de
 * edição), os salvos à mão e os marcos (envio ao cliente, versão final).
 * Restaurar troca o conteúdo do editor — e dá para desfazer com Ctrl+Z.
 */
export function Historico({
  aberto,
  onFechar,
  albumId,
  somenteLeitura,
  antesDeSalvar,
  onRestaurar,
  alteracoes,
  onVoltarPara,
}: {
  aberto: boolean
  onFechar: () => void
  albumId: string
  somenteLeitura: boolean
  antesDeSalvar: () => Promise<boolean>
  onRestaurar: (doc: DocumentoAlbum) => void
  /** Alterações desta sessão, da mais recente para a mais antiga (índice no desfazer). */
  alteracoes: { rotulo: string; em: number; passos: number }[]
  onVoltarPara: (passos: number) => void
}) {
  const [aba, setAba] = useState<'versoes' | 'alteracoes'>('versoes')
  const [versoes, setVersoes] = useState<VersaoDoAlbum[] | null>(null)
  const [rotulo, setRotulo] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const r = await listarVersoesAlbum(albumId)
    if (r.ok) setVersoes(r.versoes)
    else setErro(r.erro)
  }

  useEffect(() => {
    if (aberto) {
      setVersoes(null)
      void carregar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  async function salvarAgora() {
    setOcupado('salvar')
    setErro(null)
    const ok = await antesDeSalvar()
    const r = ok ? await salvarVersaoManual(albumId, rotulo) : { ok: false as const, erro: 'Não foi possível salvar o álbum antes.' }
    setOcupado(null)
    if (!r.ok) setErro(r.erro)
    else {
      setRotulo('')
      void carregar()
    }
  }

  async function restaurar(v: VersaoDoAlbum) {
    setOcupado(v.id)
    setErro(null)
    const r = await obterVersaoAlbum(v.id)
    setOcupado(null)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    onRestaurar(r.documento)
    onFechar()
  }

  return (
    <Modal open={aberto} onClose={onFechar} title="Histórico">
      <div className="space-y-4 text-sm">
        <div className="flex gap-1" role="tablist">
          {(
            [
              ['versoes', 'Versões'],
              ['alteracoes', 'Alterações desta sessão'],
            ] as const
          ).map(([v, r]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={aba === v}
              onClick={() => setAba(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${aba === v ? 'bg-[#171717] text-white' : 'bg-secondary'}`}
            >
              {r}
            </button>
          ))}
        </div>
        {aba === 'alteracoes' ? (
          alteracoes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma alteração nesta sessão ainda.</p>
          ) : (
            <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
              {alteracoes.map((a, i) => (
                <li key={`${a.em}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{i === 0 ? 'Agora' : haQuanto(a.em)}</p>
                    <p className="truncate font-medium">{a.rotulo}</p>
                  </div>
                  {i > 0 && !somenteLeitura ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onVoltarPara(a.passos)
                        onFechar()
                      }}
                    >
                      Voltar a este ponto
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
        {aba === 'versoes' && !somenteLeitura ? (
          <div className="flex gap-2">
            <input
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Primeira montagem, Alterações do cliente…"
              className="min-w-0 flex-1 rounded-xl border border-[#D4D4D4] px-3 py-2 text-sm"
            />
            <Button variant="brand" size="sm" onClick={salvarAgora} disabled={ocupado !== null}>
              {ocupado === 'salvar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              Criar versão
            </Button>
          </div>
        ) : null}
        {erro ? <p role="alert" className="text-destructive">{erro}</p> : null}
        {aba !== 'versoes' ? null : versoes === null ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
          </p>
        ) : versoes.length === 0 ? (
          <p className="text-muted-foreground">Ainda não há versões. Elas são criadas automaticamente enquanto você edita.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
            <li className="flex items-center gap-3 bg-secondary/50 px-3 py-2">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">Versão atual</span>
            </li>
            {versoes.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{quando(v.criadoEm)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {TIPO[v.tipo]}
                    {v.rotulo ? ` · ${v.rotulo}` : ''} · {v.laminas} lâmina(s)
                  </p>
                </div>
                {!somenteLeitura ? (
                  <Button variant="outline" size="sm" onClick={() => restaurar(v)} disabled={ocupado !== null}>
                    {ocupado === v.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                    Restaurar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
