/**
 * Álbum aberto em perspectiva (só CSS transforms) com as 5 primeiras fotos:
 * a página da esquerda sangrada com a primeira, a da direita em grade 2×2.
 * Páginas quadradas (o 30×30 dos álbuns de casamento), capa escura aparecendo
 * na borda, bloco de folhas na lateral e vinco sombreado na lombada — mostra
 * ao cliente, na hora, como as fotos em que ele aparece ficam impressas.
 */
export function PreviaAlbumAberto({ fotos }: { fotos: { id: string; url: string }[] }) {
  const [capa, ...resto] = fotos.slice(0, 5)
  if (!capa) return null
  const grade = resto.length > 0 ? resto : [capa]

  return (
    <div className="flex justify-center px-2 py-6 [perspective:1400px]" aria-hidden>
      <div className="relative w-full max-w-md [transform:rotateX(18deg)] [transform-style:preserve-3d]">
        {/* Sombra do álbum na mesa */}
        <div className="absolute -bottom-6 left-[4%] right-[4%] h-10 rounded-[50%] bg-black/30 blur-2xl" />

        {/* Capa (couro escuro) aparecendo atrás das folhas */}
        <div className="absolute -inset-[6px] rounded-[6px] bg-gradient-to-b from-[#2B2622] to-[#171412] shadow-2xl" />

        <div className="relative flex">
          {/* Página esquerda */}
          <div className="relative aspect-square w-1/2 origin-right [transform:rotateY(7deg)]">
            {/* Bloco de folhas na lateral */}
            <div className="absolute inset-y-[3px] -left-[4px] w-[4px] rounded-l-sm bg-[repeating-linear-gradient(to_right,#E9E4DC_0px,#E9E4DC_1px,#CFC8BD_1px,#CFC8BD_2px)]" />
            <div className="relative h-full overflow-hidden rounded-l-[3px] bg-[#FBF9F6]">
              {/* eslint-disable-next-line @next/next/no-img-element -- link assinado do R2 (1h), fora do next/image. */}
              <img src={capa.url} alt="" className="h-full w-full object-cover" />
              {/* Vinco: a folha mergulha na lombada */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/45 via-black/10 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            </div>
          </div>

          {/* Página direita */}
          <div className="relative aspect-square w-1/2 origin-left [transform:rotateY(-7deg)]">
            <div className="absolute inset-y-[3px] -right-[4px] w-[4px] rounded-r-sm bg-[repeating-linear-gradient(to_right,#CFC8BD_0px,#CFC8BD_1px,#E9E4DC_1px,#E9E4DC_2px)]" />
            <div className="relative h-full overflow-hidden rounded-r-[3px] bg-[#FBF9F6] p-[6%]">
              <div className={grade.length > 1 ? 'grid h-full grid-cols-2 grid-rows-2 gap-[5%]' : 'h-full'}>
                {grade.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element -- link assinado do R2 (1h), fora do next/image.
                  <img key={f.id} src={f.url} alt="" className="h-full w-full object-cover shadow-sm" />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />
            </div>
          </div>

          {/* Lombada: linha fina de luz no centro do vinco */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/50" />
        </div>
      </div>
    </div>
  )
}
