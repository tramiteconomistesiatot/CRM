import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  const { clientId } = await request.json()
  if (!clientId) return NextResponse.json({ error: 'Falta clientId' }, { status: 400 })

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 })

  const { data: appointments } = await supabase
    .from('appointments')
    .select('topic, start_time, status')
    .eq('client_id', clientId)
    .order('start_time', { ascending: false })
    .limit(10)

  const { data: activity } = await supabase
    .from('client_activity')
    .select('type, title, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10)

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const systemPrompt = `Ets un consultor fiscal expert que analitza el perfil d'un client d'una gestoria.
Retorna ÚNICAMENT un JSON amb exactament aquesta estructura, sense cap text addicional:
{
  "opportunities": [
    {
      "title": "títol curt de l'oportunitat",
      "description": "descripció en 1-2 frases",
      "priority": "high|medium|low",
      "type": "fiscal|laboral|comptable|societats|other",
      "action": "acció recomanada concreta"
    }
  ],
  "alerts": [
    {
      "title": "títol de l'alerta",
      "description": "per què és urgent",
      "urgency": "urgent|soon|info"
    }
  ],
  "summary": "resum en 1 frase del perfil del client"
}`

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analitza aquest client i detecta oportunitats i alertes:

CLIENT:
- Nom: ${client.name}
- Tipus: ${client.client_type}
- Estat: ${client.status}
- NIF: ${client.nif_cif || 'no consta'}
- Empresa: ${client.company || 'no'}
- Notes: ${client.notes || 'cap'}
- Darrer contacte: ${client.last_contact_at ? `fa ${Math.floor((new Date().getTime() - new Date(client.last_contact_at).getTime()) / (1000 * 60 * 60 * 24))} dies` : 'mai'}

CITES RECENTS: ${appointments?.map(a => `${a.topic} (${a.start_time?.split('T')[0]})`).join(', ') || 'cap'}

DATA ACTUAL: ${today} (mes ${currentMonth} de ${currentYear})

Considera el calendari fiscal vigent (IVA trimestral, IRPF trimestral, Societats, Renda) i el perfil del client.`,
        }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'

    let result
    try {
      const cleaned = text.replace(/```json|```/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      result = { opportunities: [], alerts: [], summary: 'No s\'han pogut analitzar les oportunitats' }
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
