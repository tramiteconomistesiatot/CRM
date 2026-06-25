export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AssessorClient } from '@/components/features/assessor-client'

export const metadata = { title: 'Assessor Tràmit — Tràmit Economistes' }

export default async function WorkerAssessorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user!.id)
    .single()

  return (
    <AssessorClient
      userName={profile?.full_name || 'Usuari'}
      isAdmin={false}
    />
  )
}
