import { expect, test, type Browser, type Page } from '@playwright/test'
import { Cenario, entrar, type Papel } from './support/seed'

/**
 * Fluxo de adicionais pelo navegador: o casal aprova a prova (com ou sem
 * presente), o estúdio fecha a fatura no painel e a gráfica recebe.
 * Mesma história de `src/lib/actions/adicionais.e2e.test.ts`, agora clicando.
 */

const COPIA = 'Cópia para os pais (20×20)'
const CAIXA = 'Caixa acrílica premium'

let cenario: Cenario

test.beforeEach(async () => {
  cenario = await new Cenario().criarUsuarios()
})

test.afterEach(async () => {
  await cenario.limpar()
})

/** Uma janela anônima por papel: sessões separadas, como pessoas diferentes. */
async function abrirComo(browser: Browser, papel: Papel): Promise<Page> {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  await entrar(page, cenario.usuarios[papel])
  return page
}

/** O casal abre a prova, clica em "Aprovar álbum" e confirma — cai na oferta. */
async function abrirOferta(page: Page, projetoId: string) {
  await page.goto(`/cliente/projetos/${projetoId}/prova`)
  await page.getByRole('button', { name: 'Aprovar álbum' }).click()
  await page.getByRole('dialog', { name: 'Tem certeza?' }).getByRole('button', { name: 'Sim, aprovar álbum' }).click()
  const oferta = page.getByRole('dialog', { name: 'Um presente para quem você ama?' })
  await expect(oferta).toBeVisible()
  return oferta
}

function itemDaOferta(oferta: ReturnType<Page['getByRole']>, nome: string) {
  return oferta.getByRole('listitem').filter({ hasText: nome })
}

test('escolher um adicional e depois "Não, obrigado" aprova sem adicionais', async ({ browser }) => {
  const projeto = await cenario.projetoComProva('Desistiu', 10)
  const casal = await abrirComo(browser, 'cliente')

  const oferta = await abrirOferta(casal, projeto.id)
  await itemDaOferta(oferta, COPIA).getByRole('button', { name: 'Adicionar' }).click()
  await expect(oferta.getByRole('button', { name: /Aprovar com adicionais · R\$\s?350(,00)?/ })).toBeVisible()
  await oferta.getByRole('button', { name: 'Não, obrigado — aprovar sem adicionais' }).click()

  // Tela final: nada de adicional, quantidade ou valor (regressão do proof-viewer).
  await expect(casal.getByRole('heading', { name: 'Álbum aprovado!' })).toBeVisible()
  const corpo = casal.locator('body')
  await expect(corpo).toContainText('Seu álbum foi aprovado e enviado para a produção gráfica!')
  await expect(corpo).not.toContainText(COPIA)
  await expect(corpo).not.toContainText(/\d+×/)
  await expect(corpo).not.toContainText('R$')
  await expect(corpo).not.toContainText('Enviamos ao seu fotógrafo')

  // E no banco também: 10 lâminas cabem no plano, sem fatura de adicional.
  await expect.poll(() => cenario.statusDoProjeto(projeto.id)).toBe('aprovado')
  expect(await cenario.faturasDoProjeto(projeto.id)).toEqual([])
})

