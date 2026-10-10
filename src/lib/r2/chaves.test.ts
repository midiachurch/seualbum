import { describe, expect, it } from 'vitest'
import {
  bucketDoArquivoAlbum,
  chaveDerivadoAlbum,
  chaveDoEnvioAlbum,
  chaveEhDerivadoDoAlbum,
  chaveEhDoLote,
  chaveEhFotoDoAlbum,
  chaveEhLaminaDaAprovacao,
  chaveEhLogoDoFotografo,
  chaveEhMidiaVitrine,
  chaveFotoAlbum,
  chaveFotoPedido,
  chaveFotoProjeto,
  chaveLamina,
  chaveLaminaAprovacao,
  chaveLogoFotografo,
  chaveMidiaVitrine,
  ehChaveAlbumR2,
  lerChaveFotoPedido,
  lerChaveFotoProjeto,
  lerExifConfirmacao,
  MIMES_LOGO,
  MIMES_MIDIA,
  nomeSeguro,
  TAMANHO_MAXIMO_LOGO_R2,
  TAMANHO_MAXIMO_MIDIA_R2,
  validarEnvioAlbum,
  validarEnvioFotoProjeto,
  validarEnvioLamina,
  validarEnvioPublico,
  validarPedidoDeEnvio,
} from './chaves'

const USER = '11111111-1111-4111-8111-111111111111'
const CHAVE = '22222222-2222-4222-8222-222222222222'
const ARQ = '33333333-3333-4333-8333-333333333333'

describe('nomeSeguro', () => {
  it('tira acentos e símbolos', () => {
    expect(nomeSeguro('Casamento João & Ana (1).JPG')).toBe('Casamento_Joao_Ana_1_.JPG')
  })
  it('nunca devolve vazio', () => {
    expect(nomeSeguro('')).toBe('foto')
  })
})

describe('chaveFotoPedido / lerChaveFotoPedido', () => {
  const key = chaveFotoPedido({ userId: USER, chave: CHAVE, idArquivo: ARQ, nome: 'Foto Ç.jpg' })

  it('monta a chave na pasta do rascunho', () => {
    expect(key).toBe(`pedidos/${USER}/${CHAVE}/${ARQ}-Foto_C.jpg`)
  })
  it('aceita a chave do próprio usuário', () => {
    expect(lerChaveFotoPedido(key, USER)).toEqual({ chave: CHAVE })
  })
  it('recusa chave de outro usuário', () => {
    expect(lerChaveFotoPedido(key, '99999999-9999-4999-8999-999999999999')).toBeNull()
  })
  it('recusa path traversal e formatos estranhos', () => {
    expect(lerChaveFotoPedido(`pedidos/${USER}/${CHAVE}/../x.jpg`, USER)).toBeNull()
    expect(lerChaveFotoPedido(`pedidos/${USER}/${CHAVE}/sub/${ARQ}-a.jpg`, USER)).toBeNull()
    expect(lerChaveFotoPedido(`outros/${USER}/${CHAVE}/${ARQ}-a.jpg`, USER)).toBeNull()
    expect(lerChaveFotoPedido(123, USER)).toBeNull()
  })
})

describe('validarPedidoDeEnvio', () => {
  const base = { chave: CHAVE, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 1000 }

  it('aceita uma foto válida', () => {
    expect(validarPedidoDeEnvio(base)).toEqual({ ok: true, dados: base })
  })
  it('recusa formato fora da lista', () => {
    expect(validarPedidoDeEnvio({ ...base, tipo: 'application/pdf' }).ok).toBe(false)
  })
  it('recusa acima de 50 MB', () => {
    expect(validarPedidoDeEnvio({ ...base, tamanho: 50 * 1024 * 1024 + 1 }).ok).toBe(false)
  })
  it('recusa chave de rascunho inválida e corpo vazio', () => {
    expect(validarPedidoDeEnvio({ ...base, chave: 'x' }).ok).toBe(false)
    expect(validarPedidoDeEnvio(null).ok).toBe(false)
  })
})

describe('lerExifConfirmacao', () => {
  it('aceita data no formato do EXIF e corta a câmera em 80', () => {
    expect(lerExifConfirmacao({ capturadaEm: '2026-05-01T18:30:00', camera: ` ${'x'.repeat(100)} ` })).toEqual({
      capturada_em: '2026-05-01T18:30:00',
      camera: 'x'.repeat(80),
    })
  })
  it('descarta formatos estranhos', () => {
    expect(lerExifConfirmacao({ capturadaEm: '01/05/2026', camera: '  ' })).toEqual({ capturada_em: null, camera: null })
    expect(lerExifConfirmacao(null)).toEqual({ capturada_em: null, camera: null })
  })
})

