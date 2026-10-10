import { test as base, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { laminaEmCm } from '../../src/lib/resolucao'
import { ADMIN_E2E, SUPABASE_SERVICE, SUPABASE_URL, URL_R2_FALSO } from './ambiente'

type QuadroSalvo = { id: string; x: number; y: number; w: number; h: number; fotoId: string | null }

/** Service role do Supabase LOCAL: semear dados e conferir o banco. */
export const servico = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

/** Sufixo único por execução, para nomes que não colidem entre rodadas. */
export const sufixo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * `test` com o R2 falso ligado: o navegador fala com o R2 só por URLs
 * assinadas (https://<conta>.r2.cloudflarestorage.com/...). Elas são
 * desviadas para o servidor falso local — PUT dos envios e GET das imagens.
 */
export const test = base.extend<{ r2: void }>({
  r2: [
    async ({ context }, use) => {
      await context.route(/^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\//, async (route) => {
        const u = new URL(route.request().url())
        // Uma nova tentativa se a conexão cair (máquina carregada); o erro real aparece no log.
        for (let tentativa = 1; ; tentativa++) {
          try {
            const resposta = await route.fetch({ url: `${URL_R2_FALSO}${u.pathname}${u.search}`, timeout: 60_000 })
            await route.fulfill({ response: resposta })
            return
          } catch (e) {
            console.warn('[r2-falso] desvio falhou', route.request().method(), u.pathname, e instanceof Error ? e.message : e)
            if (tentativa >= 2) return route.abort()
          }
        }
      })
      context.on('response', (r) => {
        if (r.url().includes('/api/uploads/') && r.status() >= 400) console.warn('[upload]', r.status(), r.url())
      })
      await use()
    },
    { auto: true },
  ],
})
export { expect }

/** JPEG gerado no próprio navegador (canvas), com cor e um rótulo para distinguir. */
export async function gerarJpeg(page: Page, largura: number, altura: number, cor: string, rotulo: string): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ largura, altura, cor, rotulo }) => {
      const canvas = new OffscreenCanvas(largura, altura)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = cor
      ctx.fillRect(0, 0, largura, altura)
      ctx.fillStyle = '#ffffff'
      ctx.font = `${Math.round(altura / 6)}px sans-serif`
      ctx.fillText(rotulo, largura / 10, altura / 2)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(s)
    },
    { largura, altura, cor, rotulo },
  )
  return Buffer.from(base64, 'base64')
}

/** Cria um álbum avulso pelo hub (/admin/albuns) e espera o editor abrir. Devolve o id. */
export async function criarAlbumAvulso(page: Page, nome: string, opcoes: { paginas?: number } = {}): Promise<string> {
  await page.goto('/admin/albuns')
  await page.getByRole('button', { name: 'Novo Álbum' }).click()
  const modal = page.getByRole('dialog', { name: 'Novo Álbum' })
  await modal.getByLabel('Nome do álbum').fill(nome)
  await modal.getByLabel('Cliente').fill('Cliente E2E')
  if (opcoes.paginas) await modal.getByLabel('Quantidade inicial de páginas').fill(String(opcoes.paginas))
  await modal.getByRole('button', { name: 'Criar Álbum' }).click()
  await page.waitForURL(/\/admin\/albuns\/[0-9a-f-]{36}/, { timeout: 120_000 })
  await esperarEditor(page)
  return page.url().match(/albuns\/([0-9a-f-]{36})/)![1]
}

/** O editor (client component pesado, com canvas) terminou de montar. */
export async function esperarEditor(page: Page) {
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 })
}

/** Envia fotos pelo painel "Fotos" do editor (input de arquivo), pelo fluxo real de upload. */
export async function enviarFotos(page: Page, fotos: { nome: string; jpeg: Buffer }[]) {
  await page.getByRole('navigation', { name: 'Ferramentas' }).getByRole('button', { name: 'Fotos' }).click()
  await page.locator('input[type="file"]').setInputFiles(fotos.map((f) => ({ name: f.nome, mimeType: 'image/jpeg', buffer: f.jpeg })))
  for (const f of fotos) await expect(page.getByRole('button', { name: new RegExp(`^${f.nome.replace('.', '\\.')}`) })).toBeVisible({ timeout: 120_000 })
}

/** Documento salvo do álbum (o que o servidor tem). */
export async function documentoSalvo(albumId: string) {
  const { data, error } = await servico.from('album_layouts').select('documento, revisao, fotos').eq('id', albumId).single()
  if (error) throw error
  return data as { documento: { laminas: { quadros: QuadroSalvo[]; textos: { id: string; texto: string; fonte: string }[] }[] }; revisao: number; fotos: { id: string; nome: string }[] }
}

/** Espera o autosave terminar ("Salvo agora" no topo do editor). */
export async function esperarSalvo(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'Salvo agora' })).toBeVisible({ timeout: 30_000 })
}

/**
 * Centro de um quadro (mm do documento) em pixels da página, com a mesma conta
 * do canvas-lamina: a lâmina com sangria cabe no palco com 28 px de folga.
 */
export async function centroDoQuadro(page: Page, albumId: string, q: QuadroSalvo) {
  const { data: album, error } = await servico.from('album_layouts').select('formato, orientacao, sangria_mm').eq('id', albumId).single()
  if (error) throw error
  const cm = laminaEmCm({ formato: album.formato, orientacao: album.orientacao })!
  const s = Number(album.sangria_mm)
  const totalW = cm.largura * 10 + 2 * s
  const totalH = cm.altura * 10 + 2 * s
  const caixa = (await page.locator('.konvajs-content canvas').first().boundingBox())!
  const escala = Math.min((caixa.width - 56) / totalW, (caixa.height - 56) / totalH)
  const origemX = (caixa.width - totalW * escala) / 2 + s * escala
  const origemY = (caixa.height - totalH * escala) / 2 + s * escala
  return { x: caixa.x + origemX + (q.x + q.w / 2) * escala, y: caixa.y + origemY + (q.y + q.h / 2) * escala }
}

/** Arrasta com o mouse de verdade (o Konva ouve pointer events no palco). */
export async function arrastar(page: Page, de: { x: number; y: number }, para: { x: number; y: number }) {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(de.x + 10, de.y + 10, { steps: 3 })
  await page.mouse.move(para.x, para.y, { steps: 15 })
  await page.mouse.up()
}

export async function idDoAdmin() {
  const { data } = await servico.from('profiles').select('id').eq('email', ADMIN_E2E.email).maybeSingle()
  return (data?.id as string | undefined) ?? null
}
