import 'server-only'

import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo-mode'
import { r2Configurado } from '@/lib/r2/cliente'
import { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Porta de entrada das rotas /api/uploads/pedido-foto: R2 configurado, sessão
 * válida (getUser revalida o JWT) e conta de estúdio — a mesma regra do
 * criarPedidoAction. Devolve a resposta de erro pronta quando não passa.
 */
export async function fotografoParaUpload(): Promise<
  { ok: true; supabase: Supabase; userId: string } | { ok: false; resposta: NextResponse }
> {
  if (isDemoMode() || !r2Configurado()) {
    return { ok: false, resposta: NextResponse.json({ erro: 'Armazenamento de fotos não configurado.' }, { status: 503 }) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, resposta: NextResponse.json({ erro: 'Faça login de novo.' }, { status: 401 }) }

  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (perfil?.role !== 'fotografo') {
    return {
      ok: false,
      resposta: NextResponse.json({ erro: 'Apenas contas de estúdio (fotógrafo) enviam fotos de pedido.' }, { status: 403 }),
    }
  }

  return { ok: true, supabase, userId: user.id }
}

/** O rascunho já virou pedido? Depois disso as fotos ficam travadas (migration 0011). */
export async function rascunhoJaEnviado(supabase: Supabase, chave: string) {
  const { data, error } = await supabase.from('orders').select('id').eq('chave_idempotencia', chave).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function lerJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
