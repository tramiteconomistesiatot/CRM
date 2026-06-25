export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { EquipClient } from '@/components/features/equip-client'

export const metadata = { title: 'Equip — Tràmit Economistes' }

export default async function EquipPage() {
  const supabase = createClient()
  const now = new Date()
  const currentYear = now.getFullYear()
  const today = now.toISOString().split('T')[0]

  const [
    { data: requests },
    { data: balances },
    { data: profiles },
    { data: holidays },
    { data: closures },
  ] = await Promise.all([
    supabase.from('absence_requests')
      .select('*, profiles!absence_requests_user_id_fkey(full_name, color, email)')
      .order('created_at', { ascending: false }),
    supabase.from('vacation_balances')
      .select('*, profiles!vacation_balances_user_id_fkey(full_name, color)')
      .in('year', [currentYear - 1, currentYear, currentYear + 1]),
    supabase.from('profiles')
      .select('id, full_name, color, role, email, phone, active')
      .order('full_name'),
    supabase.from('holidays').select('date').eq('year', currentYear),
    supabase.from('company_closures').select('date'),
  ])

  return (
    <EquipClient
      requests={requests || []}
      balances={balances || []}
      profiles={profiles || []}
      holidays={holidays?.map(h => h.date) || []}
      closures={closures?.map(c => c.date) || []}
      currentYear={currentYear}
      today={today}
      isWorker={false}
    />
  )
}
