'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ScanFace, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { definirReconhecimentoFacial } from '@/lib/actions/reconhecimento'
import type { ResumoReconhecimento } from '@/lib/rekognition/resumo'
import { formatDate } from '@/lib/utils'

/**
 * "Encontrar minhas fotos" no workspace do projeto (migration 0042). A equipe
 * liga a busca por selfie para o cliente final; ao ligar, os rostos das fotos
 * já enviadas são indexados aqui em lotes (/api/reconhecimento/indexar) — as
 * novas são indexadas sozinhas no upload e o Cron diário pega o que sobrar.
 *
 * Rosto é dado sensível (LGPD art. 11): ligar exige confirmação explícita e o
 * índice some sozinho 60 dias depois.
 */
export function ReconhecimentoFacialCard({ projetoId, resumo }: { projetoId: string; resumo: ResumoReconhecimento }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [indexando, setIndexando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ativo = resumo.expiraEm !== null
  const lidas = resumo.indexadas + resumo.semRosto + resumo.naoSuportadas
  const pendentes = Math.max(0, resumo.fotos - lidas)

  async function indexar() {
    setIndexando(true)
    setErro(null)
    try {
      // Lotes de ~40 s até esvaziar a fila; atualiza o progresso a cada lote.
      for (let lote = 0; lote < 100; lote++) {
        const resposta = await fetch('/api/reconhecimento/indexar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projetoId }),
        }).catch(() => null)
        const json = (await resposta?.json().catch(() => null)) as { restantes?: boolean; erro?: string } | null
        if (!resposta?.ok) {
          setErro(json?.erro ?? 'Não foi possível indexar agora. Tente de novo.')
          return
        }
        router.refresh()
        if (!json?.restantes) return
      }
    } finally {
      setIndexando(false)
    }
  }

  async function definir(ligar: boolean) {
    setSalvando(true)
    setErro(null)
    const r = await definirReconhecimentoFacial(projetoId, ligar)
    setSalvando(false)
    setConfirmando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    router.refresh()
    if (ligar) await indexar()
  }

  if (!resumo.configurado) return null

  return (
    <section aria-labelledby="reconhecimento-facial" className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="reconhecimento-facial" className="flex items-center gap-2 text-base font-semibold">
            <ScanFace className="h-4 w-4" aria-hidden />
            Encontrar minhas fotos (reconhecimento facial)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ativo
              ? `Ligado. O cliente acha as fotos em que aparece com uma selfie. O índice de rostos é apagado em ${formatDate(resumo.expiraEm!)}.`
              : 'Desligado. Ao ligar, o cliente final pode tirar uma selfie e ver só as fotos em que aparece.'}
          </p>
        </div>
        <Switch
          checked={ativo}
          disabled={salvando || indexando}
          onCheckedChange={(v) => (v ? setConfirmando(true) : definir(false))}
          aria-label={ativo ? 'Desligar o reconhecimento facial' : 'Ligar o reconhecimento facial'}
        />
      </div>

      {ativo ? (
        <div className="mt-4 space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-[#F5F5F5]">
            <div
              className="h-full bg-[#171717] transition-all"
              style={{ width: `${resumo.fotos ? Math.round((lidas / resumo.fotos) * 100) : 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {lidas} de {resumo.fotos} fotos lidas · {resumo.indexadas} com rostos · {resumo.semRosto} sem rosto
            {resumo.naoSuportadas > 0 ? ` · ${resumo.naoSuportadas} não lidas (arquivo acima de 80 MB ou corrompido)` : ''}
            {resumo.erros > 0 ? ` · ${resumo.erros} com erro (nova tentativa automática)` : ''}
          </p>
          {pendentes > 0 || indexando ? (
            <Button variant="brandOutline" size="sm" disabled={indexando} onClick={indexar}>
              {indexando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {indexando ? 'Indexando rostos…' : `Indexar ${pendentes} foto${pendentes === 1 ? '' : 's'} agora`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {erro ? <p className="mt-3 text-sm text-red-600">{erro}</p> : null}

      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title="Ligar o reconhecimento facial?"
      >
        <div className="space-y-3 text-sm text-[#444444]">
          <p>
            Os rostos de todas as fotos deste projeto vão para um índice biométrico (AWS Rekognition). Rosto é dado pessoal
            sensível na LGPD.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Confirme que o estúdio tem a autorização do cliente para este uso.</li>
            <li>O índice é apagado automaticamente em 60 dias, ou na hora se você desligar.</li>
            <li>A selfie do cliente nunca é salva: serve só para a busca.</li>
          </ul>
          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={() => definir(true)} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              Ligar e indexar
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
