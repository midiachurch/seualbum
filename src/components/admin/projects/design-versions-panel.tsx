'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Eye, FileText, Layers, PenTool, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LaminasUpload } from '@/components/admin/projects/laminas-upload'
import { formatDate } from '@/lib/utils'
import type { FormatoAlbum } from '@/lib/resolucao'
import type { DesignVersion, Photo, ProjectStatus, TeamMember } from '@/types/platform'

const STATUS_LABEL: Record<DesignVersion['status'], string> = {
  em_producao: 'Em produção',
  enviada: 'Aguardando revisão interna',
  aprovada: 'Aprovada internamente',
  rejeitada: 'Ajustes solicitados',
}

const STATUS_COLOR: Record<DesignVersion['status'], string> = {
  em_producao: 'bg-secondary text-secondary-foreground',
  enviada: 'bg-amber-100 text-amber-800',
  aprovada: 'bg-emerald-100 text-emerald-800',
  rejeitada: 'bg-red-100 text-red-800',
}

/**
 * Diagramação + revisão interna (Fase 3). Enviar uma versão nova sempre
 * manda o projeto para "Revisão Interna" — só quem tem permissão de
 * 'aprovar' (gestor/admin) decide se ela segue para o cliente ou volta pro
 * designer com ajustes.
 *
 * "Nova versão" = upload em massa das lâminas (Fase 3, migration 0018).
 */
export function DesignVersionsPanel({
  projetoId,
  album,
  versions,
  photos,
  projectStatus,
  teamMembers,
  canEdit,
  canApproveInternal,
  onVersaoCriada,
  onReview,
  onSmartLayout,
}: {
  projetoId: string
  album: FormatoAlbum | null
  versions: DesignVersion[]
  photos: Photo[]
  projectStatus: ProjectStatus
  teamMembers: TeamMember[]
  canEdit: boolean
  canApproveInternal: boolean
  onVersaoCriada: (versao: { versaoId: string; numero: number; laminas: number; comentarios: string | null }) => void
  onReview: (versionId: string, decision: 'aprovada' | 'rejeitada', comentario?: string) => void
  onSmartLayout: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [ajustandoId, setAjustandoId] = useState<string | null>(null)
  const [comentarioAjuste, setComentarioAjuste] = useState('')
  const [gerandoSmartLayout, setGerandoSmartLayout] = useState(false)

  const fotoPorId = (id: string) => photos.find((f) => f.id === id)

  async function handleSmartLayout() {
    setGerandoSmartLayout(true)
    try {
      await onSmartLayout()
    } finally {
      setGerandoSmartLayout(false)
    }
  }

  const responsavelNome = (id: string) => teamMembers.find((m) => m.id === id)?.nome ?? '—'

  const versoesOrdenadas = versions.slice().reverse()
  const ultimaVersao = versoesOrdenadas[0]
  const emRevisao =
    projectStatus === 'em_revisao_interna' && ultimaVersao?.status === 'enviada' && canApproveInternal

  return (
    <div className="space-y-4">
      {canEdit ? (
        adding ? (
          <LaminasUpload
            projetoId={projetoId}
            album={album}
            versaoBase={ultimaVersao?.laminas?.length ? { id: ultimaVersao.id, numero: ultimaVersao.numero, laminas: ultimaVersao.laminas } : null}
            onCancelar={() => setAdding(false)}
            onConcluido={(versao) => {
              onVersaoCriada(versao)
              setAdding(false)
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="brand" asChild>
              <Link href={`/admin/projetos/${projetoId}/editor`}>
                <PenTool className="h-4 w-4" aria-hidden />
                Diagramar no editor
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {ultimaVersao?.laminas?.length ? 'Nova versão (lâminas)' : 'Subir lâminas prontas'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSmartLayout} disabled={gerandoSmartLayout || photos.length === 0}>
              <Sparkles className="h-4 w-4" aria-hidden />
              {gerandoSmartLayout ? 'Gerando esboço…' : 'Smart Layout Automático'}
            </Button>
          </div>
        )
      ) : null}

      <ol className="space-y-3">
        {versoesOrdenadas.map((version, idx) => (
          <li key={version.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  Versão {version.numero} {version.arquivo ? `— ${version.arquivo}` : ''}
                </p>
                <div className="flex items-center gap-1.5">
                  {version.automatico ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Smart Layout
                    </span>
                  ) : null}
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[version.status]}`}>
                    {STATUS_LABEL[version.status]}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {responsavelNome(version.responsavelId)} · {formatDate(version.data)}
                {version.quantidadePaginas ? ` · ${version.quantidadePaginas} páginas` : ''}
              </p>
              {version.comentarios ? <p className="mt-2 text-sm">{version.comentarios}</p> : null}

              {version.laminas && version.laminas.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-4 w-4" aria-hidden />
                    {version.laminas.length} {version.laminas.length === 1 ? 'lâmina' : 'lâminas'}
                  </span>
                  <Link
                    href={`/admin/projetos/${projetoId}/prova?versao=${version.numero}`}
                    className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    Ver lâminas e apontamentos
                  </Link>
                </div>
              ) : null}

              {version.automatico && version.layoutJson && version.layoutJson.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-xl border border-dashed bg-secondary/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Esboço automático — {version.layoutJson.length} páginas
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {version.layoutJson.map((pagina) => (
                      <div key={pagina.numero} className="rounded-lg border bg-card p-1.5">
                        <p className="mb-1 text-center text-[10px] font-medium text-muted-foreground">Pág. {pagina.numero}</p>
                        <div className="grid grid-cols-2 gap-0.5">
                          {pagina.fotoIds.slice(0, 4).map((fotoId) => {
                            const foto = fotoPorId(fotoId)
                            return (
                              <div key={fotoId} className="aspect-square overflow-hidden rounded bg-secondary">
                                {foto ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- miniatura do esboço, mesma origem das fotos do projeto.
                                  <img src={foto.url} alt="" className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {idx === 0 && emRevisao ? (
                ajustandoId === version.id ? (
                  <div className="mt-3 space-y-2 rounded-xl border bg-secondary/30 p-3">
                    <Label htmlFor={`ajuste-${version.id}`}>O que precisa ajustar?</Label>
                    <Input
                      id={`ajuste-${version.id}`}
                      value={comentarioAjuste}
                      onChange={(e) => setComentarioAjuste(e.target.value)}
                      placeholder="Ex.: trocar a foto de abertura, revisar a página 8"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setAjustandoId(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          onReview(version.id, 'rejeitada', comentarioAjuste.trim() || undefined)
                          setAjustandoId(null)
                          setComentarioAjuste('')
                        }}
                      >
                        Confirmar ajustes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="brand" onClick={() => onReview(version.id, 'aprovada')}>
                      <Check className="h-4 w-4" aria-hidden />
                      Aprovar internamente
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAjustandoId(version.id)}>
                      Solicitar ajustes
                    </Button>
                  </div>
                )
              ) : null}
            </div>
          </li>
        ))}
        {versoesOrdenadas.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma versão enviada ainda.
          </p>
        ) : null}
      </ol>
    </div>
  )
}