describe('lâminas no R2', () => {
  const key = chaveLamina({ projetoId: USER, lote: CHAVE, idArquivo: ARQ, nome: 'Lâmina 01.jpg' })

  it('monta a chave na pasta do lote e reconhece só ela', () => {
    expect(key).toBe(`projetos/${USER}/versoes/${CHAVE}/${ARQ}-Lamina_01.jpg`)
    expect(chaveEhDoLote(key, USER, CHAVE)).toBe(true)
    expect(chaveEhDoLote(key, USER, ARQ)).toBe(false)
    expect(chaveEhDoLote(`projetos/${USER}/versoes/${CHAVE}/../x.jpg`, USER, CHAVE)).toBe(false)
  })

  it('só aceita JPG de até 50 MB', () => {
    const base = { projetoId: USER, lote: CHAVE, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 10 }
    expect(validarEnvioLamina(base).ok).toBe(true)
    expect(validarEnvioLamina({ ...base, tipo: 'image/png' }).ok).toBe(false)
    expect(validarEnvioLamina({ ...base, tamanho: 51 * 1024 * 1024 }).ok).toBe(false)
  })
})

describe('fotos do projeto no R2', () => {
  const key = chaveFotoProjeto({ projetoId: USER, idArquivo: ARQ, nome: 'Cerimônia 1.HEIC' })

  it('monta a chave na pasta de fotos do projeto, ao lado das lâminas', () => {
    expect(key).toBe(`projetos/${USER}/fotos/${ARQ}-Cerimonia_1.HEIC`)
    expect(lerChaveFotoProjeto(key)).toEqual({ projetoId: USER })
  })
  it('recusa lâmina, path traversal e prefixo estranho', () => {
    expect(lerChaveFotoProjeto(`projetos/${USER}/versoes/${ARQ}-a.jpg`)).toBeNull()
    expect(lerChaveFotoProjeto(`projetos/${USER}/fotos/../${ARQ}-a.jpg`)).toBeNull()
    expect(lerChaveFotoProjeto(`pedidos/${USER}/fotos/${ARQ}-a.jpg`)).toBeNull()
    expect(lerChaveFotoProjeto(`projetos/nao-uuid/fotos/${ARQ}-a.jpg`)).toBeNull()
  })
  it('aceita até 300 MB, como o bucket antigo', () => {
    const base = { projetoId: USER, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 200 * 1024 * 1024 }
    expect(validarEnvioFotoProjeto(base).ok).toBe(true)
    expect(validarEnvioFotoProjeto({ ...base, tamanho: 301 * 1024 * 1024 }).ok).toBe(false)
    expect(validarEnvioFotoProjeto({ ...base, tipo: 'application/pdf' }).ok).toBe(false)
    expect(validarEnvioFotoProjeto({ ...base, projetoId: 'x' }).ok).toBe(false)
  })
})

