export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { CalendariFiscalClient } from '@/components/features/calendari-fiscal-client'

export const metadata = { title: 'Calendari Fiscal — Tràmit Economistes' }

export default async function WorkerCalendariFiscalPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()

  const { data: deadlines } = await supabase
    .from('fiscal_deadlines')
    .select('*')
    .in('year', [currentYear, currentYear + 1])
    .order('date', { ascending: true })

  return <CalendariFiscalClient deadlines={deadlines || []} currentYear={currentYear} />
}
