import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import {
  abrirNoMenu,
  arrastar,
  centroDoQuadro,
  criarAlbumAvulso,
  documentoSalvo,
  enviarFotos,
  esperarSalvo,
  expect,
  gerarJpeg,
  porNaLamina,
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

/** Miniaturas da fita de lâminas (as vizinhas que espiam nas laterais são "Ir para a lâmina anterior/próxima lâmina"). */
const lamininhas = (page: Parameters<typeof gerarJpeg>[0]) => page.getByRole('button', { name: /^Ir para (Capa|Lâmina \d+)$/ })

/** Lâminas do documento salvo que têm alguma foto. */
const laminasComFoto = async (albumId: string) => (await documentoSalvo(albumId)).documento.laminas.filter((l) => l.quadros.some((q) => q.fotoId)).length

// O álbum nasce com UMA lâmina vazia (a "quantidade inicial de páginas" do hub não pré-cria mais lâminas).

test.describe('editor de álbum avulso', () => {
  test('envia fotos e monta o álbum automaticamente (Auto Build)', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `Auto Build ${sufixo()}`)
    const antes = await documentoSalvo(albumId)
    const fotos = await fotosBoas(page, 6)
    await enviarFotos(page, fotos)

    // As 6 fotos foram registradas no álbum (originais no R2 falso).
    await expect.poll(async () => (await documentoSalvo(albumId)).fotos.length).toBe(6)

    // "Montar automático" fica na bandeja e abre a confirmação (quantas lâminas, capa).
    await page.getByRole('button', { name: 'Montar álbum automaticamente' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Montar automático' })
    await dialogo.getByRole('spinbutton', { name: 'Lâminas' }).fill('3')
    // O modelo padrão começa com capa, que viria como uma lâmina vazia a mais: aqui são só as 3 do miolo.
    await dialogo.getByRole('checkbox', { name: 'Primeira lâmina é a capa' }).uncheck()
    await dialogo.getByRole('button', { name: 'Montar álbum' }).click()
    await expect(dialogo).toBeHidden()

    await expect(lamininhas(page)).toHaveCount(3)
    await esperarSalvo(page)
    await expect.poll(async () => (await documentoSalvo(albumId)).documento.laminas.length).toBe(3)
    const depois = await documentoSalvo(albumId)
    expect(depois.revisao).toBeGreaterThan(antes.revisao)
    expect(depois.documento.laminas).toHaveLength(3)
    const usadas = new Set(depois.documento.laminas.flatMap((l) => l.quadros.map((q) => q.fotoId)).filter(Boolean))
    expect(usadas.size).toBe(6)
  })

  test('troca duas fotos arrastando e desfaz/refaz', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `Troca ${sufixo()}`)
    await enviarFotos(page, await fotosBoas(page, 2))
    // As duas fotos soltas na lâmina vazia: ela ganha um layout de 2 quadros.
    await porNaLamina(page, ['foto-1.jpg', 'foto-2.jpg'])
    await expect(page.getByText(/^Layout .+ de \d+/)).toBeVisible()
    await esperarSalvo(page)
    await expect
      .poll(async () => (await documentoSalvo(albumId)).documento.laminas.some((l) => l.quadros.filter((q) => q.fotoId).length === 2))
      .toBe(true)
    // O painel direito só aparece com seleção e espremeria o palco no meio do arrasto: fixado, a geometria não muda.
    await page.getByRole('button', { name: 'Fixar o painel lateral' }).click()
    await expect(page.getByRole('button', { name: 'Soltar o painel lateral' })).toBeVisible()

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

    await page.getByRole('button', { name: /^Desfazer/ }).click()
    await expect.poll(() => fotoDe(a.id)).toBe(original[a.id])
    expect(await fotoDe(b.id)).toBe(original[b.id])

    await page.getByRole('button', { name: /^Refazer/ }).click()
    await expect.poll(() => fotoDe(a.id)).toBe(original[b.id])
  })

  test('adiciona um texto e troca a fonte', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `Texto ${sufixo()}`)
    await abrirNoMenu(page, 'Textos')
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
    await criarAlbumAvulso(page, `DPI ${sufixo()}`)
    await enviarFotos(page, [{ nome: 'pequena.jpg', jpeg: await gerarJpeg(page, 400, 300, '#456', 'baixa') }])
    await porNaLamina(page, ['pequena.jpg'])

    // A verificação abre no painel direito pelo menu "⋯"; a pílula de status também conta o alerta.
    await abrirNoMenu(page, 'Verificar o álbum')
    await expect(page.getByText(/Foto com \d+ DPI \(mínimo 300\)/).first()).toBeVisible()
    await expect(page.getByLabel(/pontos de atenção/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /alerta\(s\) na verificação/ })).toBeVisible()
  })

  test('abre a visualização em livro', async ({ page }) => {
    await criarAlbumAvulso(page, `Livro ${sufixo()}`)
    await enviarFotos(page, await fotosBoas(page, 2))
    await porNaLamina(page, ['foto-1.jpg'])

    await abrirNoMenu(page, 'Visualizar como livro')
    const livro = page.getByRole('dialog', { name: 'Visualizar álbum' })
    await expect(livro).toBeVisible()
    // As lâminas são renderizadas no navegador e viram imagens (blob:) no livro.
    await expect(livro.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 60_000 })
    await livro.getByRole('button', { name: 'Fechar visualização' }).click()
    await expect(livro).toBeHidden()
  })

  test('exporta o ZIP de produção com uma imagem por lâmina', async ({ page }) => {
    const albumId = await criarAlbumAvulso(page, `ZIP ${sufixo()}`)
    await enviarFotos(page, await fotosBoas(page, 2))
    await porNaLamina(page, ['foto-1.jpg'])
    // Uma segunda lâmina: "→" na última lâmina (com fotos) abre a próxima, vazia, e recebe a outra foto.
    await page.getByRole('button', { name: 'Nova lâmina vazia (→)' }).click()
    await expect(lamininhas(page)).toHaveCount(2)
    await porNaLamina(page, ['foto-2.jpg'])
    await esperarSalvo(page)
    await expect.poll(() => laminasComFoto(albumId)).toBe(2)
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
