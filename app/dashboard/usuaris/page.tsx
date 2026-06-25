export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { UsuarisClient } from '@/components/features/usuaris-client'

export const metadata = { title: 'Usuaris — Tràmit Economistes' }

export default async function UsuarisPage() {
  const supabase = createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  return <UsuarisClient profiles={profiles || []} />
}
