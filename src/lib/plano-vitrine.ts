'use client'

/**
 * Plano escolhido na vitrine (/precos, cards de preço) que precisa chegar ao
 * passo 1 do wizard. O `?plano=<slug>` da URL cobre o cadastro com sessão
 * imediata; este `localStorage` cobre a confirmação de e-mail, cujo link volta
 * sem o parâmetro (e pode abrir horas depois).
 *
 * Guarda o slug, não o id: é o que a vitrine conhece, e o wizard resolve.
 */

const CHAVE = 'seualbum:plano-vitrine'

export function lembrarPlanoDaVitrine(slug: string | null) {
  if (!slug) return
  try {
    localStorage.setItem(CHAVE, slug)
  } catch {
    // navegação privada / storage bloqueado: fica só o ?plano= da URL
  }
}

/** Lê e apaga: o plano da vitrine vale para um pedido só. */
export function consumirPlanoDaVitrine(): string | null {
  try {
    const slug = localStorage.getItem(CHAVE)
    localStorage.removeItem(CHAVE)
    return slug
  } catch {
    return null
  }
}
