import { expect, test } from '@playwright/test'
import { Cenario, entrar, type Papel } from './support/seed'

const cenario = new Cenario()

test.beforeAll(async () => {
  await cenario.criarUsuarios()
})

test.afterAll(async () => {
  await cenario.limpar()
})

const CASAS: { papel: Papel; caminho: RegExp; marca: RegExp }[] = [
  { papel: 'fotografo', caminho: /\/dashboard$/, marca: /Olá, E2E fotografo/ },
  { papel: 'cliente', caminho: /\/cliente$/, marca: /Seus álbuns estão por aqui/ },
  { papel: 'admin', caminho: /\/admin$/, marca: /^Dashboard$/ },
]

for (const { papel, caminho, marca } of CASAS) {
  test(`login de ${papel} cai na própria área`, async ({ page }) => {
    await entrar(page, cenario.usuarios[papel])
    await expect(page).toHaveURL(caminho)
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(marca)

    // Área de outro papel devolve para a casa (proxy).
    const outra = papel === 'admin' ? '/dashboard' : '/admin'
    await page.goto(outra)
    await expect(page).toHaveURL(caminho)
  })
}

test('senha errada fica no login com aviso', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel('E-mail').fill(cenario.usuarios.cliente.email)
  await page.getByLabel('Senha').fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos.' })).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/login/)
})
