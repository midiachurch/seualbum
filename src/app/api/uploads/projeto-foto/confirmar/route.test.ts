import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ existente: false, autorizado: true, insert: vi.fn(), head: vi.fn(), revalidate: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@/lib/rekognition/cliente', () => ({ rekognitionConfigurado: () => false }))
vi.mock('@/lib/rekognition/indexacao', () => ({ indexarFotoNova: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/r2/cliente', () => ({
  metadadosDoObjeto: mocks.head,
  removerObjetos: vi.fn(),
  urlDeLeitura: async () => 'https://storage.example.invalid/foto',
}))
vi.mock('@/lib/r2/sessao', () => ({
  lerJson: (request: Request) => request.json(),
  projetoParaUpload: async () => mocks.autorizado ? { ok: true, userId: '11111111-1111-4111-8111-111111111111', supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        gt: () => query,
        maybeSingle: async () => ({ data: table === 'fotos' ? (mocks.existente ? { id: 'foto-existente' } : null) : { r2_key: 'reservada' }, error: null }),
        insert: (value: unknown) => { mocks.insert(value); return query },
        single: async () => ({ data: { id: 'foto-nova' }, error: null }),
      }
      return query
    },
  } } : { ok: false, resposta: NextResponse.json({ erro: 'Sem acesso' }, { status: 403 }) },
}))
const { POST } = await import('./route')
const key = 'projetos/22222222-2222-4222-8222-222222222222/fotos/33333333-3333-4333-8333-333333333333-foto.jpg'
function req(nomeOriginal?: unknown) {
  return new NextRequest('http://localhost/api/uploads/projeto-foto/confirmar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, nomeOriginal }),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.existente = false
  mocks.autorizado = true
  mocks.head.mockResolvedValue({ contentType: 'image/jpeg', tamanho: 10 })
})
describe('nome original na confirmação autorizada', () => {
  it('persiste basename seguro somente no primeiro INSERT', async () => {
    expect((await POST(req('C:\\pasta\\original\u0000.jpg'))).status).toBe(200)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ nome_original: 'original.jpg', storage_path: key, tamanho_bytes: 10 }))
  })
  it('retry não altera metadados de foto já registrada', async () => {
    mocks.existente = true
    expect((await POST(req('outro-nome.jpg'))).status).toBe(200)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.head).not.toHaveBeenCalled()
  })
  it('consumidor legado sem nome original mantém desconhecido', async () => {
    expect((await POST(req())).status).toBe(200)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ nome_original: null }))
  })
  it('nega antes de olhar/gravar metadados quando projeto não é autorizado', async () => {
    mocks.autorizado = false
    expect((await POST(req('original.jpg'))).status).toBe(403)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.head).not.toHaveBeenCalled()
  })
})
