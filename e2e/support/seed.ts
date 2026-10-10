import { expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SERVICE_KEY, SUPABASE_URL } from './ambiente'

/**
 * Dados de teste criados pela service role do Supabase LOCAL — a mesma
 * semeadura de `src/lib/actions/adicionais.e2e.test.ts`. Cada teste cria os
 * próprios usuários e projetos (sufixo único) e apaga tudo no fim.
 */

export type Papel = 'admin' | 'fotografo' | 'cliente'
export type Usuario = { id: string; email: string; senha: string }

export const SENHA = 'senha-e2e-123'

/** 1×1 PNG cinza: a lâmina precisa de um arquivo de verdade no Storage local. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+P9/PQAJYwPNGvXc1gAAAABJRU5ErkJggg==',
  'base64',
)

export function servico(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export class Cenario {
  readonly db = servico()
  readonly sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  readonly usuarios = {} as Record<Papel, Usuario>
  private clienteId = ''

  /** Admin, estúdio e casal (com a linha em `clientes` ligada ao estúdio). */
  async criarUsuarios() {
    for (const papel of ['admin', 'fotografo', 'cliente'] as const) {
      const email = `${papel}-${this.sufixo}@e2e.local`
      const { data, error } = await this.db.auth.admin.createUser({
        email,
        password: SENHA,
        email_confirm: true,
        app_metadata: { role: papel },
        user_metadata: { nome_completo: `E2E ${papel}`, estudio: 'Estúdio E2E' },
      })
      if (error) throw error
      this.usuarios[papel] = { id: data.user.id, email, senha: SENHA }
    }
    const { data: c, error } = await this.db
      .from('clientes')
      .insert({ user_id: this.usuarios.cliente.id, fotografo_id: this.usuarios.fotografo.id, nome: 'Casal E2E' })
      .select('id')
      .single()
    if (error) throw error
    this.clienteId = c.id
    return this
  }

  /** Projeto com a prova liberada ao casal: versão 1 aprovada, `laminas` lâminas + capa. */
  async projetoComProva(nome: string, laminas: number) {
    const { data: p, error } = await this.db
      .from('projetos')
      .insert({
        nome: `${nome} ${this.sufixo}`,
        cliente_id: this.clienteId,
        fotografo_id: this.usuarios.fotografo.id,
        status: 'aguardando_aprovacao_cliente',
        laminas_inclusas: 15,
        preco_lamina_extra: 12,
      })
      .select('id, nome')
      .single()
    if (error) throw error
    const { data: v, error: e2 } = await this.db
      .from('design_versions')
      .insert({ projeto_id: p.id, numero: 1, status: 'aprovada' })
      .select('id')
      .single()
    if (e2) throw e2
    // Storage antigo do Supabase (não o R2): um arquivo só, apontado por todas.
    const caminho = `${p.id}/versoes/e2e/lamina.png`
    const { error: e3 } = await this.db.storage
      .from('projetos_fotos')
      .upload(caminho, PNG, { contentType: 'image/png', upsert: true })
    if (e3) throw e3
    const { error: e4 } = await this.db.from('versoes_laminas').insert(
      Array.from({ length: laminas + 1 }, (_, i) => ({
        versao_id: v.id,
        ordem: i + 1,
        storage_path: caminho,
        eh_capa: i === 0,
      })),
    )
    if (e4) throw e4
    return { id: p.id as string, nome: p.nome as string }
  }

  async statusDoProjeto(id: string) {
    const { data } = await this.db.from('projetos').select('status').eq('id', id).single()
    return data?.status as string | undefined
  }

  async faturasDoProjeto(id: string) {
    const { data, error } = await this.db
      .from('faturas')
      .select('status_pagamento, valor_total, forma_pagamento')
      .eq('projeto_id', id)
    if (error) throw error
    return data
  }

  async limpar() {
    if (!this.usuarios.fotografo) return
    const { data: projetos } = await this.db.from('projetos').select('id').eq('fotografo_id', this.usuarios.fotografo.id)
    for (const p of projetos ?? []) {
      await this.db.storage.from('projetos_fotos').remove([`${p.id}/versoes/e2e/lamina.png`])
    }
    await this.db.from('projetos').delete().eq('fotografo_id', this.usuarios.fotografo.id)
    if (this.clienteId) await this.db.from('clientes').delete().eq('id', this.clienteId)
    for (const u of Object.values(this.usuarios)) await this.db.auth.admin.deleteUser(u.id)
  }
}

/** Entra pelo formulário de /auth/login, como um usuário de verdade. */
export async function entrar(page: Page, usuario: Usuario) {
  await page.goto('/auth/login')
  await page.getByLabel('E-mail').fill(usuario.email)
  await page.getByLabel('Senha').fill(usuario.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/auth\/login/)
}
