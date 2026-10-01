import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOrcamentoPublico } from '@/lib/supabase/queries'
import { formatBRL, formatDate } from '@/lib/utils'

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const { hash } = await params
  const orcamento = await getOrcamentoPublico(hash)
  if (!orcamento) return { title: 'Orçamento não encontrado' }
  return { title: `Orçamento para ${orcamento.clienteFinalNome} — ${orcamento.estudio}` }
}

/**
 * Tela pública de orçamento (seção "Upgrade B2B") — visual limpo e
 * minimalista de propósito, pronta pra ser aberta direto num link de
 * WhatsApp. Não usa o header/footer do site institucional: aqui quem
 * assina é o estúdio do fotógrafo, não a Seu Álbum.
 */
export default async function OrcamentoPublicoPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  const orcamento = await getOrcamentoPublico(hash)
  if (!orcamento) notFound()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          {orcamento.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo do estúdio do fotógrafo, URL pública dinâmica.
            <img src={orcamento.logoUrl} alt={orcamento.estudio} className="mb-4 h-16 w-auto object-contain" />
          ) : (
            <p className="mb-4 text-lg font-semibold tracking-tight text-[#171717]">{orcamento.estudio}</p>
          )}
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B6B6B]">Orçamento para</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171717]">{orcamento.clienteFinalNome}</h1>
          <p className="mt-1 text-xs text-[#AAAAAA]">{formatDate(orcamento.criadoEm)}</p>
        </div>

        <div className="mt-8 divide-y divide-[#EAEAEA] border-y border-[#EAEAEA]">
          {orcamento.itens.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-[#171717]">{item.descricao}</p>
                {item.quantidade > 1 ? <p className="text-xs text-[#6B6B6B]">{item.quantidade}×</p> : null}
              </div>
              <p className="font-medium text-[#171717]">{formatBRL(item.quantidade * item.valorUnitario)}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm font-medium text-[#595959]">Total</p>
          <p className="text-3xl font-bold tracking-tight text-[#171717]">{formatBRL(orcamento.valorTotal)}</p>
        </div>

        <p className="mt-8 text-center text-xs text-[#AAAAAA]">Proposta enviada por {orcamento.estudio}.</p>
      </div>
    </div>
  )
}
