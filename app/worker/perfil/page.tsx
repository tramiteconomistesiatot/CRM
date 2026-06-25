export const dynamic = 'force-dynamic'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PerfilClient } from '@/components/features/perfil-client'

export const metadata = { title: 'El meu perfil — Tràmit Economistes' }

export default async function PerfilPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: otherProfiles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single(),
    createServiceClient()
      .from('profiles')
      .select('color')
      .eq('active', true)
      .neq('id', user!.id)
  ])

  const takenColors = otherProfiles?.map((p: any) => p.color).filter(Boolean) || []

  return <PerfilClient profile={profile} takenColors={takenColors} />
}
