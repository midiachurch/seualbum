'use client'

import { useRouter } from 'next/navigation'
import { Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Barcode } from '@/components/admin/production/barcode'
import { formatDate } from '@/lib/utils'
import type { Client, Photographer, Project } from '@/types/platform'

const CAPA_LABEL: Record<string, string> = {
  fotografica: 'Fotográfica',
  tecido: 'Tecido',
  couro: 'Couro',
  acrilico: 'Acrílico',
  personalizada: 'Personalizada',
}

/**
 * Ordem de Serviço / Ficha de Impressão (seção "Fila de Expedição") — some
 * por trás de um `fixed inset-0` pra escapar do chrome do admin (sidebar,
 * header), igual a Prova Digital: a ideia é que isto saia limpo na
 * impressão. Os botões somem sozinhos no papel via `print:hidden`.
 */
export function OrdemServico({ project, client, photographer }: { project: Project; client: Client | undefined; photographer: Photographer | undefined }) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-[#171717]">
      <div className="flex items-center justify-between border-b px-6 py-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/producao/grafica')}>
          <X className="h-4 w-4" aria-hidden />
          Fechar
        </Button>
        <Button variant="brand" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="flex items-center justify-between border-b-2 border-[#171717] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ordem de serviço</p>
            <h1 className="text-2xl font-bold tracking-tight">#{project.numero}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(new Date().toISOString())}</p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
            <p className="mt-1 font-medium">{client?.nome ?? '—'}</p>
            <p className="text-muted-foreground">{client?.telefone}</p>
            <p className="text-muted-foreground">
              {client?.cidade}/{client?.estado}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fotógrafo / Estúdio</p>
            <p className="mt-1 font-medium">{photographer?.estudio ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Projeto</p>
            <p className="mt-1 font-medium">{project.nome}</p>
            <p className="text-muted-foreground">{project.tipoEvento}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Data do evento</p>
            <p className="mt-1 font-medium">{project.dataEvento ? formatDate(project.dataEvento) : '—'}</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Especificações do produto</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Formato', valor: project.album.formato },
              { label: 'Orientação', valor: project.album.orientacao },
              { label: 'Capa', valor: CAPA_LABEL[project.album.capa] ?? project.album.capa },
              { label: 'Páginas', valor: String(project.album.quantidadePaginas) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-medium capitalize">{item.valor}</p>
              </div>
            ))}
          </div>
          {project.album.observacoes ? (
            <p className="mt-4 border-t pt-3 text-sm">
              <span className="font-medium">Observações: </span>
              {project.album.observacoes}
            </p>
          ) : null}
        </section>

        <section className="mt-10">
          <Barcode value={String(project.numero)} />
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Seu Álbum — ficha de impressão gerada automaticamente. Conferir os dados antes de iniciar a produção física.
        </p>
      </div>
    </div>
  )
}
