export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NovaVacancesClient } from '@/components/features/nova-vacances-client'

export const metadata = { title: 'Nova sol·licitud — Tràmit Economistes' }

export default async function NovaVacancesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const currentYear = new Date().getFullYear()

  const { data: balance } = await supabase
    .from('vacation_balances')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', currentYear)
    .single()

  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .eq('year', currentYear)

  const { data: closures } = await supabase
    .from('company_closures')
    .select('date')

  const { data: existingRequests } = await supabase
    .from('absence_requests')
    .select('start_date, end_date, status')
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])

  return (
    <NovaVacancesClient
      balance={balance}
      holidays={holidays?.map(h => h.date) || []}
      closures={closures?.map(c => c.date) || []}
      existingRequests={existingRequests || []}
      userId={user.id}
    />
  )
}
