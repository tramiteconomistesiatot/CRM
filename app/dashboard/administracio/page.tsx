export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AdminClient } from '@/components/features/admin-client'

export const metadata = { title: 'Administració — Tràmit Economistes' }

export default async function AdministracioPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()

  const [
    { data: profiles },
    { data: settings },
    { data: holidays },
    { data: closures },
    { data: auditLogs },
    { data: accessLogs },
    { data: fiscalDeadlines },
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('settings').select('*').order('category'),
    supabase.from('holidays').select('*').order('date'),
    supabase.from('company_closures').select('*').order('date'),
    supabase.from('audit_logs')
      .select('*, profiles!audit_logs_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('access_logs')
      .select('*, profiles!access_logs_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('fiscal_deadlines')
      .select('*')
      .in('year', [currentYear, currentYear + 1])
      .order('date', { ascending: true }),
  ])

  return (
    <AdminClient
      profiles={profiles || []}
      settings={settings || []}
      holidays={holidays || []}
      closures={closures || []}
      auditLogs={auditLogs || []}
      accessLogs={accessLogs || []}
      currentYear={currentYear}
      fiscalDeadlines={fiscalDeadlines || []}
    />
  )
}