describe('álbuns no R2', () => {
  const ALBUM = USER
  const APROV = CHAVE

  it('o prefixo albuns/ separa o R2 do bucket antigo', () => {
    expect(ehChaveAlbumR2(`albuns/${ALBUM}/${ARQ}-a.jpg`)).toBe(true)
    expect(ehChaveAlbumR2(`${ALBUM}/${ARQ}-a.jpg`)).toBe(false)
    expect(bucketDoArquivoAlbum(`albuns/${ALBUM}/${ARQ}-a.jpg`)).toBe('r2')
    expect(bucketDoArquivoAlbum(`${ALBUM}/derivados/${ARQ}-mini.jpg`)).toBe('albuns_fotos')
  })

  it('monta as três chaves e reconhece cada uma só na sua pasta', () => {
    const foto = chaveFotoAlbum({ albumId: ALBUM, idArquivo: ARQ, nome: 'Noivos.png' })
    const mini = chaveDerivadoAlbum({ albumId: ALBUM, fotoId: ARQ, variante: 'mini' })
    const lamina = chaveLaminaAprovacao({ albumId: ALBUM, aprovacaoId: APROV, ordem: 7 })
    expect(foto).toBe(`albuns/${ALBUM}/${ARQ}-Noivos.png`)
    expect(mini).toBe(`albuns/${ALBUM}/derivados/${ARQ}-mini.jpg`)
    expect(lamina).toBe(`albuns/${ALBUM}/aprovacoes/${APROV}/007.jpg`)

    expect(chaveEhFotoDoAlbum(foto, ALBUM)).toBe(true)
    expect(chaveEhFotoDoAlbum(mini, ALBUM)).toBe(false)
    expect(chaveEhFotoDoAlbum(foto, CHAVE)).toBe(false)
    expect(chaveEhDerivadoDoAlbum(mini, ALBUM)).toBe(true)
    expect(chaveEhDerivadoDoAlbum(foto, ALBUM)).toBe(false)
    expect(chaveEhLaminaDaAprovacao(lamina, ALBUM, APROV)).toBe(true)
    expect(chaveEhLaminaDaAprovacao(lamina, ALBUM, ARQ)).toBe(false)
    expect(chaveEhLaminaDaAprovacao(`albuns/${ALBUM}/aprovacoes/${APROV}/../x.jpg`, ALBUM, APROV)).toBe(false)
  })

  it('valida cada destino do envio e monta a chave dele', () => {
    const foto = validarEnvioAlbum({ albumId: ALBUM, destino: 'foto', idArquivo: ARQ, nome: 'a.webp', tipo: 'image/webp', tamanho: 10 })
    expect(foto.ok && chaveDoEnvioAlbum(foto.dados)).toBe(`albuns/${ALBUM}/${ARQ}-a.webp`)
    const deriv = validarEnvioAlbum({ albumId: ALBUM, destino: 'derivado', fotoId: ARQ, variante: 'preview', tipo: 'image/jpeg', tamanho: 10 })
    expect(deriv.ok && chaveDoEnvioAlbum(deriv.dados)).toBe(`albuns/${ALBUM}/derivados/${ARQ}-preview.jpg`)
    const lam = validarEnvioAlbum({ albumId: ALBUM, destino: 'aprovacao', aprovacaoId: APROV, ordem: 1, tipo: 'image/jpeg', tamanho: 10 })
    expect(lam.ok && chaveDoEnvioAlbum(lam.dados)).toBe(`albuns/${ALBUM}/aprovacoes/${APROV}/001.jpg`)
  })

  it('recusa destino, formato e tamanho fora da regra', () => {
    expect(validarEnvioAlbum({ albumId: ALBUM, destino: 'outro', tipo: 'image/jpeg', tamanho: 10 }).ok).toBe(false)
    expect(validarEnvioAlbum({ albumId: ALBUM, destino: 'foto', idArquivo: ARQ, nome: 'a.heic', tipo: 'image/heic', tamanho: 10 }).ok).toBe(false)
    expect(validarEnvioAlbum({ albumId: ALBUM, destino: 'derivado', fotoId: ARQ, variante: 'grande', tipo: 'image/jpeg', tamanho: 10 }).ok).toBe(false)
    expect(validarEnvioAlbum({ albumId: ALBUM, destino: 'derivado', fotoId: ARQ, variante: 'mini', tipo: 'image/jpeg', tamanho: 11 * 1024 * 1024 }).ok).toBe(false)
    expect(validarEnvioAlbum({ albumId: ALBUM, destino: 'aprovacao', aprovacaoId: APROV, ordem: 0, tipo: 'image/jpeg', tamanho: 10 }).ok).toBe(false)
    expect(validarEnvioAlbum({ albumId: 'x', destino: 'foto', idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 10 }).ok).toBe(false)
  })
})

describe('vitrine e logos (bucket público)', () => {
  it('chave da vitrine sem pasta de dono', () => {
    const key = chaveMidiaVitrine({ idArquivo: ARQ, nome: 'Banner Verão.webp' })
    expect(key).toBe(`vitrine/${ARQ}-Banner_Verao.webp`)
    expect(chaveEhMidiaVitrine(key)).toBe(true)
    expect(chaveEhMidiaVitrine(`logos/${USER}/${ARQ}-a.png`)).toBe(false)
  })

  it('logo só na pasta do próprio fotógrafo', () => {
    const key = chaveLogoFotografo({ fotografoId: USER, idArquivo: ARQ, nome: 'logo.png' })
    expect(key).toBe(`logos/${USER}/${ARQ}-logo.png`)
    expect(chaveEhLogoDoFotografo(key, USER)).toBe(true)
    expect(chaveEhLogoDoFotografo(key, CHAVE)).toBe(false)
  })

  it('valida formato e tamanho por regra', () => {
    const base = { idArquivo: ARQ, nome: 'a.png', tipo: 'image/png', tamanho: 4 * 1024 * 1024 }
    const logo = { mimes: MIMES_LOGO, tamanhoMaximo: TAMANHO_MAXIMO_LOGO_R2 }
    expect(validarEnvioPublico(base, logo).ok).toBe(true)
    expect(validarEnvioPublico({ ...base, tamanho: 6 * 1024 * 1024 }, logo)).toEqual({ ok: false, erro: 'Arquivo maior que 5 MB.' })
    expect(validarEnvioPublico({ ...base, tipo: 'image/svg+xml' }, logo).ok).toBe(false)
    expect(validarEnvioPublico({ ...base, tipo: 'image/gif' }, { mimes: MIMES_MIDIA, tamanhoMaximo: TAMANHO_MAXIMO_MIDIA_R2 }).ok).toBe(true)
  })
})
