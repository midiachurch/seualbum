import { expect, servico, sufixo, test } from './apoio'

/**
 * Regressão: "Editado há N min" no hub de álbuns usa o relógio na hora de
 * renderizar. Servidor e navegador quase nunca concordam no minuto (ainda mais
 * num `next dev` lento), e o React acusava "Hydration failed" e recriava a
 * árvore inteira no cliente. O relógio do navegador é adiantado 3 h para o
 * descompasso ser certo.
 */
test('o hub de álbuns hidrata sem erro mesmo com o relógio do navegador diferente', async ({ page }) => {
  const nome = `Hub ${sufixo()}`
  const { data, error } = await servico.from('album_layouts').insert({ nome, formato: '30x30', orientacao: 'quadrado' }).select('id').single()
  if (error) throw error

  const erros: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text())
  })
  page.on('pageerror', (e) => erros.push(e.message))
  await page.clock.setSystemTime(new Date(Date.now() + 3 * 60 * 60 * 1000))

  try {
    await page.goto('/admin/albuns')
    await expect(page.getByText(nome)).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(erros.filter((e) => /hydrat/i.test(e))).toEqual([])
  } finally {
    await servico.from('album_layouts').delete().eq('id', data.id)
  }
})
