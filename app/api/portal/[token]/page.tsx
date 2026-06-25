import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ClientPortalView } from '@/components/features/client-portal-view'

export const metadata = { title: 'Portal Client — Tràmit Economistes' }

export default async function PortalPage({ params }: { params: { token: string } }) {
  const supabase = createClient()

  // Verificar token
  const { data: tokenData } = await supabase
    .from('client_portal_tokens')
    .select('*, clients(*)')
    .eq('token', params.token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!tokenData) notFound()

  // Marcar com a usat
  await supabase
    .from('client_portal_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', params.token)

  const client = tokenData.clients as {
    id: string
    name: string
    company: string | null
    email: string | null
    phone: string | null
    nif_cif: string | null
  }

  // Cites del client (públiques, sense dades sensibles)
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, topic, channel, status, location')
    .eq('client_id', client.id)
    .gte('start_time', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })
    .limit(5)

  return (
    <ClientPortalView
      client={client}
      appointments={appointments || []}
      tokenEmail={tokenData.email}
    />
  )
}
