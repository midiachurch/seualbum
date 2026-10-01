'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, Truck, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { despacharProjeto } from '@/lib/actions/expedicao'
import { formatDate } from '@/lib/utils'
import type { Client, Photographer, Project } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Fila de expedição física (seção "A Fila de Expedição e Ordem de Serviço") —
 * só projetos "Aprovado" aparecem aqui; assim que despachado, some da lista
 * (o rastreio dele passa a viver só no histórico do projeto).
 */
export function DespachoManager({
  projects: initialProjects,
  clients,
  photographers,
  adicionais = {},
}: {
  projects: Project[]
  clients: Client[]
  photographers: Photographer[]
  /** Itens físicos que seguem junto com o álbum (Upsell, 0026), por projeto. */
  adicionais?: Record<string, { descricao: string; quantidade: number }[]>
}) {
  const [projects, setProjects] = useState(initialProjects)
  const [target, setTarget] = useState<Project | null>(null)
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—'
  const photographerName = (id: string) => photographers.find((p) => p.id === id)?.estudio ?? '—'

  async function confirmarDespacho() {
    if (!target || !codigo.trim()) return
    setEnviando(true)
    try {
      if (!DEMO_MODE) await despacharProjeto(target.id, codigo.trim())
      setProjects((prev) => prev.filter((p) => p.id !== target.id))
      setTarget(null)
      setCodigo('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fila de expedição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Álbuns aprovados, prontos pra virar ordem de serviço e seguir pra gráfica. {projects.length} na fila.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState title="Nenhum álbum aguardando despacho" description="Assim que um projeto for aprovado pelo cliente, ele aparece aqui." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="space-y-3 rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{project.nome}</p>
                  <p className="text-xs text-muted-foreground">#{project.numero}</p>
                </div>
                <Package className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">
                {clientName(project.clientId)} · {photographerName(project.fotografoId)}
              </p>
              <p className="text-xs text-muted-foreground">Aprovado em {formatDate(project.createdAt)}</p>
              {(adicionais[project.id] ?? []).length > 0 ? (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <Gift className="h-3.5 w-3.5" aria-hidden />
                    Produzir junto
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {adicionais[project.id].map((a, i) => (
                      <li key={i} className="break-words">
                        {a.quantidade}× {a.descricao}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/producao/grafica/${project.id}`}>Ver ficha de impressão</Link>
                </Button>
                <Button size="sm" variant="brand" onClick={() => setTarget(project)}>
                  <Truck className="h-4 w-4" aria-hidden />
                  Despachar álbum
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Despachar álbum">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong>{target?.nome}</strong> vai mudar para o status &ldquo;Enviado&rdquo; e o cliente recebe um aviso automático.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="codigo-rastreio">Código de rastreio</Label>
            <Input
              id="codigo-rastreio"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="BR123456789SP"
              autoFocus
            />
          </div>
          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={confirmarDespacho} disabled={!codigo.trim() || enviando}>
              {enviando ? 'Despachando…' : 'Confirmar despacho'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
