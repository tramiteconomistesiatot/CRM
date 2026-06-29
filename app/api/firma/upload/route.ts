export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// Secret shared with the upload agent (or manual admin uploads)
const UPLOAD_SECRET = process.env.AGENT_UPLOAD_SECRET || ''

export async function POST(request: Request) {
  try {
    // Allow both: agent secret header OR authenticated admin session
    const authHeader = request.headers.get('x-upload-secret')
    const isAgentUpload = UPLOAD_SECRET && authHeader === UPLOAD_SECRET

    if (!isAgentUpload) {
      // Check admin session
      const supabaseAuth = createServiceClient()
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
      }
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!profile || !['admin', 'supervisor'].includes(profile.role)) {
        return NextResponse.json({ error: 'Accés denegat' }, { status: 403 })
      }
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const uploadedBy = formData.get('uploaded_by') as string | null
    const clientId = formData.get('client_id') as string | null
    const clientName = formData.get('client_name') as string | null
    const clientEmail = formData.get('client_email') as string | null
    const clientPhone = formData.get('client_phone') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Cap fitxer rebut' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Només es permeten fitxers PDF' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Compute SHA-256 hash for integrity verification
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex')

    // Upload to private Supabase Storage bucket
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `pending/${timestamp}_${sanitizedName}`

    const { error: storageError } = await supabase.storage
      .from('signing-documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (storageError) {
      console.error('[firma/upload] Storage error:', storageError)
      return NextResponse.json({ error: 'Error guardant el fitxer' }, { status: 500 })
    }

    // Create signing_documents record
    const { data: doc, error: dbError } = await supabase
      .from('signing_documents')
      .insert({
        file_name: file.name,
        storage_path: storagePath,
        file_hash: fileHash,
        status: 'pending',
        uploaded_by: uploadedBy || null,
        client_id: clientId || null,
        client_name: clientName || null,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[firma/upload] DB error:', dbError)
      return NextResponse.json({ error: 'Error creant el registre' }, { status: 500 })
    }

    return NextResponse.json({ success: true, document: doc })
  } catch (err) {
    console.error('[firma/upload] Unexpected error:', err)
    return NextResponse.json({ error: 'Error inesperat' }, { status: 500 })
  }
}
