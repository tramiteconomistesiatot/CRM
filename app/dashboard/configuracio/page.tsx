export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/features/settings-client'

export const metadata = { title: 'Configuració — Tràmit Economistes' }

export default async function ConfiguracioPage() {
  const supabase = createClient()

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .order('key')

  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .eq('year', 2026)
    .order('date')

  const { data: closures } = await supabase
    .from('company_closures')
    .select('*')
    .order('date')

  return (
    <SettingsClient
      settings={settings || []}
      holidays={holidays || []}
      closures={closures || []}
    />
  )
}
