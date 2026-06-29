export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ClientDetailClient } from '@/components/features/client-detail-client'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

  const serviceClient = createServiceClient()

  const [
    { data: client },
    { data: activity },
    { data: appointments },
    { data: tasks },
    { data: quotes },
    { data: consents },
    { data: profiles },
    { data: expedients },
    { data: signingDocs },
  ] = await Promise.all([
    supabase.from('clients')
      .select('*, profiles!clients_responsible_id_fkey(full_name, color)')
      .eq('id', params.id).single(),
    supabase.from('client_activity')
      .select('*, profiles!client_activity_user_id_fkey(full_name, color)')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('appointments')
      .select('*')
      .eq('client_id', params.id)
      .order('start_time', { ascending: false }).limit(10),
    supabase.from('tasks')
      .select('*, profiles!tasks_assigned_to_fkey(full_name, color)')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.from('quotes')
      .select('*')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.from('client_consents')
      .select('*')
      .eq('client_id', params.id),
    supabase.from('profiles')
      .select('id, full_name, color')
      .eq('active', true)
      .order('full_name'),
    supabase.from('expedients')
      .select('*, profiles!expedients_responsible_id_fkey(full_name, color)')
      .eq('client_id', params.id)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false }),
    // Signing documents for this client (using service client to bypass RLS)
    serviceClient.from('signing_documents')
      .select('id, file_name, status, created_at, sent_at, signed_at, signed_file_url, audit_pdf_url, client_email')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!client) notFound()

  return (
    <ClientDetailClient
      client={client}
      activity={activity || []}
      appointments={appointments || []}
      tasks={tasks || []}
      quotes={quotes || []}
      consents={consents || []}
      profiles={profiles || []}
      expedients={expedients || []}
      signingDocs={signingDocs || []}
      isAdmin={isAdmin}
    />
  )
}
