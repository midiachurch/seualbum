/**
 * Ornamentos vetoriais (caixa 100 × 100). O mesmo `d` é desenhado pelo Konva
 * (`Path`) e pelo JPG final (`Path2D`), escalado para o tamanho do elemento.
 */
export const ORNAMENTOS: { id: string; nome: string; d: string; preenchido: boolean }[] = [
  { id: 'coracao', nome: 'Coração', preenchido: true, d: 'M50 88 C20 66 4 50 4 30 C4 14 16 4 30 4 C40 4 46 10 50 18 C54 10 60 4 70 4 C84 4 96 14 96 30 C96 50 80 66 50 88 Z' },
  { id: 'estrela', nome: 'Estrela', preenchido: true, d: 'M50 4 L61 37 L96 37 L68 58 L79 92 L50 71 L21 92 L32 58 L4 37 L39 37 Z' },
  { id: 'aliancas', nome: 'Alianças', preenchido: false, d: 'M38 50 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0 M62 50 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0' },
  { id: 'folha', nome: 'Folha', preenchido: true, d: 'M50 96 C50 70 50 50 50 30 M50 30 C20 30 8 56 50 96 C92 56 80 30 50 30 Z' },
  { id: 'flor', nome: 'Flor', preenchido: false, d: 'M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M50 40 C40 10 60 10 50 40 M60 50 C90 40 90 60 60 50 M50 60 C60 90 40 90 50 60 M40 50 C10 60 10 40 40 50' },
  { id: 'divisor', nome: 'Divisor', preenchido: false, d: 'M2 50 L40 50 M60 50 L98 50 M50 42 L58 50 L50 58 L42 50 Z' },
  { id: 'arabesco', nome: 'Arabesco', preenchido: false, d: 'M4 60 C20 20 40 20 50 50 C60 80 80 80 96 40 M50 50 C45 35 30 35 30 48 C30 58 42 60 46 52' },
  { id: 'cantoneira', nome: 'Cantoneira', preenchido: false, d: 'M4 96 L4 4 L96 4 M14 86 L14 14 L86 14 M4 4 L14 14' },
]

export function ornamentoPorId(id: string | null | undefined) {
  return ORNAMENTOS.find((o) => o.id === id) ?? ORNAMENTOS[0]
}
