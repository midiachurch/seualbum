import { notFound } from 'next/navigation'
import { CentralLocal } from '@/components/operacao-local/central-local'

export const metadata = {
  title: 'Operação local',
  robots: { index: false, follow: false },
}

export default function OperacaoLocalPage() {
  // A bancada local nunca vira uma área pública ou um atalho de autorização.
  if (process.env.NODE_ENV !== 'development' || process.env.SEUALBUM_OPERACAO_LOCAL !== '1') {
    notFound()
  }
  return <CentralLocal />
}
