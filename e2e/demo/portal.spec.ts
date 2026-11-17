import { expect, test } from '@playwright/test'

test('portal aceita visitante sem cadastro e falha fechado sem backend',async({page,context})=>{
  await page.goto(`/portal/${'a'.repeat(64)}`)
  await expect(page.getByRole('heading',{name:'Sua galeria privada'})).toBeVisible()
  await page.getByLabel('Código de acesso').fill('12345678')
  await page.getByRole('button',{name:'Entrar na galeria'}).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Acesso indisponível')
  expect((await context.cookies()).some(c=>c.name==='seualbum_portal')).toBe(false)
})
test('portal inválido não revela projeto',async({page})=>{
  const response=await page.goto('/portal/link-invalido')
  expect(response?.status()).toBe(404)
  await expect(page.getByLabel('Código de acesso')).toHaveCount(0)
})
