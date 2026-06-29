export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })

    const { data: profile } = await authClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'supervisor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accés denegat' }, { status: 403 })
    }

    const supabase = createServiceClient()

    // Fetch the document first to get storage_path
    const { data: doc, error: fetchError } = await supabase
      .from('signing_documents')
      .select('id, status, storage_path, signed_file_url, audit_pdf_url')
      .eq('id', params.id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document no trobat' }, { status: 404 })
    }

    // Block deletion of already-signed documents (legal record)
    if (doc.status === 'signed') {
      return NextResponse.json(
        { error: 'No es pot eliminar un document ja signat. Forma part del registre legal.' },
        { status: 400 }
      )
    }

    // Delete from Supabase Storage
    const pathsToDelete = [doc.storage_path].filter(Boolean)
    if (pathsToDelete.length > 0) {
      await supabase.storage.from('signing-documents').remove(pathsToDelete)
    }

    // Delete DB record
    const { error: deleteError } = await supabase
      .from('signing_documents')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('[firma/delete] DB error:', deleteError)
      return NextResponse.json({ error: 'Error eliminant el registre' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[firma/delete] Unexpected error:', err)
    return NextResponse.json({ error: 'Error inesperat' }, { status: 500 })
  }
}
