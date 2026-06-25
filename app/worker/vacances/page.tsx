export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { VacancesWorkerClient } from '@/components/features/vacances-worker-client'

export const metadata = { title: 'Vacances i Absències — Tràmit Economistes' }

export default async function WorkerVacancesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: balance },
    { data: requests },
    { data: holidays },
    { data: closures },
  ] = await Promise.all([
    supabase.from('vacation_balances').select('*')
      .eq('user_id', user!.id).eq('year', new Date().getFullYear()).single(),
    supabase.from('absence_requests').select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase.from('holidays').select('date').eq('year', new Date().getFullYear()),
    supabase.from('company_closures').select('date'),
  ])

  return (
    <VacancesWorkerClient
      balance={balance}
      requests={requests || []}
      holidays={holidays?.map(h => h.date) || []}
      closures={closures?.map(c => c.date) || []}
      userId={user!.id}
    />
  )
}
