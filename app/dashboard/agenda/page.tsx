export const dynamic = 'force-dynamic'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AgendaClient } from '@/components/features/agenda-client'
import { NovaCitaButton } from '@/components/features/nova-cita-button'

export const metadata = { title: 'Agenda — Tràmit Economistes' }

export default async function AgendaPage() {
  const supabase = createClient()
  const now = new Date()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const startRange = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
  const endRange = new Date(now.getFullYear(), now.getMonth() + 13, 0).toISOString()

  const [
    { data: absences },
    { data: profiles },
    { data: holidays },
    { data: closures },
    { data: fiscalDeadlines },
    { data: appointments },
  ] = await Promise.all([
    createServiceClient()
      .from('absence_requests')
      .select('*, profiles!absence_requests_user_id_fkey(full_name, color)')
      .eq('status', 'approved')
      .gte('end_date', startRange.split('T')[0])
      .lte('start_date', endRange.split('T')[0]),
    createServiceClient()
      .from('profiles')
      .select('id, full_name, color, role')
      .eq('active', true)
      .order('full_name'),
    supabase
      .from('holidays')
      .select('date, name')
      .eq('year', now.getFullYear()),
    supabase
      .from('company_closures')
      .select('date, name')
      .eq('year', now.getFullYear()),
    supabase
      .from('fiscal_deadlines')
      .select('*')
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0])
      .order('date', { ascending: true }),
    createServiceClient()
      .from('appointments')
      .select(`
        *,
        profiles!appointments_main_attendee_id_fkey(full_name, color),
        clients(name),
        appointment_attendees(user_id, is_main, status, profiles(full_name, color))
      `)
      .gte('start_time', startRange)
      .lte('start_time', endRange)
      .order('start_time', { ascending: true }),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground mt-1">Calendari de l&apos;equip</p>
        </div>
        <NovaCitaButton
          profiles={profiles || []}
          currentUserId={user!.id}
          currentUserRole={currentProfile?.role || 'admin'}
        />
      </div>
      <AgendaClient
        absences={absences || []}
        profiles={profiles || []}
        holidays={holidays || []}
        closures={closures || []}
        currentUserId={user!.id}
        currentUserRole={currentProfile?.role || 'admin'}
        fiscalDeadlines={fiscalDeadlines || []}
        appointments={appointments || []}
      />
    </div>
  )
}
