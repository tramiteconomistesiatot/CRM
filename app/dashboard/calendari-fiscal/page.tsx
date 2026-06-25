export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendariFiscalClient } from '@/components/features/calendari-fiscal-client'

export const metadata = { title: 'Calendari Fiscal — Tràmit Economistes' }

export default async function CalendariFiscalPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

  const [
    { data: deadlines },
    { data: holidays },
    { data: closures },
  ] = await Promise.all([
    supabase
      .from('fiscal_deadlines')
      .select('*')
      .in('year', [currentYear, currentYear + 1])
      .order('date', { ascending: true }),
    supabase
      .from('holidays')
      .select('*')
      .order('date'),
    supabase
      .from('company_closures')
      .select('*')
      .order('date'),
  ])

  return (
    <CalendariFiscalClient
      deadlines={deadlines || []}
      currentYear={currentYear}
      isAdmin={isAdmin}
      holidays={holidays || []}
      closures={closures || []}
    />
  )
}
