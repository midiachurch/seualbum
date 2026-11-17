import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const proxy = 'http://127.0.0.1:3313'
const output = 'docs/operacao-digital/evidence/galerias-v1/capturas'
// Toda identidade e conteúdo abaixo são sintéticos, exclusivamente no banco descartável.
// Auth, Next, Server Actions, PostgREST e SQL são reais. R2/mídia são substituídos.
for (const width of [1440, 390]) {
  test(`fotógrafo e cliente completam galeria em ${width}px`, async ({ page, request, browser }) => {
    await mkdir(output, { recursive: true })
    await page.setViewportSize({ width, height: 900 })
    const email = `galerias-${width}@example.invalid`,
      password = 'synthetic-local-only-password'
    const signup = await request.post(`${proxy}/auth/v1/signup`, {
      headers: { apikey: process.env.SEUALBUM_PORTAL_TEST_ANON! },
      data: {
        email,
        password,
        data: { role: 'fotografo', nome_completo: 'Estúdio de teste', estudio: 'Estúdio de teste' },
      },
    })
    expect(signup.ok(), `signup local status ${signup.status()}`).toBe(true)
    await page.route('https://synthetic.r2.cloudflarestorage.com/**', (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: art }),
    )
    await page.goto('/auth/login')
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/dashboard\/galerias$/)
    await expect(page.getByRole('heading', { name: 'Suas galerias' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Novo pedido', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Meus álbuns', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Criar galeria', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Nome da galeria').fill(`Ensaio de teste · ${width}px`)
    await page.getByLabel('Nome do cliente').fill('Cliente de teste')
    await page.getByLabel('E-mail do cliente').fill(`cliente-${width}@example.invalid`)
    await page.getByRole('button', { name: 'Criar e adicionar fotos' }).click()
    await expect(page).toHaveURL(/dashboard\/galerias\/[a-f0-9-]+$/)
    await expect(page.getByText('Nenhuma foto enviada ainda.')).toBeVisible()
    const id = new URL(page.url()).pathname.split('/').pop()!
    // Falha de confirmação após PUT: retry deve conservar arquivo/chave e não repetir PUT.
    // Transporte R2 substituído; persistência/idempotência do banco é coberta pelo gate SQL/HTTP.
    let signatures = 0,
      puts = 0,
      confirmations = 0,
      uploadId = '',
      uploadKey = ''
    await page.route('**/api/uploads/projeto-foto', async (route) => {
      signatures++
      const body = route.request().postDataJSON()
      uploadId = body.idArquivo
      uploadKey = `projetos/${id}/fotos/${uploadId}.png`
      await route.fulfill({
        json: {
          key: uploadKey,
          url: 'http://127.0.0.1:3314/__test/upload',
          headers: { 'Content-Type': 'image/png' },
        },
      })
    })
    await page.route('**/__test/upload', (route) => {
      puts++
      return route.fulfill({ status: 200, body: '' })
    })
    await page.route('**/api/uploads/projeto-foto/confirmar', async (route) => {
      confirmations++
      expect(route.request().postDataJSON().key).toBe(uploadKey)
      if (confirmations === 1)
        await route.fulfill({ status: 503, json: { erro: 'Falha de confirmação simulada.' } })
      else
        await route.fulfill({
          json: { id: uploadId, url: 'https://synthetic.r2.cloudflarestorage.com/synthetic/preview.png' },
        })
    })
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'retry-local.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cN1sAAAAASUVORK5CYII=',
          'base64',
        ),
      })
    await expect(page.getByText('Falha de confirmação simulada.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
    await expect(page.getByText('retry-local.png · Concluído', { exact: true })).toBeVisible()
    expect({ signatures, puts, confirmations }).toEqual({ signatures: 1, puts: 1, confirmations: 2 })
    await page.unroute('**/api/uploads/projeto-foto')
    await page.unroute('**/api/uploads/projeto-foto/confirmar')
    await page.unroute('**/__test/upload')
    await request.post(`${proxy}/__test/addphotos`, {
      headers: { 'x-test-control': process.env.SEUALBUM_PORTAL_CONTROL! },
      data: { id },
    })
    await page.reload()
    await expect(page.getByRole('button', { name: /^Ampliar foto / })).toHaveCount(6)
    await page.screenshot({ path: `${output}/fotografo-fotos-${width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Compartilhar', exact: true }).click()
    await expect(page.getByText('Acesso ainda não criado', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Gerar link e código' }).click()
    await expect(page.getByLabel('Código de acesso', { exact: true })).toBeVisible()
    const url = await page.getByLabel('Link privado', { exact: true }).inputValue()
    const code = await page.getByLabel('Código de acesso', { exact: true }).inputValue()
    await page.screenshot({
      path: `${output}/fotografo-compartilhar-${width}.png`,
      fullPage: true,
      mask: [
        page.getByLabel('Link privado', { exact: true }),
        page.getByLabel('Código de acesso', { exact: true }),
      ],
    })
    await page.reload()
    await expect(page.getByText('Acesso ativo', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Código de acesso', { exact: true })).toHaveCount(0)
    const guest = await browser.newContext({ viewport: { width, height: 900 } })
    const client = await guest.newPage()
    await client.route('**/portal/*/foto/**', (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: art }),
    )
    await client.goto(url)
    await client.screenshot({ path: `${output}/cliente-entrada-${width}.png`, fullPage: true })
    await client.getByLabel('Código de acesso').fill(code)
    await client.getByRole('button', { name: 'Entrar na galeria', exact: true }).click()
    await expect(
      client.getByRole('heading', { name: `Ensaio de teste · ${width}px`, exact: true }),
    ).toBeVisible()
    await client.getByRole('button', { name: 'Marcar como favorita', exact: true }).first().click()
    await expect(client.getByRole('status')).toContainText('1 foto favorita')
    await client.reload()
    await expect(client.getByRole('button', { name: 'Remover dos favoritos', exact: true })).toHaveCount(1)
    await client.screenshot({ path: `${output}/cliente-galeria-${width}.png`, fullPage: true })
    await client.getByRole('button', { name: 'Entregar seleção', exact: true }).click()
    await client.getByRole('button', { name: 'Confirmar entrega', exact: true }).click()
    await expect(client.getByRole('status')).toContainText('revisão 1')
    await client.getByRole('button', { name: 'Marcar como favorita', exact: true }).first().click()
    await client.getByRole('button', { name: 'Entregar seleção', exact: true }).click()
    await client.getByRole('button', { name: 'Confirmar entrega', exact: true }).click()
    await expect(client.getByRole('status')).toContainText('revisão 2')
    await client.screenshot({ path: `${output}/cliente-entrega-${width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Seleções', exact: true }).click()
    await expect(page.getByText(/Revisão 2 · 2 fotos/)).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar CSV', exact: true }).first().click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    let csv = ''
    for await (const chunk of stream!) csv += chunk.toString()
    expect(csv).toContain('ensaio-')
    await expect(page.getByRole('link', { name: /^ensaio-/ })).toHaveCount(2)
    await page.screenshot({ path: `${output}/fotografo-selecoes-${width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Compartilhar', exact: true }).click()
    await page.getByRole('button', { name: 'Revogar acesso', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar revogação', exact: true }).click()
    await page.reload()
    await expect(page.getByText('Acesso revogado', { exact: true })).toBeVisible()
    await client.reload()
    await expect(client.getByRole('heading', { name: 'Sua galeria privada' })).toBeVisible()
    await client.getByLabel('Código de acesso').fill(code)
    await client.getByRole('button', { name: 'Entrar na galeria', exact: true }).click()
    await expect(client.getByRole('main').getByRole('alert')).toContainText('revogado')
    await client.screenshot({ path: `${output}/cliente-revogado-${width}.png`, fullPage: true })
    await guest.close()
    // Galeria sintética de OUTRO fotógrafo: não deve aparecer nem ser acessível por URL.
    await page.goto('/dashboard/galerias/f2000000-0000-4000-8000-000000000001')
    // Next pode iniciar streaming com HTTP 200 antes de notFound; exigir tela 404 e ausência do conteúdo.
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Portal browser sintético', exact: true })).toHaveCount(0)
    await page.goto('/dashboard/galerias')
    await expect(page.getByText('Portal browser sintético', { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: `Ensaio de teste · ${width}px`, exact: true, level: 3 }),
    ).toBeVisible()
    await page.screenshot({ path: `${output}/fotografo-lista-${width}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
const art =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#b6c4b9"/><stop offset="1" stop-color="#dee4d7"/></linearGradient></defs><rect width="600" height="600" fill="url(#a)"/><path d="M0 520L220 170 430 520Z" fill="#6c8778"/><circle cx="420" cy="160" r="58" fill="#f5ead4"/><path d="M210 600L440 290 700 600Z" fill="#8ca495"/></svg>'
