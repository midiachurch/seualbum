import { notFound } from 'next/navigation'
import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import { VisaoEstudio } from '@/components/previa-local/visao-estudio'

export const metadata = { title: 'Visão geral do estúdio — novo design' }

export default function VisaoGeralPage() {
  if (!previaLocalAtiva()) notFound()
  return <VisaoEstudio />
}
