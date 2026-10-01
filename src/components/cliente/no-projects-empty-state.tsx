import { BookImage } from 'lucide-react'

export function NoProjectsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#DDDDDD] bg-white px-6 py-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F5F5F5]">
        <BookImage className="h-9 w-9 text-[#AAAAAA]" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-semibold text-[#171717]">Você ainda não tem projetos</p>
        <p className="mt-1 max-w-xs text-sm text-[#595959]">
          Fale com seu fotógrafo para criar o seu primeiro álbum na plataforma.
        </p>
      </div>
    </div>
  )
}
