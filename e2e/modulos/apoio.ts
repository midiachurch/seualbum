import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { ANON_KEY, SERVICE_KEY, SUPABASE_URL } from '../support/ambiente'
import { SENHA, type Usuario } from '../support/seed'

/** Service role do Supabase LOCAL: semear dados e conferir o banco. */
export const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
export const sufixo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export type Fotografo = Usuario & { org: string; sessao: SupabaseClient }

/** Fotógrafo de verdade: o trigger cria perfil, estúdio e organização; `sessao` fala como ele (RLS valendo). */
export async function criarFotografo(rotulo: string): Promise<Fotografo> {
  const email = `${rotulo}-${sufixo()}@e2e.local`
  const { data, error } = await db.auth.admin.createUser({
    email, password: SENHA, email_confirm: true, app_metadata: { role: 'fotografo' },
    user_metadata: { nome_completo: `E2E ${rotulo}`, estudio: `Estúdio ${rotulo} ${sufixo()}` },
  })
  if (error) throw error
  const { data: org, error: eOrg } = await db.from('organizacoes').select('id').eq('dono_id', data.user.id).single()
  if (eOrg) throw eOrg
  const sessao = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: eLogin } = await sessao.auth.signInWithPassword({ email, password: SENHA })
  if (eLogin) throw eLogin
  return { id: data.user.id, email, senha: SENHA, org: org.id as string, sessao }
}

export const rpc = async <T = unknown>(c: SupabaseClient, nome: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await c.rpc(nome, args)
  if (error) throw new Error(`${nome}: ${error.message}`)
  return data as T
}

/** Galeria com fotos no R2 falso (só linhas: o teste não abre a imagem) e portal com link + código. */
export async function galeriaComPortal(dono: Fotografo, nome: string, fotos: { nome: string; favorita?: boolean }[]) {
  const projeto = randomUUID()
  await rpc(dono.sessao, 'criar_galeria_digital', { p_id: projeto, p_nome: nome, p_cliente_nome: 'Cliente E2E', p_cliente_email: `cliente-${sufixo()}@e2e.local` })
  const { data: linhas, error } = await db.from('fotos').insert(fotos.map((f, i) => ({
    projeto_id: projeto, storage_path: `projetos/${projeto}/fotos/${i + 1}.jpg`, bucket: 'r2', nome_original: f.nome, favorita: f.favorita ?? false,
  }))).select('id,nome_original')
  if (error) throw error
  const link = randomBytes(32).toString('hex')
  const codigo = '12345678'
  await rpc(dono.sessao, 'gerir_portal', { p_projeto_id: projeto, p_link_hash: createHash('sha256').update(link).digest('hex'), p_codigo: codigo })
  return { projeto, link, codigo, fotos: (linhas ?? []) as { id: string; nome_original: string }[] }
}
