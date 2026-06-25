export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AuditoriaClient } from '@/components/features/auditoria-client'

export const metadata = { title: 'Auditoria — Tràmit Economistes' }

export default async function AuditoriaPage() {
  const supabase = createClient()

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, profiles!audit_logs_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name')

  return <AuditoriaClient logs={logs || []} profiles={profiles || []} />
}
