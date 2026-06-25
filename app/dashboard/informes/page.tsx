export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { InformesNegociClient } from '@/components/features/informes-negoci-client'

export const metadata = { title: 'Informes — Tràmit Economistes' }

export default async function InformesPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()

  const [
    { data: balances },
    { data: requests },
    { data: profiles },
    { data: clients },
    { data: appointments },
    { data: tasks },
    { data: quotes },
    { data: timeEntries },
    { data: expedients },
  ] = await Promise.all([
    supabase.from('vacation_balances')
      .select('*, profiles!vacation_balances_user_id_fkey(full_name, email)')
      .eq('year', currentYear),
    supabase.from('absence_requests')
      .select('*, profiles!absence_requests_user_id_fkey(full_name, email)')
      .order('start_date', { ascending: false }),
    supabase.from('profiles')
      .select('id, full_name, email').eq('active', true).order('full_name'),
    supabase.from('clients')
      .select('id, name, status, client_type, created_at, estimated_value, last_contact_at'),
    supabase.from('appointments')
      .select('id, topic, status, start_time, main_attendee_id')
      .order('start_time', { ascending: false }),
    supabase.from('tasks')
      .select('id, status, priority, assigned_to, created_at, done_at, client_id'),
    supabase.from('quotes')
      .select('id, amount, tax_rate, status, created_at, client_id'),
    supabase.from('time_entries')
      .select('id, task_id, user_id, client_id, minutes, date')
      .gte('date', `${currentYear}-01-01`),
    supabase.from('expedients')
      .select('id, client_id, type, status, year, responsible_id')
      .eq('year', currentYear),
  ])

  return (
    <InformesNegociClient
      balances={balances || []}
      requests={requests || []}
      profiles={profiles || []}
      clients={clients || []}
      appointments={appointments || []}
      tasks={tasks || []}
      quotes={quotes || []}
      timeEntries={timeEntries || []}
      expedients={expedients || []}
      currentYear={currentYear}
    />
  )
}
