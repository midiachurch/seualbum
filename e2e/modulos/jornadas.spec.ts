import { expect, test, type Browser } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { conteudoInicial } from '../../src/lib/sites/tipos'
import { URL_APP } from '../editor/ambiente'
import { entrar } from '../support/seed'
import { criarFotografo, db, galeriaComPortal, rpc, sufixo, type Fotografo } from './apoio'

const abrir = async (browser: Browser, quem?: Fotografo) => {
  const ctx = await browser.newContext({ baseURL: URL_APP, locale: 'pt-BR' })
  const page = await ctx.newPage()
  if (quem) await entrar(page, quem)
  return page
}
const entrarNoPortal = async (page: import('@playwright/test').Page, link: string, codigo: string, nome: string) => {
  await page.goto(`/portal/${link}`)
  await page.getByLabel('Código de acesso').fill(codigo)
  await page.getByRole('button', { name: 'Entrar na galeria' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

test('equipe: dono adiciona quem já tem conta, convida por link, e o editor passa a ver as galerias', async ({ browser }) => {
  const dono = await criarFotografo('dono'); const editor = await criarFotografo('editor'); const convidado = await criarFotografo('convidado')
  const page = await abrir(browser, dono)
  await page.goto('/dashboard/equipe')
  await page.getByLabel('E-mail de quem já tem conta').fill(editor.email)
  await page.getByLabel('Papel').selectOption('editor')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Pessoa adicionada' })).toBeVisible()

  await page.getByLabel('E-mail de quem já tem conta').fill(convidado.email)
  await page.getByRole('button', { name: /Gerar link de convite/ }).click()
  const link = await page.getByLabel('Link do convite').inputValue()
  expect(link).toMatch(/\/dashboard\/convite\/[a-f0-9]{64}$/)

  const pg2 = await abrir(browser, convidado)
  await pg2.goto(link)
  await pg2.getByRole('button', { name: 'Aceitar convite' }).click()
  await expect(pg2.getByText('Convite aceito')).toBeVisible()
  // Link de uso único: a segunda tentativa recebe a mensagem única de convite inválido.
  await pg2.goto(link)
  await pg2.getByRole('button', { name: 'Aceitar convite' }).click()
  await expect(pg2.getByRole('alert').filter({ hasText: 'Convite inválido' })).toBeVisible()

  const { data: membros } = await db.from('organizacao_membros').select('user_id,papel,status').eq('organizacao_id', dono.org)
  expect(membros).toEqual(expect.arrayContaining([
    expect.objectContaining({ user_id: editor.id, papel: 'editor', status: 'ativo' }),
    expect.objectContaining({ user_id: convidado.id, papel: 'editor', status: 'ativo' }),
  ]))

  // C03 no navegador: o editor da organização enxerga a galeria do dono pela RLS.
  const nome = `Galeria da equipe ${sufixo()}`
  await rpc(dono.sessao, 'criar_galeria_digital', { p_id: randomUUID(), p_nome: nome, p_cliente_nome: 'Cliente', p_cliente_email: `c-${sufixo()}@e2e.local` })
  const pgEditor = await abrir(browser, editor)
  await pgEditor.goto('/dashboard/galerias')
  await expect(pgEditor.getByText(nome)).toBeVisible()
})

test('loja: o estúdio cria o produto, oferece na galeria e o cliente compra e baixa (pagamento simulado)', async ({ browser }) => {
  const dono = await criarFotografo('loja')
  const nome = `Galeria Loja ${sufixo()}`
  const g = await galeriaComPortal(dono, nome, [{ nome: 'a.jpg', favorita: true }, { nome: 'b.jpg', favorita: true }, { nome: 'c.jpg' }])
  const page = await abrir(browser, dono)
  await page.goto('/dashboard/store')
  await page.getByLabel('Nome', { exact: true }).fill('Coleção Premium')
  await page.getByLabel('Preço (R$)').fill('99,90')
  await page.getByLabel('Comissão da plataforma (%)').fill('10')
  await page.getByRole('button', { name: 'Criar produto' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Produto salvo' })).toBeVisible()
  await page.getByLabel(`Coleção Premium em ${nome}`).click()
  await expect(page.getByLabel(`Coleção Premium em ${nome}`)).toBeChecked()
  await expect.poll(async () => (await db.from('store_projeto_produtos').select('projeto_id').eq('projeto_id', g.projeto)).data?.length).toBe(1)

  const cliente = await abrir(browser)
  await entrarNoPortal(cliente, g.link, g.codigo, nome)
  await cliente.goto(`/portal/${g.link}/loja`)
  await expect(cliente.getByRole('heading', { name: new RegExp(`Loja · ${nome}`) })).toBeVisible()
  await cliente.getByRole('checkbox', { name: 'Adicionar' }).check()
  await cliente.getByLabel('Seu nome').fill('Maria Compradora')
  await cliente.getByLabel('Seu e-mail').fill('maria@e2e.local')
  await cliente.getByRole('button', { name: 'Finalizar compra (simulada)' }).click()
  await cliente.waitForURL(/\/loja\/entrega\//)
  await expect(cliente.getByText('Pagamento confirmado')).toBeVisible()

  const { data: pedidos } = await db.from('store_pedidos').select('status,total_centavos,comissao_centavos,liquido_centavos').eq('projeto_id', g.projeto)
  expect(pedidos).toEqual([{ status: 'pago', total_centavos: 9990, comissao_centavos: 999, liquido_centavos: 8991 }])

  // Só as favoritas (2) foram vendidas; a foto não comprada nunca é entregue.
  const links = cliente.getByRole('link', { name: /Baixar/ })
  await expect(links).toHaveCount(2)
  const href = await links.first().getAttribute('href')
  const baixar = await cliente.request.get(href!, { maxRedirects: 0 })
  expect(baixar.status()).toBe(307)
  expect(baixar.headers().location).toContain('r2.cloudflarestorage.com')
  const naoComprada = g.fotos.find(f => f.nome_original === 'c.jpg')!
  const token = href!.split('/')[4]
  expect((await cliente.request.get(`/api/store/entrega/${token}/${naoComprada.id}`, { maxRedirects: 0 })).status()).toBe(404)

  await page.goto('/dashboard/store')
  await expect(page.getByText('Maria Compradora')).toBeVisible()
  // Estorno derruba a entrega na hora.
  const pedidoId = (await db.from('store_pedidos').select('id').eq('projeto_id', g.projeto).single()).data!.id
  await db.rpc('store_aplicar_evento', { p_provedor: 'simulado', p_evento_id: `e2e-${sufixo()}`, p_pedido: pedidoId, p_tipo: 'estornado', p_valor: 9990 })
  expect((await cliente.request.get(href!, { maxRedirects: 0 })).status()).toBe(404)
  await cliente.reload()
  await expect(cliente.getByText(/estornado/)).toBeVisible()
})

test('coleções e download: o cliente filtra por coleção e o download só funciona depois de liberado', async ({ browser }) => {
  const dono = await criarFotografo('colecoes')
  const nome = `Galeria Coleções ${sufixo()}`
  const g = await galeriaComPortal(dono, nome, [{ nome: 'um.jpg' }, { nome: 'dois.jpg' }, { nome: 'tres.jpg' }])
  const colecao = randomUUID()
  await rpc(dono.sessao, 'salvar_colecao', { p_id: colecao, p_projeto: g.projeto, p_nome: 'Cerimônia', p_ordem: 0 })
  await rpc(dono.sessao, 'definir_fotos_colecao', { p_colecao: colecao, p_foto_ids: [g.fotos[0].id] })

  const cliente = await abrir(browser)
  await entrarNoPortal(cliente, g.link, g.codigo, nome)
  await expect(cliente.getByRole('button', { name: /^Ampliar / })).toHaveCount(3)
  await expect(cliente.getByRole('link', { name: 'Baixar original' })).toHaveCount(0)
  expect((await cliente.request.get(`/portal/${g.link}/download/${g.fotos[0].id}`, { maxRedirects: 0 })).status()).toBe(403)

  await cliente.getByRole('link', { name: 'Cerimônia (1)' }).click()
  await expect(cliente).toHaveURL(/colecao=/)
  await expect(cliente.getByRole('button', { name: /^Ampliar / })).toHaveCount(1)

  await rpc(dono.sessao, 'definir_download_galeria', { p_projeto: g.projeto, p_liberado: true, p_expira_em: null, p_limite: 10 })
  await cliente.reload()
  await expect(cliente.getByRole('link', { name: /Baixar/ })).toHaveCount(1)
  const r = await cliente.request.get(`/portal/${g.link}/download/${g.fotos[0].id}`, { maxRedirects: 0 })
  expect(r.status()).toBe(307)
  expect(r.headers().location).toContain('r2.cloudflarestorage.com')
  const { data: baixadas } = await db.from('galeria_downloads').select('vezes').eq('projeto_id', g.projeto)
  expect(baixadas).toEqual([{ vezes: 1 }])
})

test('agenda: o visitante reserva um horário publicado e confirma, sem conta', async ({ browser }) => {
  const dono = await criarFotografo('agenda')
  const slug = `ag-${sufixo()}`
  const recurso = await rpc<string>(dono.sessao, 'agenda_salvar_recurso', {
    p_org: dono.org, p_id: null, p_nome: 'Ensaio de 1 hora', p_slug: slug, p_tipo: 'pessoa', p_descricao: null, p_fuso: 'America/Sao_Paulo',
    p_duracao_min: 60, p_buffer_min: 0, p_intervalo_min: 60, p_antecedencia_min_min: 0, p_antecedencia_max_dias: 30,
    p_cancelamento_antecedencia_h: 24, p_sinal_centavos: null, p_publicado: true,
  })
  await rpc(dono.sessao, 'agenda_definir_disponibilidade', { p_recurso: recurso, p_janelas: [0, 1, 2, 3, 4, 5, 6].map(dia => ({ dia, inicio: '09:00', fim: '18:00' })) })

  const visitante = await abrir(browser)
  await visitante.goto(`/agendar/${slug}`)
  await expect(visitante.getByRole('heading', { name: 'Ensaio de 1 hora' })).toBeVisible()
  await visitante.locator('section[aria-label] button[aria-pressed]').first().click()
  await visitante.getByLabel('Nome', { exact: true }).fill('Visitante E2E')
  await visitante.getByLabel('E-mail').fill(`visitante-${sufixo()}@e2e.local`)
  await visitante.getByRole('button', { name: 'Reservar este horário' }).click()
  await visitante.waitForURL(/\/reserva\//)
  await visitante.getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(visitante.getByText('Reserva confirmada')).toBeVisible()
  await expect.poll(async () => (await db.from('agenda_reservas').select('status').eq('recurso_id', recurso)).data?.map(r => r.status)).toEqual(['confirmada'])

  // O estúdio vê a reserva no painel.
  const page = await abrir(browser, dono)
  await page.goto('/dashboard/agenda')
  await page.getByRole('button', { name: 'Próximas' }).click()
  await expect(page.getByText('Visitante E2E')).toBeVisible()
})

test('sites: o estúdio publica e o público vê só a versão publicada; despublicar retira do ar', async ({ browser }) => {
  const dono = await criarFotografo('sites')
  const slug = `site-${sufixo()}`
  const nome = `Estúdio Luz ${sufixo()}`
  const site = await rpc<string>(dono.sessao, 'criar_site', { p_org: dono.org, p_nome: nome, p_slug: slug })
  const publico = await abrir(browser)
  // Rascunho nunca é público.
  expect((await publico.request.get(`/s/${slug}`)).status()).toBe(404)
  await rpc(dono.sessao, 'publicar_site', { p_site: site, p_chave: randomUUID(), p_nota: 'primeira versão' })
  await publico.goto(`/s/${slug}`)
  await expect(publico.getByRole('heading', { name: nome })).toBeVisible()

  // Edição do rascunho depois de publicar não vaza para o público.
  const conteudo = conteudoInicial(nome)
  conteudo.paginas[0].blocos[0] = { ...conteudo.paginas[0].blocos[0], dados: { titulo: 'RASCUNHO NOVO' } } as never
  const { data: s } = await db.from('sites').select('*').eq('id', site).single()
  await rpc(dono.sessao, 'salvar_site_rascunho', { p_site: site, p_conteudo: conteudo, p_rev: (s as Record<string, number>).rascunho_rev })
  await publico.reload()
  await expect(publico.getByRole('heading', { name: nome })).toBeVisible()
  await expect(publico.getByText('RASCUNHO NOVO')).toHaveCount(0)

  const page = await abrir(browser, dono)
  await page.goto('/dashboard/site')
  await expect(page.getByText(nome).first()).toBeVisible()

  await rpc(dono.sessao, 'despublicar_site', { p_site: site })
  expect((await publico.request.get(`/s/${slug}`)).status()).toBe(404)
})
