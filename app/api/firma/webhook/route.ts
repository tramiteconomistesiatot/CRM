export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHmac } from 'crypto'

const YOUSIGN_API_URL = process.env.YOUSIGN_SANDBOX === 'true'
  ? 'https://api-sandbox.yousign.app/v3'
  : 'https://api.yousign.app/v3'

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-yousign-signature-256') || ''

    // Verify Yousign webhook signature for security
    const webhookSecret = process.env.YOUSIGN_WEBHOOK_SECRET
    if (webhookSecret && signature) {
      const expectedSig = createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')
      const expected = `sha256=${expectedSig}`
      if (signature !== expected) {
        console.error('[firma/webhook] Invalid webhook signature')
        return NextResponse.json({ error: 'Signatura invàlida' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)
    const supabase = createServiceClient()

    console.log('[firma/webhook] Event received:', event.name, '| Request ID:', event.data?.signature_request?.id)

    const requestId = event.data?.signature_request?.id
    if (!requestId) {
      return NextResponse.json({ received: true })
    }

    // Find our document by Yousign request ID
    const { data: doc } = await supabase
      .from('signing_documents')
      .select('*')
      .eq('yousign_request_id', requestId)
      .single()

    if (!doc) {
      console.warn('[firma/webhook] Document not found for request ID:', requestId)
      return NextResponse.json({ received: true })
    }

    // Handle different Yousign events
    switch (event.name) {
      case 'signature_request.done': {
        // All signers have signed — download the signed PDF from Yousign
        const apiKey = process.env.YOUSIGN_API_KEY
        let signedFileUrl: string | null = null
        let auditPdfUrl: string | null = null

        if (apiKey) {
          // Get documents list for this request
          const docsRes = await fetch(
            `${YOUSIGN_API_URL}/signature_requests/${requestId}/documents`,
            { headers: { 'Authorization': `Bearer ${apiKey}` } }
          )

          if (docsRes.ok) {
            const docs = await docsRes.json()
            const signableDoc = Array.isArray(docs) ? docs[0] : docs?.data?.[0]

            if (signableDoc?.id) {
              // Download signed PDF
              const pdfRes = await fetch(
                `${YOUSIGN_API_URL}/documents/${signableDoc.id}/download?version=completed&archive=false`,
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
              )

              if (pdfRes.ok) {
                const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
                const signedPath = `signed/${doc.id}_signed.pdf`

                await supabase.storage
                  .from('signing-documents')
                  .upload(signedPath, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true,
                  })

                const { data: urlData } = supabase.storage
                  .from('signing-documents')
                  .getPublicUrl(signedPath)
                signedFileUrl = urlData.publicUrl
              }

              // Download audit trail PDF
              const auditRes = await fetch(
                `${YOUSIGN_API_URL}/signature_requests/${requestId}/audit_trails/download`,
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
              )

              if (auditRes.ok) {
                const auditBuffer = Buffer.from(await auditRes.arrayBuffer())
                const auditPath = `audit/${doc.id}_audit.pdf`

                await supabase.storage
                  .from('signing-documents')
                  .upload(auditPath, auditBuffer, {
                    contentType: 'application/pdf',
                    upsert: true,
                  })

                const { data: auditUrlData } = supabase.storage
                  .from('signing-documents')
                  .getPublicUrl(auditPath)
                auditPdfUrl = auditUrlData.publicUrl
              }
            }
          }
        }

        await supabase.from('signing_documents').update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_file_url: signedFileUrl,
          audit_pdf_url: auditPdfUrl,
        }).eq('id', doc.id)

        // Create in-app notification for all admins
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'supervisor'])
          .eq('active', true)

        if (admins) {
          await Promise.all(admins.map(admin =>
            supabase.from('notifications').insert({
              user_id: admin.id,
              title: '✅ Document signat!',
              body: `${doc.client_name} ha signat "${doc.file_name}". Ja pots descarregar-lo.`,
              type: 'system',
              link: '/dashboard/firma-digital',
            })
          ))
        }

        console.log('[firma/webhook] Document signed successfully:', doc.id)
        break
      }

      case 'signature_request.expired':
        await supabase.from('signing_documents')
          .update({ status: 'expired' })
          .eq('id', doc.id)
        console.log('[firma/webhook] Document expired:', doc.id)
        break

      case 'signer.declined':
        await supabase.from('signing_documents')
          .update({ status: 'rejected' })
          .eq('id', doc.id)
        console.log('[firma/webhook] Document rejected by signer:', doc.id)
        break

      default:
        console.log('[firma/webhook] Unhandled event:', event.name)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[firma/webhook] Unexpected error:', err)
    return NextResponse.json({ error: 'Error inesperat' }, { status: 500 })
  }
}
