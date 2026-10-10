import { Cenario } from '../support/seed'
import { URL_R2_FALSO } from './ambiente'
import { enviarFotos, esperarEditor, esperarSalvo, expect, gerarJpeg, test } from './apoio'

/**
 * Álbum de projeto: o editor abre pelo projeto, as fotos sobem pelo fluxo do
 * projeto (R2 falso) e "Publicar versão" gera os JPGs, envia ao R2 e cria a
 * versão — que aparece na prova da equipe.
 */
test.describe('editor de álbum de projeto', () => {
  const cenario = new Cenario()
  let projetoId = ''

  test.beforeAll(async () => {
    await cenario.criarUsuarios()
    const { data: cliente } = await cenario.db.from('clientes').select('id').eq('user_id', cenario.usuarios.cliente.id).single()
    const { data, error } = await cenario.db
      .from('projetos')
      .insert({
        nome: `Projeto Editor ${cenario.sufixo}`,
        cliente_id: cliente!.id,
        fotografo_id: cenario.usuarios.fotografo.id,
        status: 'em_diagramacao',
        laminas_inclusas: 10,
        preco_lamina_extra: 12,
        album_config: { formato: '30x30', orientacao: 'quadrado' },
      })
      .select('id')
      .single()
    if (error) throw error
    projetoId = data.id
  })

  test.afterAll(async () => {
    await cenario.limpar()
  })

  test('"Publicar versão" cria a versão que aparece na prova', async ({ page }) => {
    await page.goto(`/admin/projetos/${projetoId}/editor`)
    await esperarEditor(page)

    await enviarFotos(page, [
      { nome: 'proj-1.jpg', jpeg: await gerarJpeg(page, 3600, 2400, '#b33', 'P1') },
      { nome: 'proj-2.jpg', jpeg: await gerarJpeg(page, 3600, 2400, '#33b', 'P2') },
    ])
    await page.getByRole('button', { name: /^proj-1\.jpg/ }).click()
    await page.getByRole('button', { name: /^proj-2\.jpg/ }).click()
    await page.getByRole('button', { name: 'Criar página' }).click()
    await esperarSalvo(page)

    const { data: album } = await cenario.db.from('album_layouts').select('documento').eq('projeto_id', projetoId).single()
    const nLaminas = (album!.documento as { laminas: unknown[] }).laminas.length

    await page.getByRole('button', { name: 'Publicar' }).click()
    const modal = page.getByRole('dialog', { name: 'Publicar e exportar' })
    await modal.getByRole('textbox').fill('Primeira versão pelo teste E2E.')
    await modal.getByRole('button', { name: 'Publicar versão' }).click()
    await expect(modal.getByText(`Versão 1 criada com ${nLaminas} lâmina(s)`)).toBeVisible({ timeout: 180_000 })

    // O banco tem a versão com as lâminas, e cada uma está no R2 (falso).
    const { data: versao } = await cenario.db.from('design_versions').select('id, numero, comentarios').eq('projeto_id', projetoId).single()
    expect(versao).toMatchObject({ numero: 1, comentarios: 'Primeira versão pelo teste E2E.' })
    const { data: laminas } = await cenario.db.from('versoes_laminas').select('storage_path, ordem').eq('versao_id', versao!.id).order('ordem')
    expect(laminas).toHaveLength(nLaminas)
    const noR2: string[] = await (await fetch(`${URL_R2_FALSO}/__objetos`)).json()
    for (const l of laminas!) expect(noR2.some((k) => k.endsWith(`/${l.storage_path}`))).toBe(true)

    await modal.getByRole('link', { name: 'Ver na prova' }).click()
    await page.waitForURL(new RegExp(`/admin/projetos/${projetoId}/prova`))
    // Galeria da versão: todas as lâminas, com a imagem que o editor gerou (lida do R2 falso).
    await expect(page.getByText(`${nLaminas} lâminas`)).toBeVisible()
    const comFotos = laminas!.length > 1 ? 'Abrir lâmina 2' : 'Abrir lâmina 1'
    const imagem = page.getByRole('button', { name: comFotos, exact: true }).locator('img').first()
    await expect(imagem).toBeVisible()
    await expect.poll(() => imagem.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0)
  })
})
