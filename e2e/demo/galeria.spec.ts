import { expect, test } from '@playwright/test'

// Fixture somente demonstrativa; não usa identidade ou segredo de ambiente real.
const clienteDemo = Buffer.from(JSON.stringify({
  email: 'galeria-demo@example.invalid',
  nome_estudio: 'Galeria Demo',
  role: 'cliente',
})).toString('base64')

const imagem = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#ddd"/></svg>'

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{
    name: 'seualbum_demo_session', value: clienteDemo, url: 'http://127.0.0.1:3119',
  }])
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' && url.port === '3119') return route.continue()
    if (route.request().resourceType() === 'image') {
      return route.fulfill({ contentType: 'image/svg+xml', body: imagem })
    }
    return route.abort()
  })
  await page.goto('/cliente/projetos/proj-1042?aba=fotos')
  await expect(page.getByRole('button', { name: /^Ampliar foto / }).first()).toBeVisible()
})

test('favorito atualiza contador, filtro e retorna à grade', async ({ page }) => {
  const contador = page.getByRole('status').filter({ hasText: /fotos favoritas/ })
  const antes = await contador.innerText()
  const [favoritas, total] = antes.match(/\d+/g)!.map(Number)
  await page.getByRole('button', { name: 'Marcar como favorita', exact: true }).first().click()
  await expect(contador).toHaveText(`${favoritas + 1} de ${total} fotos favoritas`)
  await page.getByRole('button', { name: 'Mostrar favoritas', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Ampliar foto / })).toHaveCount(favoritas + 1)
  await expect(page.getByRole('button', { name: 'Marcar como favorita', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Remover dos favoritos', exact: true }).first().click()
  await expect(contador).toHaveText(`${favoritas} de ${total} fotos favoritas`)
  await expect(page.getByRole('button', { name: /^Ampliar foto / })).toHaveCount(favoritas)
  await page.getByRole('button', { name: 'Mostrar todas as fotos', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Ampliar foto / })).toHaveCount(total)
})

test('modal navega por teclado, fecha com Escape e restaura foco', async ({ page }) => {
  const thumbs = page.getByRole('button', { name: /^Ampliar foto / })
  const primeiroNome = await thumbs.nth(0).getAttribute('aria-label')
  const segundoNome = await thumbs.nth(1).getAttribute('aria-label')
  await thumbs.nth(0).click()
  const modal = page.getByRole('dialog', { name: 'Visualização de fotografia' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('img')).toHaveAttribute('alt', primeiroNome!.replace('Ampliar foto ', ''))
  await page.keyboard.press('ArrowRight')
  await expect(modal.getByRole('img')).toHaveAttribute('alt', segundoNome!.replace('Ampliar foto ', ''))
  await page.keyboard.press('ArrowLeft')
  await expect(modal.getByRole('img')).toHaveAttribute('alt', primeiroNome!.replace('Ampliar foto ', ''))
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await expect(thumbs.nth(0)).toBeFocused()
})
