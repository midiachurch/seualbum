import { previaLocalAtiva, operacaoIndependenteDisponivel } from '@/lib/previa-local/ambiente'
import { notFound } from 'next/navigation'
import { CentralLocal } from '@/components/operacao-local/central-local'

export const metadata = {
  title: 'Operação local',
  robots: { index: false, follow: false },
}

export default function OperacaoLocalPage() {
  // A publicação independente só usa os arquivos e estados deste navegador.
  if (!operacaoIndependenteDisponivel()) {
    notFound()
  }
  return <CentralLocal previaDisponivel={previaLocalAtiva()} />
}
