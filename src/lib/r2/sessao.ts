import 'server-only'

import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo-mode'
import { r2Configurado, r2PublicoConfigurado } from '@/lib/r2/cliente'
import { createClient } from '@/lib/supabase/server'
import { EQUIPE_ROLES, hasPermission, type PlatformRole } from '@/types/platform'

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

/**
 * Porta de entrada de /api/uploads/lamina: equipe que pode editar a produção
 * (a mesma regra de `requireEdicaoDeProducao`) e enxerga o projeto pela RLS.
 */
export async function producaoParaUpload(projetoId: string): Promise<
  { ok: true; supabase: Supabase; userId: string } | { ok: false; resposta: NextResponse }
> {
  if (isDemoMode() || !r2Configurado()) {
    return { ok: false, resposta: NextResponse.json({ erro: 'Armazenamento de lâminas não configurado.' }, { status: 503 }) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, resposta: NextResponse.json({ erro: 'Faça login de novo.' }, { status: 401 }) }

  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = perfil?.role as PlatformRole | undefined
  const pode =
    !!role && EQUIPE_ROLES.includes(role) && (hasPermission(role, 'projetos', 'editar') || hasPermission(role, 'design', 'editar'))
  if (!pode) return { ok: false, resposta: NextResponse.json({ erro: 'Sem permissão para enviar lâminas.' }, { status: 403 }) }

  const { data: projeto } = await supabase.from('projetos').select('id').eq('id', projetoId).maybeSingle()
  if (!projeto) return { ok: false, resposta: NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 }) }

  return { ok: true, supabase, userId: user.id }
}

type Negado = { ok: false; resposta: NextResponse }
type Acesso = { ok: true; supabase: Supabase; userId: string } | Negado

const negado = (erro: string, status: number): Negado => ({ ok: false, resposta: NextResponse.json({ erro }, { status }) })

/** Sessão válida (getUser revalida o JWT) e o papel do usuário. */
async function sessaoComPapel(): Promise<{ supabase: Supabase; userId: string; role: PlatformRole | undefined } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return { supabase, userId: user.id, role: perfil?.role as PlatformRole | undefined }
}

/**
 * Porta de entrada de /api/uploads/projeto-foto: a mesma regra da policy de
 * escrita do antigo bucket `projetos_fotos` (0002) — quem enxerga o projeto
 * (`pode_ver_projeto`: equipe, o estúdio dono ou o cliente final) envia fotos.
 */
export async function projetoParaUpload(projetoId: string): Promise<Acesso> {
  if (isDemoMode() || !r2Configurado()) return negado('Armazenamento de fotos não configurado.', 503)
  const s = await sessaoComPapel()
  if (!s) return negado('Faça login de novo.', 401)
  const { data: pode, error } = await s.supabase.rpc('pode_ver_projeto', { p_projeto_id: projetoId })
  if (error || pode !== true) return negado('Projeto não encontrado.', 404)
  return { ok: true, supabase: s.supabase, userId: s.userId }
}

/**
 * Porta de entrada de /api/uploads/album: equipe que edita a produção (a regra
 * de `requireEdicaoDeProducao`) e enxerga o álbum pela RLS (`is_equipe`).
 * Devolve também se o álbum é de projeto: esses só guardam versões leves.
 */
export async function albumParaUpload(
  albumId: string,
): Promise<{ ok: true; supabase: Supabase; userId: string; deProjeto: boolean } | Negado> {
  if (isDemoMode() || !r2Configurado()) return negado('Armazenamento de fotos não configurado.', 503)
  const s = await sessaoComPapel()
  if (!s) return negado('Faça login de novo.', 401)
  const pode =
    !!s.role && EQUIPE_ROLES.includes(s.role) && (hasPermission(s.role, 'projetos', 'editar') || hasPermission(s.role, 'design', 'editar'))
  if (!pode) return negado('Sem permissão para editar álbuns.', 403)
  const { data: album } = await s.supabase.from('album_layouts').select('id, projeto_id').eq('id', albumId).maybeSingle()
  if (!album) return negado('Álbum não encontrado.', 404)
  return { ok: true, supabase: s.supabase, userId: s.userId, deProjeto: Boolean((album as { projeto_id: string | null }).projeto_id) }
}

/**
 * Porta de entrada de /api/uploads/midia (bucket público do R2): quem pode
 * criar na biblioteca de mídia — a regra de `requireModuleAction('midia', 'criar')`
 * e da RLS de `media_assets` (admin/gestor).
 */
export async function midiaParaUpload(acao: 'criar' | 'excluir' = 'criar'): Promise<Acesso> {
  if (isDemoMode() || !r2PublicoConfigurado()) return negado('Armazenamento de mídia não configurado.', 503)
  const s = await sessaoComPapel()
  if (!s) return negado('Faça login de novo.', 401)
  if (!s.role || !hasPermission(s.role, 'midia', acao)) return negado('Sem permissão para a biblioteca de mídia.', 403)
  return { ok: true, supabase: s.supabase, userId: s.userId }
}

/** Porta de entrada de /api/uploads/logo (bucket público do R2): só a conta do estúdio, para o próprio logo. */
export async function estudioParaUploadDeLogo(): Promise<Acesso> {
  if (isDemoMode() || !r2PublicoConfigurado()) return negado('Armazenamento de logos não configurado.', 503)
  const s = await sessaoComPapel()
  if (!s) return negado('Faça login de novo.', 401)
  if (s.role !== 'fotografo') return negado('Apenas contas de estúdio enviam logo.', 403)
  return { ok: true, supabase: s.supabase, userId: s.userId }
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
