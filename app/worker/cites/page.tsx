export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CitesWorkerClient } from '@/components/features/cites-worker-client'

export const metadata = { title: 'Les meves cites — Tràmit Economistes' }

export default async function CitesWorkerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      *,
      profiles!appointments_created_by_fkey(full_name, color),
      clients(name, company)
    `)
    .eq('main_attendee_id', user.id)
    .not('status', 'in', '("cancelled","completed")')
    .order('start_time', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles').select('id, full_name, role').eq('id', user.id).single()

  return (
    <CitesWorkerClient
      appointments={appointments || []}
      currentUserId={user.id}
      currentUserRole={profile?.role || 'worker'}
    />
  )
}
