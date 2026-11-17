import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ meta: vi.fn(), uuid: vi.fn() }))
vi.mock('@/lib/exif', () => ({ lerMetadadosFoto: mocks.meta }))
vi.mock('@/store/usePedidoWizardStore', () => ({ novoUuid: mocks.uuid }))

import { criarUploadProjetoFoto, uploadProjetoFoto, validarArquivoFotoProjeto } from './upload-projeto-foto'
import { enviarEConfirmarR2 } from './upload-r2'

const PROJETO = '11111111-1111-4111-8111-111111111111'
const ARQUIVO = '22222222-2222-4222-8222-222222222222'
const FOTO = '33333333-3333-4333-8333-333333333333'
const KEY = `projetos/${PROJETO}/fotos/${ARQUIVO}-foto.jpg`
const META = { capturadaEm: '2026-11-15T10:00:00', camera: 'Camera de teste' }
const RESULTADO = { id: FOTO, key: KEY, url: 'https://storage.example/preview' }
const fetchMock = vi.fn<typeof fetch>()
const assinatura = () => Response.json({ key: KEY, url: 'https://storage.example/put', headers: { 'Content-Type': 'image/jpeg' } })
const confirmado = () => Response.json(RESULTADO)
const arquivo = () => new File(['foto'], 'foto.jpg', { type: 'image/jpeg' })
const corpoDaChamada = (indice: number) => JSON.parse(fetchMock.mock.calls[indice][1]?.body as string)
const metodos = () => fetchMock.mock.calls.map(([, options]) => options?.method)

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  mocks.meta.mockReset().mockResolvedValue(META)
  mocks.uuid.mockReset().mockReturnValue(ARQUIVO)
})
afterEach(() => vi.unstubAllGlobals())

