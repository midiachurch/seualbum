import { Badge, type BadgeProps } from '@/components/ui/badge'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types/database'

const VARIANT: Record<OrderStatus, NonNullable<BadgeProps['variant']>> = {
  pendente: 'muted',
  na_fila_design: 'default',
  em_producao: 'default',
  aguardando_aprovacao: 'warning',
  em_revisao: 'warning',
  finalizado: 'success',
  cancelado: 'outline',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>
}
