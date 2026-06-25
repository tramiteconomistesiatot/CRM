export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientId = formData.get('client_id') as string | null
    const documentType = formData.get('document_type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Cal adjuntar un fitxer' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'El fitxer és massa gran. Màxim 10MB.' }, { status: 400 })
    }

    // Convertir a base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'

    const systemPrompt = `Ets un expert en extracció de dades de documents fiscals i comptables espanyols.
Analitza el document i extreu TOTA la informació rellevant en format JSON estructurat.

Sempre retorna un JSON vàlid amb aquesta estructura exacta (omple els camps que trobis, deixa null els que no):
{
  "document_type": "nomina|factura|declaracio|rebut|contracte|extracte|other",
  "date": "YYYY-MM-DD o null",
  "amount": "número decimal o null",
  "tax_amount": "IVA o impostos en número decimal o null",
  "total_amount": "total amb impostos o null",
  "issuer_name": "nom del emissor o null",
  "issuer_nif": "NIF/CIF del emissor o null",
  "recipient_name": "nom del receptor o null",
  "recipient_nif": "NIF/CIF del receptor o null",
  "concept": "descripció del concepte o null",
  "invoice_number": "número de factura o null",
  "period": "període corresponent o null",
  "model": "model fiscal (303, 130, etc.) o null",
  "raw_text": "text complet extret del document",
  "key_data": ["llista", "de", "dades", "clau"],
  "anomalies": ["llista d'anomalies o inconsistències detectades"],
  "confidence": "high|medium|low"
}`

    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text' as const,
            text: `Analitza aquest document${documentType ? ` (tipus: ${documentType})` : ''} i extreu tota la informació en format JSON. Respon ÚNICAMENT amb el JSON, sense cap text addicional.`,
          },
        ],
      },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      throw new Error('Error de l\'API Claude')
    }

    const claudeData = await response.json()
    const rawText = claudeData.content?.[0]?.text || '{}'

    let ocrData: Record<string, unknown> = {}
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      ocrData = JSON.parse(cleaned)
    } catch {
      ocrData = { raw_text: rawText, confidence: 'low' }
    }

    // Generar resum llegible
    const summary = generateSummary(ocrData)

    // Desar document a la base de dades
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        client_id: clientId || null,
        uploaded_by: user.id,
        name: file.name,
        file_url: '',
        file_type: file.type,
        file_size: file.size,
        ocr_status: 'done',
        ocr_data: ocrData,
        ocr_summary: summary,
      })
      .select()
      .single()

    if (docError) throw docError

    // Registrar activitat al client si n'hi ha
    if (clientId) {
      await supabase.from('client_activity').insert({
        client_id: clientId,
        type: 'document',
        title: `Document analitzat: ${file.name}`,
        body: summary,
      })
    }

    return NextResponse.json({
      success: true,
      document_id: doc.id,
      ocr_data: ocrData,
      summary,
    })
  } catch (error) {
    console.error('OCR error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}

function generateSummary(data: Record<string, unknown>): string {
  const parts: string[] = []

  if (data.document_type) {
    const types: Record<string, string> = {
      nomina: 'Nòmina', factura: 'Factura', declaracio: 'Declaració fiscal',
      rebut: 'Rebut', contracte: 'Contracte', extracte: 'Extracte bancari', other: 'Document'
    }
    parts.push(types[data.document_type as string] || 'Document')
  }

  if (data.date) parts.push(`del ${data.date}`)
  if (data.issuer_name) parts.push(`de ${data.issuer_name}`)
  if (data.total_amount) parts.push(`per import ${data.total_amount}€`)
  if (data.concept) parts.push(`· ${data.concept}`)
  if (data.model) parts.push(`(Model ${data.model})`)

  if ((data.anomalies as string[] | undefined)?.length) {
    parts.push(`⚠️ Anomalies: ${(data.anomalies as string[]).join(', ')}`)
  }

  return parts.join(' ') || 'Document analitzat'
}
