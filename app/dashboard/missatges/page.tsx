export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { MissatgesClient } from '@/components/features/missatges-client'

export const metadata = { title: 'Missatges — Tràmit Economistes' }

export default async function AdminMissatgesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, color, role')
    .eq('active', true)
    .neq('id', user!.id)
    .order('full_name')

  return <MissatgesClient currentUserId={user!.id} profiles={profiles || []} />
}
