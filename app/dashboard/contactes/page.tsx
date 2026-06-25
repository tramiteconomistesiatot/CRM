export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { ContactesClient } from '@/components/features/contactes-client'

export const metadata = { title: 'Contactes — Tràmit Economistes' }

export default async function ContactesPage() {
  const supabase = createClient()

  const { data: forms } = await supabase
    .from('contact_forms')
    .select('*, profiles!contact_forms_assigned_to_fkey(full_name)')
    .order('created_at', { ascending: false })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name')

  return <ContactesClient forms={forms || []} profiles={profiles || []} />
}
