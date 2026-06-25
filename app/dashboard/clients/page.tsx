export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { ClientsClient } from '@/components/features/clients-client'

export const metadata = { title: 'Clients — Tràmit Economistes' }

export default async function ClientsPage() {
  const supabase = createClient()

  const [{ data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('clients')
      .select('*, profiles!clients_responsible_id_fkey(full_name, color)')
      .order('name'),
    supabase.from('profiles')
      .select('id, full_name, color')
      .eq('active', true)
      .order('full_name'),
  ])

  return <ClientsClient clients={clients || []} profiles={profiles || []} />
}
