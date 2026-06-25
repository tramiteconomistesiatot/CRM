export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AbsenciesAdminClient } from '@/components/features/absencies-admin-client'

export const metadata = { title: 'Absències — Tràmit Economistes' }

export default async function AbsenciesPage() {
  const supabase = createClient()

  const { data: requests } = await supabase
    .from('absence_requests')
    .select('*, profiles!absence_requests_user_id_fkey(full_name, email)')
    .neq('type', 'vacation')
    .order('created_at', { ascending: false })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'worker')
    .eq('active', true)
    .order('full_name')

  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .eq('year', new Date().getFullYear())

  const { data: closures } = await supabase
    .from('company_closures')
    .select('date')

  return (
    <AbsenciesAdminClient
      requests={requests || []}
      profiles={profiles || []}
      holidays={holidays?.map(h => h.date) || []}
      closures={closures?.map(c => c.date) || []}
    />
  )
}
