'use client'

/** Largura/altura em pixels de uma imagem local; `null` se o navegador não conseguir ler. */
export async function dimensoes(file: File): Promise<{ largura: number | null; altura: number | null }> {
  try {
    const bitmap = await createImageBitmap(file)
    const d = { largura: bitmap.width, altura: bitmap.height }
    bitmap.close()
    return d
  } catch {
    return { largura: null, altura: null }
  }
}
