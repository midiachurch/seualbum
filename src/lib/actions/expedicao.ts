'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/** Fila de expedição física (seção "A Fila de Expedição e Ordem de Serviço"). */

export async function despacharProjeto(projetoId: string, codigoRastreio: string) {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')

  const { supabase } = await requireModuleAction('projetos', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase
    .from('projetos')
    .update({ status: 'enviado', codigo_rastreio: codigoRastreio, enviado_em: new Date().toISOString() })
    .eq('id', projetoId)
  if (error) throw new Error(error.message)

  await supabase.from('projeto_atividades').insert({
    projeto_id: projetoId,
    mensagem: `Álbum despachado — código de rastreio ${codigoRastreio}.`,
  })

  revalidatePath('/admin/producao/grafica')
  revalidatePath(`/admin/projetos/${projetoId}`)
}
