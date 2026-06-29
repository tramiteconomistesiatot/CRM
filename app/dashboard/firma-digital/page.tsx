export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { FirmaDigitalClient } from '@/components/features/firma-digital-client'
import { FilePen } from 'lucide-react'

export default async function FirmaDigitalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'supervisor'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const serviceClient = createServiceClient()

  // Fetch documents with joined client info
  const { data: documents } = await serviceClient
    .from('signing_documents')
    .select(`
      *,
      client:client_id (
        id,
        name,
        company,
        email,
        phone
      )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch all active clients for the selector
  const { data: clients } = await serviceClient
    .from('clients')
    .select('id, name, company, email, phone')
    .eq('active', true)
    .order('name', { ascending: true })

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shrink-0 shadow-md shadow-blue-200">
          <FilePen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Firma Digital</h1>
          <p className="text-sm text-gray-500">
            Puja PDFs des d&apos;A3Asesor · assigna&apos;ls a clients · envia&apos;ls a firmar via <span className="font-medium text-blue-600">Yousign (AES)</span>
          </p>
        </div>
      </div>

      <FirmaDigitalClient
        initialDocuments={documents || []}
        initialClients={clients || []}
        userId={user.id}
      />
    </div>
  )
}
