import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import {
  arrastar,
  centroDoQuadro,
  criarAlbumAvulso,
  documentoSalvo,
  enviarFotos,
  esperarSalvo,
  expect,
  gerarJpeg,
  sufixo,
  test,
} from './apoio'

/** Fotos grandes (boa resolução para 30×30) com cores diferentes. */
async function fotosBoas(page: Parameters<typeof gerarJpeg>[0], n: number) {
  const cores = ['#b33', '#3a3', '#33b', '#b83', '#839', '#388', '#777', '#a58']
  const fotos = []
  for (let i = 0; i < n; i++) fotos.push({ nome: `foto-${i + 1}.jpg`, jpeg: await gerarJpeg(page, 3600, 2400, cores[i % cores.length], `F${i + 1}`) })
  return fotos
}

const ferramenta = (page: Parameters<typeof gerarJpeg>[0], nome: string) =>
  page.getByRole('navigation', { name: 'Ferramentas' }).getByRole('button', { name: nome })

const lamininhas = (page: Parameters<typeof gerarJpeg>[0]) => page.getByRole('button', { name: /^Ir para / })

test.describe('editor de álbum avulso', () => {
  test('envia fotos e monta o álbum automaticamente (Auto Build)', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `Auto Build ${sufixo()}`, { paginas: 2 })
    const antes = await documentoSalvo(albumId)
    const fotos = await fotosBoas(page, 6)
    await enviarFotos(page, fotos)

    // As 6 fotos foram registradas no álbum (originais no R2 falso).
    await expect.poll(async () => (await documentoSalvo(albumId)).fotos.length).toBe(6)

    await ferramenta(page, 'Layouts').click()
    await page.getByRole('tab', { name: 'Montar álbum' }).click()
    await expect(page.getByRole('button', { name: 'Montar automaticamente' })).toBeVisible()
    // O modelo inicial tem quadros vazios: a opção "só completar" vem marcada. Aqui é o álbum inteiro.
    const soCompletar = page.getByRole('checkbox', { name: /Só completar os quadros vazios/ })
    if ((await soCompletar.count()) > 0) await soCompletar.uncheck()
    await page.getByRole('spinbutton', { name: 'Lâminas' }).fill('3')
    await page.getByRole('button', { name: 'Montar automaticamente' }).click()

    await expect(lamininhas(page)).toHaveCount(3)
    await esperarSalvo(page)
    const depois = await documentoSalvo(albumId)
    expect(depois.revisao).toBeGreaterThan(antes.revisao)
    expect(depois.documento.laminas).toHaveLength(3)
    const usadas = new Set(depois.documento.laminas.flatMap((l) => l.quadros.map((q) => q.fotoId)).filter(Boolean))
    expect(usadas.size).toBe(6)
  })

  test('troca duas fotos arrastando e desfaz/refaz', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `Troca ${sufixo()}`, { paginas: 2 })
    await enviarFotos(page, await fotosBoas(page, 2))
    await page.getByRole('button', { name: /^foto-1\.jpg/ }).click()
    await page.getByRole('button', { name: /^foto-2\.jpg/ }).click()
    await page.getByRole('button', { name: 'Criar página' }).click()
    await esperarSalvo(page)

    const doc = (await documentoSalvo(albumId)).documento
    const ativa = doc.laminas.findIndex((l) => l.quadros.filter((q) => q.fotoId).length === 2)
    expect(ativa).toBeGreaterThan(-1)
    const [a, b] = doc.laminas[ativa].quadros
    const original = { [a.id]: a.fotoId, [b.id]: b.fotoId }
    const fotoDe = async (quadroId: string) =>
      (await documentoSalvo(albumId)).documento.laminas[ativa].quadros.find((q) => q.id === quadroId)?.fotoId

    await arrastar(page, await centroDoQuadro(page, albumId, a), await centroDoQuadro(page, albumId, b))
    await expect.poll(() => fotoDe(a.id)).toBe(original[b.id])
    expect(await fotoDe(b.id)).toBe(original[a.id])

    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect.poll(() => fotoDe(a.id)).toBe(original[a.id])
    expect(await fotoDe(b.id)).toBe(original[b.id])

    await page.getByRole('button', { name: 'Refazer' }).click()
    await expect.poll(() => fotoDe(a.id)).toBe(original[b.id])
  })

  test('adiciona um texto e troca a fonte', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `Texto ${sufixo()}`, { paginas: 2 })
    await ferramenta(page, 'Textos').click()
    await page.getByRole('button', { name: /Subtítulo/ }).click()
    const conteudo = page.getByLabel('Conteúdo do texto')
    await expect(conteudo).toHaveValue('12 de outubro de 2026')
    await conteudo.fill('Casamento E2E')
    await page.getByLabel('Fonte').selectOption({ label: 'Great Vibes' })

    await expect
      .poll(async () => (await documentoSalvo(albumId)).documento.laminas.flatMap((l) => l.textos).find((t) => t.texto === 'Casamento E2E')?.fonte)
      .toBe('manuscrita')
  })

  test('a verificação de impressão acusa foto com DPI baixo', async ({ page }) => {
    await criarAlbumAvulso(page, `DPI ${sufixo()}`, { paginas: 2 })
    await enviarFotos(page, [{ nome: 'pequena.jpg', jpeg: await gerarJpeg(page, 400, 300, '#456', 'baixa') }])
    await page.getByRole('button', { name: /^pequena\.jpg/ }).click()
    await page.getByRole('button', { name: 'Criar página' }).click()

    await page.getByRole('button', { name: 'Verificar', exact: true }).click()
    await expect(page.getByText(/Foto com \d+ DPI \(mínimo 300\)/).first()).toBeVisible()
    await expect(page.getByLabel(/pontos de atenção/).first()).toBeVisible()
  })

  test('abre a visualização em livro', async ({ page }) => {
    await criarAlbumAvulso(page, `Livro ${sufixo()}`, { paginas: 4 })
    await enviarFotos(page, await fotosBoas(page, 2))
    await page.getByRole('button', { name: /^foto-1\.jpg/ }).click()
    await page.getByRole('button', { name: 'Criar página' }).click()

    await page.getByRole('button', { name: 'Visualizar' }).click()
    const livro = page.getByRole('dialog', { name: 'Visualizar álbum' })
    await expect(livro).toBeVisible()
    // As lâminas são renderizadas no navegador e viram imagens (blob:) no livro.
    await expect(livro.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 60_000 })
    await livro.getByRole('button', { name: 'Fechar visualização' }).click()
    await expect(livro).toBeHidden()
  })

  test('exporta o ZIP de produção com uma imagem por lâmina', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `ZIP ${sufixo()}`, { paginas: 4 })
    await enviarFotos(page, await fotosBoas(page, 2))
    await page.getByRole('button', { name: /^foto-1\.jpg/ }).click()
    await page.getByRole('button', { name: 'Criar página' }).click()
    await esperarSalvo(page)
    const nLaminas = (await documentoSalvo(albumId)).documento.laminas.length

    await page.getByRole('button', { name: 'Exportar' }).click()
    const modal = page.getByRole('dialog', { name: 'Exportar álbum' })
    const download = page.waitForEvent('download', { timeout: 120_000 })
    await modal.getByRole('button', { name: 'Gerar e baixar' }).click()
    const arquivo = await download
    expect(arquivo.suggestedFilename()).toMatch(/-producao\.zip$/)
    await expect(modal.getByText(/Arquivo .*\.zip baixado\./)).toBeVisible()

    const zip = unzipSync(new Uint8Array(readFileSync(await arquivo.path())))
    const nomes = Object.keys(zip)
    expect(nomes).toHaveLength(nLaminas)
    for (const n of nomes) expect([...zip[n].subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]) // JPEG
  })
})
