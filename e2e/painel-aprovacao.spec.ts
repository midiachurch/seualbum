import { expect, test } from '@playwright/test'
import { Cenario, entrar } from './support/seed'

/**
 * Painel de aprovação do cliente (migration 0039): a prova aguardando aparece
 * em destaque em /cliente, o checklist conta as lâminas marcadas como ok e
 * "Aprovar álbum" do painel cai no MESMO fluxo da prova (modal + upsell).
 * Exige a 0039 aplicada no banco local.
 */

let cenario: Cenario

test.beforeEach(async () => {
  cenario = await new Cenario().criarUsuarios()
})

test.afterEach(async () => {
  await cenario.limpar()
})

test('casal revisa pelo painel e aprova pelo fluxo da prova', async ({ page }) => {
  const projeto = await cenario.projetoComProva('Painel', 3)
  await entrar(page, cenario.usuarios.cliente)

  await page.goto('/cliente')
  const destaque = page.locator('article').filter({ hasText: projeto.nome })
  await expect(destaque).toContainText('Aguardando sua aprovação')
  await expect(destaque).toContainText('0 de 4 lâminas revisadas')
  await destaque.getByRole('link', { name: 'Ver painel de aprovação' }).click()

  await expect(page.getByRole('tab', { name: 'Aprovação', selected: true })).toBeVisible()
  await page.getByRole('button', { name: 'Marcar Lâmina 2 como ok' }).click()
  await expect(page.getByText('1 de 4 lâminas revisadas')).toBeVisible()

  // Persistiu: depois de recarregar, continua marcada.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Desfazer "ok" da Lâmina 2' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('link', { name: 'Aprovar álbum' }).click()
  await page.getByRole('dialog', { name: 'Tem certeza?' }).getByRole('button', { name: 'Sim, aprovar álbum' }).click()
  const oferta = page.getByRole('dialog', { name: 'Um presente para quem você ama?' })
  await oferta.getByRole('button', { name: 'Não, obrigado — aprovar sem adicionais' }).click()
  await expect(page.getByRole('heading', { name: 'Álbum aprovado!' })).toBeVisible()
  await expect.poll(() => cenario.statusDoProjeto(projeto.id)).toBe('aprovado')
})

test('"Pedir ajustes" sem comentários manda para a prova', async ({ page }) => {
  const projeto = await cenario.projetoComProva('Ajustes', 2)
  await entrar(page, cenario.usuarios.cliente)

  await page.goto(`/cliente/projetos/${projeto.id}`)
  await page.getByRole('button', { name: 'Pedir ajustes' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Pedir ajustes ao estúdio' })
  await expect(dialogo).toContainText('Você ainda não deixou nenhum comentário')
  await dialogo.getByRole('link', { name: 'Abrir a prova' }).click()
  await expect(page).toHaveURL(new RegExp(`/cliente/projetos/${projeto.id}/prova`))
  expect(await cenario.statusDoProjeto(projeto.id)).toBe('aguardando_aprovacao_cliente')
})
