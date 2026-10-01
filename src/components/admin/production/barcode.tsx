/**
 * Código de barras simulado via fonte (Libre Barcode 39, Google Fonts) — o
 * texto vira barras de verdade, sem precisar de nenhuma biblioteca de
 * geração de imagem. Convenção Code 39: o valor precisa vir cercado de `*`.
 */
export function Barcode({ value, className }: { value: string; className?: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fonte usada só nesta ficha de impressão, não faz sentido otimizar globalmente. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" />
      <p className="text-center text-5xl leading-none" style={{ fontFamily: "'Libre Barcode 39', cursive" }}>
        *{value}*
      </p>
      <p className="mt-1 text-center text-xs tracking-[0.3em] text-muted-foreground">{value}</p>
    </div>
  )
}