describe('upload de foto do projeto com retomada', () => {
  it('devolve identidade persistida e EXIF no contrato usado pela tela', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockResolvedValueOnce(confirmado())
    expect(await uploadProjetoFoto(PROJETO, arquivo(), 'Cerimônia')).toEqual({ id: FOTO, storagePath: KEY, url: RESULTADO.url, meta: META })
    expect(corpoDaChamada(0)).toMatchObject({ projetoId: PROJETO, idArquivo: ARQUIVO, tipo: 'image/jpeg', tamanho: 4 })
    expect(corpoDaChamada(2)).toEqual({ key: KEY, grupo: 'Cerimônia', nomeOriginal: 'foto.jpg', ...META })
    expect(metodos()).toEqual(['POST', 'PUT', 'POST'])
  })

  it('confirma a mesma chave quando a resposta da confirmação se perde, sem novo PUT', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockRejectedValueOnce(new Error('rede'))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow('Sem conexão')
    fetchMock.mockResolvedValueOnce(confirmado())
    expect((await envio.executar()).id).toBe(FOTO)
    expect(metodos()).toEqual(['POST', 'PUT', 'POST', 'POST'])
    expect(corpoDaChamada(3).key).toBe(KEY)
    expect(mocks.uuid).toHaveBeenCalledTimes(1)
    expect(mocks.meta).toHaveBeenCalledTimes(1)
  })

  it('consulta a confirmação antes de reenviar um PUT de resultado desconhecido', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockRejectedValueOnce(new Error('resposta do PUT perdida'))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow('recusou a conexão')
    fetchMock.mockResolvedValueOnce(confirmado())
    await envio.executar()
    expect(metodos()).toEqual(['POST', 'PUT', 'POST'])
  })

  it('só renova o PUT após 404 e preserva idArquivo ao reenviar', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response(null, { status: 403 }))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow('expirou')
    fetchMock.mockResolvedValueOnce(Response.json({ erro: 'não chegou' }, { status: 404 }))
      .mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockResolvedValueOnce(confirmado())
    await envio.executar()
    expect(metodos()).toEqual(['POST', 'PUT', 'POST', 'POST', 'PUT', 'POST'])
    expect(corpoDaChamada(3)).toEqual(corpoDaChamada(0))
    expect(mocks.uuid).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 409, 500])('não gera nova assinatura nem sobrescreve após confirmação HTTP %i', async (status) => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(Response.json({ erro: 'confirmação negada' }, { status }))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow('confirmação negada')
    fetchMock.mockResolvedValueOnce(Response.json({ erro: 'confirmação negada' }, { status }))
    await expect(envio.executar()).rejects.toThrow('confirmação negada')
    expect(metodos()).toEqual(['POST', 'PUT', 'POST', 'POST'])
  })

  it('nega novo envio se o 404 era do projeto e a assinatura também recusa o acesso', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockRejectedValueOnce(new Error('rede'))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow()
    fetchMock.mockResolvedValueOnce(Response.json({ erro: 'Projeto não encontrado.' }, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ erro: 'Projeto não encontrado.' }, { status: 404 }))
    await expect(envio.executar()).rejects.toThrow('Projeto não encontrado')
    expect(metodos()).toEqual(['POST', 'PUT', 'POST', 'POST'])
  })

  it('duas chamadas simultâneas compartilham a operação em andamento', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockResolvedValueOnce(confirmado())
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    const primeira = envio.executar()
    expect(envio.executar()).toBe(primeira)
    await primeira
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('não considera concluído um retorno sem ID válido e permite reconfirmar a mesma chave', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockResolvedValueOnce(Response.json({ ...RESULTADO, id: '' }))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow('não confirmou os dados')
    fetchMock.mockResolvedValueOnce(confirmado())
    expect((await envio.executar()).id).toBe(FOTO)
    expect(metodos()).toEqual(['POST', 'PUT', 'POST', 'POST'])
  })

  it('mantém identidade estável mesmo quando a assinatura inicial falha', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rede'))
    const envio = criarUploadProjetoFoto(PROJETO, arquivo())
    await expect(envio.executar()).rejects.toThrow('Sem conexão')
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockResolvedValueOnce(confirmado())
    await envio.executar()
    expect(corpoDaChamada(1)).toEqual(corpoDaChamada(0))
    expect(mocks.uuid).toHaveBeenCalledTimes(1)
  })

  it('preserva os três passos dos consumidores que não optaram pela retomada', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockResolvedValueOnce(Response.json({ ok: true }))
    expect(await enviarEConfirmarR2('/api/uploads/midia', { nome: 'foto.jpg' }, arquivo())).toEqual({ ok: true, key: KEY })
    expect(metodos()).toEqual(['POST', 'PUT', 'POST'])
  })
})


describe('validação antecipada de arquivo', () => {
  it('aceita HEIC e HEIF com MIME vazio sem descartar silenciosamente', () => {
    for (const name of ['CAMERA.HEIC', 'foto.heif']) expect(validarArquivoFotoProjeto({ name, type: '', size: 10 })).toBeNull()
  })
  it.each([
    { name: 'arquivo.exe', type: '', size: 1 },
    { name: 'foto.jpg', type: 'text/html', size: 1 },
    { name: 'foto.jpg', type: 'image/jpeg', size: 0 },
    { name: 'foto.jpg', type: 'image/jpeg', size: 301 * 1024 * 1024 },
  ])('recusa formato/tamanho inválido antes de rede/EXIF %j', (file) => {
    expect(validarArquivoFotoProjeto(file)).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('mantém nome original seguro no registro e no retry da confirmação', async () => {
    fetchMock.mockResolvedValueOnce(assinatura()).mockResolvedValueOnce(new Response()).mockRejectedValueOnce(new Error('rede'))
    const envio = criarUploadProjetoFoto(PROJETO, new File(['foto'], 'C:\\pasta\\original.jpg', { type: 'image/jpeg' }))
    await expect(envio.executar()).rejects.toThrow()
    fetchMock.mockResolvedValueOnce(confirmado())
    await envio.executar()
    expect(corpoDaChamada(0).nome).toBe('original.jpg')
    expect(corpoDaChamada(2).nomeOriginal).toBe('original.jpg')
    expect(corpoDaChamada(3)).toEqual(corpoDaChamada(2))
  })
})
