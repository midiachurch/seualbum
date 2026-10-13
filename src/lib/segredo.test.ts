import { describe, expect, it } from 'vitest'
import { bearerConfere, segredoConfere } from './segredo'

describe('segredoConfere', () => {
  it('confere só o segredo exato', () => {
    expect(segredoConfere('s3gr3do-longo', 's3gr3do-longo')).toBe(true)
    expect(segredoConfere('s3gr3do-longO', 's3gr3do-longo')).toBe(false)
    // Tamanhos diferentes não lançam (timingSafeEqual exige o mesmo tamanho).
    expect(segredoConfere('s3gr3do', 's3gr3do-longo')).toBe(false)
    expect(segredoConfere('s3gr3do-longo-e-mais', 's3gr3do-longo')).toBe(false)
  })

  it('fail closed sem segredo configurado ou sem header', () => {
    expect(segredoConfere('', undefined)).toBe(false)
    expect(segredoConfere('', '')).toBe(false)
    expect(segredoConfere('qualquer', undefined)).toBe(false)
    expect(segredoConfere(null, 'x')).toBe(false)
  })
})

describe('bearerConfere', () => {
  it('exige o prefixo Bearer e o segredo exato', () => {
    expect(bearerConfere('Bearer abc123', 'abc123')).toBe(true)
    expect(bearerConfere('abc123', 'abc123')).toBe(false)
    expect(bearerConfere('Bearer abc12', 'abc123')).toBe(false)
    expect(bearerConfere(null, 'abc123')).toBe(false)
  })

  it('sem CRON_SECRET, nem "Bearer " nem "Bearer undefined" passam', () => {
    expect(bearerConfere('Bearer ', '')).toBe(false)
    expect(bearerConfere('Bearer undefined', undefined)).toBe(false)
  })
})
