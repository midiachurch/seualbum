import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TemplatesManager } from '@/components/admin/diagramacao/templates-manager'
import { getTemplatesParaGestao } from '@/lib/supabase/diagramacao'
import { requireModuleAction } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Templates de lâmina' }

/**
 * Gestão dos templates de lâmina salvos no editor ("Salvar como template",
 * migration 0027): renomear e desativar (0038). Só admin/gestor.
 */
export default async function TemplatesDiagramacaoPage() {
  await requireModuleAction('projetos', 'atribuir', '/admin/diagramacao')
  const templates = await getTemplatesParaGestao()
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/diagramacao" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Diagramação
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Templates de lâmina</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Criados pela equipe no editor. Desativado some do editor, sem ser apagado. Os templates valem para qualquer formato
          (a geometria é proporcional à lâmina).
        </p>
      </header>
      <TemplatesManager templates={templates} />
    </div>
  )
}
