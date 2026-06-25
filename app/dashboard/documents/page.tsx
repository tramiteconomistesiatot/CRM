export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { DocumentsClient } from '@/components/features/documents-client'

export const metadata = { title: 'Documents — Tràmit Economistes' }

export default async function DocumentsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

  const [
    { data: documents },
    { data: requests },
    { data: clients },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('documents')
      .select('*, clients(name), profiles!documents_uploaded_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('document_requests')
      .select('*, clients(name), profiles!document_requests_created_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('clients')
      .select('id, name').eq('status', 'active').order('name').limit(100),
    supabase.from('profiles')
      .select('id, full_name').eq('active', true).order('full_name'),
  ])

  return (
    <DocumentsClient
      documents={documents || []}
      requests={requests || []}
      clients={clients || []}
      profiles={profiles || []}
      isAdmin={isAdmin}
      currentUserId={user!.id}
    />
  )
}
