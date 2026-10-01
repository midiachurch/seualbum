'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/** CMS no-code de páginas do site (`paginas_conteudo`) — só admin/gestor, ver RLS. */

function assertRealMode() {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')
}

export type PaginaInput = {
  slug: string
  titulo: string
  conteudoHtml: string
  seoDescription: string
  status: 'publicado' | 'rascunho'
}

export async function createPagina(input: PaginaInput): Promise<string> {
  assertRealMode()
  const { supabase, user } = await requireModuleAction('vitrine', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data, error } = await supabase
    .from('paginas_conteudo')
    .insert({
      slug: input.slug,
      titulo: input.titulo,
      conteudo_html: input.conteudoHtml,
      seo_description: input.seoDescription || null,
      status: input.status,
      criado_por: user.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível criar a página.')

  revalidatePath('/admin/vitrine/paginas')
  revalidatePath(`/p/${input.slug}`)
  return data.id as string
}

export async function updatePagina(id: string, input: PaginaInput) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase
    .from('paginas_conteudo')
    .update({
      slug: input.slug,
      titulo: input.titulo,
      conteudo_html: input.conteudoHtml,
      seo_description: input.seoDescription || null,
      status: input.status,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/paginas')
  revalidatePath(`/p/${input.slug}`)
}

export async function deletePagina(id: string, slug: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'excluir')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('paginas_conteudo').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/paginas')
  revalidatePath(`/p/${slug}`)
}
