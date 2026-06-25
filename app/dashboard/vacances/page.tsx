export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { VacancesAdminClient } from '@/components/features/vacances-admin-client'

export const metadata = { title: 'Vacances — Tràmit Economistes' }

export default async function VacancesAdminPage() {
  const supabase = createClient()

  const { data: requests } = await supabase
    .from('absence_requests')
    .select('*, profiles!absence_requests_user_id_fkey(full_name, email)')
    .eq('type', 'vacation')
    .order('created_at', { ascending: false })

  const { data: balances } = await supabase
    .from('vacation_balances')
    .select('*, profiles!vacation_balances_user_id_fkey(full_name)')
    .eq('year', new Date().getFullYear())
    .order('profiles(full_name)')

  return <VacancesAdminClient requests={requests || []} balances={balances || []} />
}
