import { chromium } from '@playwright/test'
import { ADMIN_E2E, URL_APP } from './ambiente'
import { servico } from './apoio'

/**
 * Cria (uma vez) o admin de teste no Supabase local e guarda a sessão dele em
 * `.auth/admin.json` — os testes começam já logados.
 */
export default async function globalSetup() {
  const { error } = await servico.auth.admin.createUser({
    email: ADMIN_E2E.email,
    password: ADMIN_E2E.senha,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { nome_completo: 'Admin E2E Editor' },
  })
  if (error && !/already|registered|exists/i.test(error.message)) throw error

  const navegador = await chromium.launch()
  const pagina = await navegador.newPage({ baseURL: URL_APP })
  // No `next dev` frio, a primeira compilação pode deixar o formulário sem
  // hidratar (o clique vira um submit nativo): espera a rede assentar e tenta de novo.
  for (let tentativa = 1; ; tentativa++) {
    await pagina.goto('/auth/login', { timeout: 120_000 })
    await pagina.waitForLoadState('networkidle', { timeout: 120_000 })
    // A tentativa anterior pode ter entrado depois do prazo: o login já redireciona.
    if (!new URL(pagina.url()).pathname.startsWith('/auth/login')) break
    await pagina.getByLabel('E-mail').fill(ADMIN_E2E.email)
    await pagina.getByLabel('Senha', { exact: true }).fill(ADMIN_E2E.senha)
    await pagina.getByRole('button', { name: 'Entrar', exact: true }).click()
    try {
      await pagina.waitForURL((u) => !u.pathname.startsWith('/auth/login'), { timeout: 60_000 })
      break
    } catch (e) {
      if (tentativa >= 3) throw e
    }
  }
  await pagina.context().storageState({ path: './e2e/editor/.auth/admin.json' })
  // Aquece as rotas do editor: a primeira compilação no `next dev` leva minutos numa máquina carregada.
  for (const rota of ['/admin/albuns', '/admin/albuns/00000000-0000-4000-8000-000000000000', '/admin/projetos/00000000-0000-4000-8000-000000000000/editor']) {
    await pagina.goto(rota, { timeout: 300_000 }).catch(() => undefined)
  }
  await navegador.close()
}
