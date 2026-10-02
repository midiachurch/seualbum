'use server'

import { createPublicClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo-mode'

/**
 * Ações do link de aprovação (cliente sem conta). Nada aqui usa sessão nem a
 * chave de serviço: o cliente anônimo só chama as funções da 0027, que
 * exigem o token do link e conferem o status da aprovação no banco.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

const TOKEN_RE = /^[0-9a-f]{64}$/

export async function comentarNoAlbum(
  token: string,
  laminaIndice: number,
  x: number | null,
  y: number | null,
  texto: string,
  autor: string,
): Promise<Resultado<{ id: string }>> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const t = String(texto ?? '').trim()
  const a = String(autor ?? '').trim()
  const coord = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v * 100) / 100)) : null)
  if (!TOKEN_RE.test(token) || !Number.isInteger(laminaIndice) || laminaIndice < 0) return { ok: false, erro: 'Link inválido.' }
  if (t.length < 1 || t.length > 1000) return { ok: false, erro: 'Escreva o comentário (até 1000 caracteres).' }
  if (a.length < 1 || a.length > 80) return { ok: false, erro: 'Informe seu nome.' }

  const { data, error } = await createPublicClient().rpc('album_aprovacao_comentar', {
    p_token: token,
    p_lamina: laminaIndice,
    p_x: coord(x),
    p_y: coord(y),
    p_texto: t,
    p_autor: a,
  })
  if (error || !data) return { ok: false, erro: error?.message?.includes('não aceita') ? 'Este álbum já foi respondido.' : 'Não foi possível enviar o comentário.' }
  return { ok: true, id: String(data) }
}

export async function decidirAlbum(
  token: string,
  decisao: 'aprovado' | 'alteracoes',
  autor: string,
  mensagem: string,
): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const a = String(autor ?? '').trim()
  if (!TOKEN_RE.test(token) || (decisao !== 'aprovado' && decisao !== 'alteracoes')) return { ok: false, erro: 'Link inválido.' }
  if (a.length < 1 || a.length > 80) return { ok: false, erro: 'Informe seu nome.' }
  const { error } = await createPublicClient().rpc('album_aprovacao_decidir', {
    p_token: token,
    p_decisao: decisao,
    p_autor: a,
    p_mensagem: String(mensagem ?? '').slice(0, 2000) || null,
  })
  if (error) return { ok: false, erro: error.message?.includes('já foi respondido') ? 'Este álbum já foi respondido.' : 'Não foi possível registrar sua resposta.' }
  return { ok: true }
}
