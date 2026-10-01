import type { Metadata } from 'next'
import { ClientsTable } from '@/components/admin/clients-table'
import { getClients, getPhotographers, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Clientes' }

export default async function ClientesPage() {
  await requirePlatformAccess('clientes')
  const [clients, photographers] = await Promise.all([getClients(), getPhotographers()])
  return <ClientsTable initialClients={clients} photographers={photographers} />
}
