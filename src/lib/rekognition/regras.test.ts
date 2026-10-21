import { describe, expect, it } from 'vitest'
import {
  classificarErroBusca,
  ehEventoAnalitico,
  ehHeic,
  extensaoIndexavel,
  fotosDosRostos,
  nomeDaColecao,
  prefixoColecoes,
  projetoDaColecao,
} from './regras'

const PROJETO = '11111111-1111-4111-8111-111111111111'

describe('coleções', () => {
  const prefixo = prefixoColecoes('https://ytqbyfmroyilinxdhopv.supabase.co')

  it('prefixo leva o ref do Supabase', () => {
    expect(prefixo).toBe('seualbum-ytqbyfmroyilinxdhopv-')
    expect(prefixoColecoes(undefined)).toBe('seualbum-local-')
    expect(prefixoColecoes('http://127.0.0.1:54321')).toBe('seualbum-127-')
  })

  it('ida e volta entre projeto e coleção', () => {
    const colecao = nomeDaColecao(prefixo, PROJETO)
    expect(colecao).toBe(`seualbum-ytqbyfmroyilinxdhopv-${PROJETO}`)
    expect(projetoDaColecao(prefixo, colecao)).toBe(PROJETO)
  })

  it('ignora coleção de outro ambiente ou fora do formato', () => {
    expect(projetoDaColecao(prefixo, `seualbum-outroref-${PROJETO}`)).toBeNull()
    expect(projetoDaColecao(prefixo, `${prefixo}nao-uuid`)).toBeNull()
    expect(projetoDaColecao(prefixo, PROJETO)).toBeNull()
  })
})

describe('extensaoIndexavel / ehHeic', () => {
  it('aceita JPG/PNG/WebP/HEIC e recusa o resto', () => {
    expect(extensaoIndexavel('projetos/x/fotos/a-Foto.JPG')).toBe(true)
    expect(extensaoIndexavel('a.webp')).toBe(true)
    expect(extensaoIndexavel('IMG_0001.HEIC')).toBe(true)
    expect(extensaoIndexavel('a.tiff')).toBe(false)
    expect(extensaoIndexavel('sem-extensao')).toBe(false)
  })
  it('HEIC/HEIF vão pelo decodificador próprio', () => {
    expect(ehHeic('IMG_0001.HEIC')).toBe(true)
    expect(ehHeic('a.heif')).toBe(true)
    expect(ehHeic('a.jpg')).toBe(false)
  })
})

describe('classificarErroBusca', () => {
  it('selfie sem rosto vira mensagem própria; coleção ausente não é erro', () => {
    expect(classificarErroBusca('InvalidParameterException')).toBe('sem_rosto')
    expect(classificarErroBusca('InvalidImageFormatException')).toBe('formato')
    expect(classificarErroBusca('ResourceNotFoundException')).toBe('sem_colecao')
    expect(classificarErroBusca('ThrottlingException')).toBe('indisponivel')
    expect(classificarErroBusca(undefined)).toBe('indisponivel')
  })
})

describe('fotosDosRostos', () => {
  const fotoDoRosto = new Map([
    ['r1', 'fotoA'],
    ['r2', 'fotoB'],
    ['r3', 'fotoA'],
  ])

  it('uma foto por vez, da maior similaridade para a menor, acima do limiar', () => {
    const r = fotosDosRostos(
      [
        { faceId: 'r1', similaridade: 88 },
        { faceId: 'r2', similaridade: 97 },
        { faceId: 'r3', similaridade: 99 },
        { faceId: 'r4', similaridade: 99 },
      ],
      fotoDoRosto,
    )
    expect(r).toEqual(['fotoA', 'fotoB'])
  })

  it('descarta abaixo do limiar e rosto sem foto (apagada)', () => {
    expect(fotosDosRostos([{ faceId: 'r1', similaridade: 70 }, { faceId: 'zz', similaridade: 99 }], fotoDoRosto)).toEqual([])
  })
})

describe('ehEventoAnalitico', () => {
  it('só os três eventos da feature', () => {
    expect(ehEventoAnalitico('facial_search_initiated')).toBe(true)
    expect(ehEventoAnalitico('checkout_from_ai_gallery')).toBe(true)
    expect(ehEventoAnalitico('page_view')).toBe(false)
    expect(ehEventoAnalitico(1)).toBe(false)
  })
})
