export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data: documents, error } = await supabase
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

    if (error) throw error
    return NextResponse.json({ documents: documents || [] })
  } catch (err) {
    console.error('[firma/documents] Error:', err)
    return NextResponse.json({ error: 'Error obtenint documents' }, { status: 500 })
  }
}
