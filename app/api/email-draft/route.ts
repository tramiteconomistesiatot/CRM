import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  const { instruction, clientName, context, language } = await request.json()

  if (!instruction) {
    return NextResponse.json({ error: 'Cal proporcionar instruccions' }, { status: 400 })
  }

  const systemPrompt = `Ets un assistent professional de Tràmit Economistes, una gestoria especialitzada.
Redactes emails professionals, cordials i clars per enviar a clients.

Empresa: Tràmit Economistes
Especialitat: Fiscalitat, comptabilitat, laboral i autònoms

Instruccions:
- Redacta emails professionals però propers
- Usa el nom del client si se't proporciona
- Signatura final: "Tràmit Economistes\nTel: [Telèfon]\nwww.tramiteconomistes.com"
- ${language === 'es' ? 'Redacta en castellà' : 'Redacta en català'}
- Inclou assumpte al principi com "Assumpte: ..."
- Separa clarament assumpte i cos del missatge
- Sigues concís i professional`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Redacta un email professional.
${clientName ? `Client: ${clientName}` : ''}
${context ? `Context: ${context}` : ''}
Instrucció: ${instruction}`,
        }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    return NextResponse.json({ draft: text })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
