import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/previa/abrir/route'
import { DEMO_COOKIE, decodeDemoSession } from '@/lib/demo-mode'

vi.mock('server-only', () => ({}))
const abrir = (area = 'admin') => GET(new NextRequest(`http://127.0.0.1:3121/previa/abrir?area=${area}`))

describe('acesso direto restrito à prévia local', () => {
  beforeEach(() => {
    vi.stubEnv('SEUALBUM_NAVEGACAO_INDEPENDENTE', '')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SEUALBUM_PREVIA_LOCAL', '1')
    vi.stubEnv('SEUALBUM_OPERACAO_LOCAL', '1')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('abre o painel na mesma origem e cria somente uma sessão fictícia', () => {
    const response = abrir('fotografo')
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/dashboard')
    const cookie = response.cookies.get(DEMO_COOKIE)!
    expect(cookie.httpOnly).toBe(true)
    expect(decodeDemoSession(cookie.value)).toEqual({ email: 'previa@example.invalid', nome_estudio: 'Estúdio demonstração', role: 'fotografo' })
  })
  it('nega produção mesmo com as flags ligadas', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(abrir().status).toBe(404)
    expect(abrir().cookies.getAll()).toEqual([])
  })
  it('nega quando há projeto Supabase configurado', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid')
    expect(abrir().status).toBe(404)
  })
  it('nega servidor comum sem autorização explícita de prévia', () => {
    vi.stubEnv('SEUALBUM_PREVIA_LOCAL', '')
    expect(abrir().status).toBe(404)
  })
  it('permite publicação independente com cookie seguro e sem qualquer provedor', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SEUALBUM_NAVEGACAO_INDEPENDENTE', '1')
    const resposta = abrir('fotografo')
    expect(resposta.status).toBe(303)
    expect(resposta.cookies.get(DEMO_COOKIE)?.secure).toBe(true)
  })
  it.each(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'R2_ACCESS_KEY_ID', 'AWS_REKOGNITION_ACCESS_KEY_ID', 'WEBHOOK_SECRET', 'CRON_SECRET', 'SITES_HOST_ROUTING'])(
    'recusa a publicação independente se %s estiver conectado', chave => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SEUALBUM_NAVEGACAO_INDEPENDENTE', '1')
      vi.stubEnv(chave, 'synthetic-configured-provider')
      expect(abrir().status).toBe(404)
      expect(abrir().cookies.getAll()).toEqual([])
    },
  )
  it('não aceita destinos arbitrários ou papéis fora da lista', () => {
    for (const area of ['https://example.invalid', 'gestor', '__proto__', '']) {
      expect(abrir(encodeURIComponent(area)).status).toBe(404)
    }
  })
})