test('casal pede 1 adicional → estúdio aceita e paga no Pix simulado → gráfica recebe', async ({ browser }) => {
  const projeto = await cenario.projetoComProva('Casamento', 10)

  // 1. Casal aprova com a cópia para os pais.
  const casal = await abrirComo(browser, 'cliente')
  const oferta = await abrirOferta(casal, projeto.id)
  await itemDaOferta(oferta, COPIA).getByRole('button', { name: 'Adicionar' }).click()
  await oferta.getByRole('button', { name: /Aprovar com adicionais · R\$\s?350(,00)?/ }).click()
  await expect(casal.getByRole('heading', { name: 'Álbum aprovado!' })).toBeVisible()
  await expect(casal.locator('body')).toContainText(`Enviamos ao seu fotógrafo o pedido de 1× ${COPIA}`)
  await expect.poll(() => cenario.statusDoProjeto(projeto.id)).toBe('aprovado_aguardando_pagamento')

  // 2. Estúdio vê o aviso no painel e vai para o fechamento.
  const estudio = await abrirComo(browser, 'fotografo')
  await expect(estudio).toHaveURL(/\/dashboard$/)
  await estudio.getByRole('link', { name: /Seu cliente pediu 1 adicional/ }).click()
  await expect(estudio).toHaveURL(/\/dashboard\/meus-albuns#laminas-extras$/)

  const cartao = estudio.locator('#laminas-extras article').filter({ hasText: projeto.nome })
  await expect(cartao).toContainText(`1× ${COPIA}`)
  await expect(cartao).toContainText('Pedido pelo seu cliente')
  const pagar = cartao.getByRole('button', { name: /Pagar R\$\s?150(,00)? e liberar para impressão/ })
  await expect(pagar).toBeDisabled()

  // 3. Aceita o pedido do casal; o pagamento libera.
  await cartao.getByRole('button', { name: 'Aceitar' }).click()
  await expect(cartao).toContainText('Aceito por você')
  await expect(pagar).toBeEnabled()
  await pagar.click()

  // 4. Paga no Pix (simulado).
  const modal = estudio.getByRole('dialog', { name: 'Fechar e liberar para impressão' })
  await modal.getByRole('button', { name: 'Pix' }).click()
  await expect(modal.getByRole('button', { name: 'Pix' })).toHaveAttribute('aria-pressed', 'true')
  await modal.getByRole('button', { name: /^Pagar R\$\s?150(,00)?$/ }).click()
  await expect(estudio.getByRole('status')).toContainText(
    `Pagamento confirmado: "${projeto.nome}" foi liberado para impressão`,
  )

  await expect.poll(() => cenario.statusDoProjeto(projeto.id)).toBe('aprovado')
  expect(await cenario.faturasDoProjeto(projeto.id)).toEqual([
    { status_pagamento: 'pago', valor_total: 150, forma_pagamento: 'pix' },
  ])

  // 5. A gráfica (admin) vê o álbum na fila com o adicional para produzir junto.
  const admin = await abrirComo(browser, 'admin')
  await admin.goto('/admin/producao/grafica')
  const ficha = admin.locator('div.rounded-2xl').filter({ hasText: projeto.nome }).filter({ hasText: 'Produzir junto' })
  await expect(ficha).toContainText(`1× ${COPIA}`)
})

test('estúdio recusa o adicional → fatura cancelada e álbum liberado sem cobrança', async ({ browser }) => {
  const projeto = await cenario.projetoComProva('Debutante', 10)

  const casal = await abrirComo(browser, 'cliente')
  const oferta = await abrirOferta(casal, projeto.id)
  await itemDaOferta(oferta, CAIXA).getByRole('button', { name: 'Adicionar' }).click()
  await oferta.getByRole('button', { name: /Aprovar com adicionais · R\$\s?190(,00)?/ }).click()
  await expect(casal.getByRole('heading', { name: 'Álbum aprovado!' })).toBeVisible()
  await expect.poll(() => cenario.statusDoProjeto(projeto.id)).toBe('aprovado_aguardando_pagamento')

  const estudio = await abrirComo(browser, 'fotografo')
  await estudio.goto('/dashboard/meus-albuns')
  const cartao = estudio.locator('#laminas-extras article').filter({ hasText: projeto.nome })
  await expect(cartao).toContainText(`1× ${CAIXA}`)
  await cartao.getByRole('button', { name: 'Recusar' }).click()

  await expect(estudio.getByRole('status')).toContainText(`Sem cobrança: "${projeto.nome}" foi liberado para impressão.`)
  await expect(cartao).toHaveCount(0)
  await expect.poll(() => cenario.statusDoProjeto(projeto.id)).toBe('aprovado')
  expect(await cenario.faturasDoProjeto(projeto.id)).toEqual([
    expect.objectContaining({ status_pagamento: 'cancelado', valor_total: 0 }),
  ])

  // Segue para a gráfica, sem nada para produzir junto.
  const admin = await abrirComo(browser, 'admin')
  await admin.goto('/admin/producao/grafica')
  const ficha = admin.locator('div.rounded-2xl').filter({ hasText: projeto.nome })
  await expect(ficha.first()).toBeVisible()
  await expect(ficha.first()).not.toContainText('Produzir junto')
})
