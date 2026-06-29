export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const YOUSIGN_API_URL = process.env.YOUSIGN_SANDBOX === 'true'
  ? 'https://api-sandbox.yousign.app/v3'
  : 'https://api.yousign.app/v3'

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient()

    // Auth check — only admins/supervisors
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'supervisor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accés denegat' }, { status: 403 })
    }

    const { documentId, clientName, clientEmail, clientPhone, message } = await request.json()

    if (!documentId || !clientName || !clientEmail) {
      return NextResponse.json({ error: 'Falten dades obligatòries (documentId, clientName, clientEmail)' }, { status: 400 })
    }

    // Fetch document record
    const { data: doc, error: docError } = await supabase
      .from('signing_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document no trobat' }, { status: 404 })
    }
    if (doc.status !== 'pending') {
      return NextResponse.json({ error: `El document ja té estat: ${doc.status}` }, { status: 400 })
    }

    const apiKey = process.env.YOUSIGN_API_KEY
    if (!apiKey) {
      // Graceful degradation: mark as sent but note no Yousign key
      console.warn('[firma/send] YOUSIGN_API_KEY no configurat. Simulant enviament.')
      await supabase.from('signing_documents').update({
        status: 'sent',
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone || null,
        sent_at: new Date().toISOString(),
        yousign_request_id: 'DEMO_NO_API_KEY',
      }).eq('id', documentId)

      return NextResponse.json({
        success: true,
        warning: 'YOUSIGN_API_KEY no configurat. Document marcat com enviat en mode demo.',
      })
    }

    // Download PDF from Supabase Storage to send to Yousign
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('signing-documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Error descarregant el PDF del storage' }, { status: 500 })
    }

    // Step 1: Upload document to Yousign
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    const uploadForm = new FormData()
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' })
    uploadForm.append('file', pdfBlob, doc.file_name)
    uploadForm.append('nature', 'signable_document')
    uploadForm.append('parse_anchors', 'false')

    const uploadRes = await fetch(`${YOUSIGN_API_URL}/documents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: uploadForm,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      console.error('[firma/send] Yousign document upload error:', err)
      return NextResponse.json({ error: `Error pujant a Yousign: ${err}` }, { status: 500 })
    }

    const yousignDoc = await uploadRes.json()

    // Step 2: Create signature request
    const signerPayload: Record<string, unknown> = {
      info: {
        first_name: clientName.split(' ')[0] || clientName,
        last_name: clientName.split(' ').slice(1).join(' ') || '.',
        email: clientEmail,
      },
      signature_level: 'electronic_signature',
      signature_authentication_mode: clientPhone ? 'otp_sms' : 'no_otp',
    }

    if (clientPhone) {
      (signerPayload.info as Record<string, string>).phone_number = clientPhone.startsWith('+') ? clientPhone : `+34${clientPhone.replace(/\s/g, '')}`
    }

    const signatureRequestPayload = {
      name: doc.file_name.replace('.pdf', ''),
      delivery_mode: 'email',
      documents: [{ document_id: yousignDoc.id, signature_fields: [] }],
      signers: [signerPayload],
      email_custom_note: message || `Hola ${clientName}, us enviem aquest document per a la seva firma digital. Gràcies per la seva confiança en Tràmit Economistes.`,
      activated_at: new Date().toISOString(),
      timezone: 'Europe/Madrid',
      expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      sender: {
        name: `${profile.full_name} — Tràmit Economistes`,
        email: 'firma@tramiteconomistes.com',
      },
    }

    const createRes = await fetch(`${YOUSIGN_API_URL}/signature_requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signatureRequestPayload),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      console.error('[firma/send] Yousign create request error:', err)
      return NextResponse.json({ error: `Error creant la petició a Yousign: ${err}` }, { status: 500 })
    }

    const signatureRequest = await createRes.json()

    // Activate the signature request so the signer gets the email
    const activateRes = await fetch(`${YOUSIGN_API_URL}/signature_requests/${signatureRequest.id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!activateRes.ok) {
      const err = await activateRes.text()
      console.error('[firma/send] Yousign activate error:', err)
      // Don't fail — request is created, just not activated
    }

    // Update DB record
    await supabase.from('signing_documents').update({
      status: 'sent',
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      yousign_request_id: signatureRequest.id,
      sent_at: new Date().toISOString(),
    }).eq('id', documentId)

    return NextResponse.json({
      success: true,
      yousign_request_id: signatureRequest.id,
    })

  } catch (err) {
    console.error('[firma/send] Unexpected error:', err)
    return NextResponse.json({ error: 'Error inesperat' }, { status: 500 })
  }
}
