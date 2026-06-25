import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  const { messages, isAdmin } = await request.json()
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Missatges invàlids' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  // ── Carregar context real de Supabase i lleis d'Oriol ──
  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()
  const in30Days = new Date(); in30Days.setDate(in30Days.getDate() + 30)

  const [
    { data: pendingRequests },
    { data: upcomingDeadlines },
    { data: pendingTasks },
    { data: activeClients },
    { data: recentActivity },
    { data: balances },
    { data: profiles },
    { data: advisorRules },
  ] = await Promise.all([
    supabase.from('absence_requests')
      .select('id, type, start_date, end_date, profiles!absence_requests_user_id_fkey(full_name)')
      .eq('status', 'pending').limit(10),
    supabase.from('fiscal_deadlines')
      .select('name, date, model, description')
      .gte('date', today)
      .lte('date', in30Days.toISOString().split('T')[0])
      .order('date').limit(5),
    supabase.from('tasks')
      .select('id, title, status, priority, due_date, profiles!tasks_assigned_to_fkey(full_name), clients(name)')
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: false }).limit(10),
    supabase.from('clients')
      .select('id, name, status, last_contact_at')
      .eq('status', 'active').limit(20),
    supabase.from('absence_requests')
      .select('type, start_date, end_date, profiles!absence_requests_user_id_fkey(full_name)')
      .eq('status', 'approved')
      .gte('start_date', today)
      .lte('start_date', in30Days.toISOString().split('T')[0])
      .order('start_date').limit(5),
    isAdmin ? supabase.from('vacation_balances')
      .select('total_days, used_days, pending_days, profiles!vacation_balances_user_id_fkey(full_name)')
      .eq('year', currentYear) : { data: [] },
    supabase.from('profiles')
      .select('full_name, role').eq('active', true),
    supabase.from('settings')
      .select('key, value, description')
      .like('key', 'advisor_rule_%'),
  ])

  // Clients sense contacte >90 dies
  const staleClients = (activeClients || []).filter(c => {
    if (!c.last_contact_at) return true
    return Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000) > 90
  })

  // Format advisor rules
  const rulesContext = (advisorRules || []).length === 0
    ? '- Cap condició particular o llei addicional adjunta. Regeix-te per la normativa fiscal general.'
    : (advisorRules || []).map((r: any) => `=== FONT/LLEI: ${r.description} ===\n${r.value}`).join('\n\n')

  const contextData = `
=== CONTEXT ACTUAL DE TRÀMIT ECONOMISTES (${new Date().toLocaleDateString('ca-ES')}) ===

EQUIP (${(profiles || []).length} membres actius):
${(profiles || []).map((p: any) => `- ${p.full_name} (${p.role})`).join('\n')}

SOL·LICITUDS DE VACANCES/ABSÈNCIES PENDENTS D'APROVACIÓ (${(pendingRequests || []).length}):
${(pendingRequests || []).length === 0 ? '- Cap pendent' : (pendingRequests || []).map((r: any) => { const name = Array.isArray(r.profiles) ? r.profiles[0]?.full_name : r.profiles?.full_name; return `- ${name || '?'}: ${r.type} (${r.start_date} → ${r.end_date})`; }).join('\n')}

TERMINIS FISCALS PRÒXIMS (30 dies):
${(upcomingDeadlines || []).length === 0 ? '- Cap termini proper' : (upcomingDeadlines || []).map((d: { name: string; date: string; model?: string | null }) => `- ${d.date}: ${d.name}${d.model ? ` (Model ${d.model})` : ''}`).join('\n')}

TASQUES ACTIVES (${(pendingTasks || []).length}):
${(pendingTasks || []).slice(0, 8).map((t: any) => { const clientName = Array.isArray(t.clients) ? t.clients[0]?.name : t.clients?.name; const assignedName = Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name; return `- [${t.priority.toUpperCase()}] ${t.title}${clientName ? ` → Client: ${clientName}` : ''}${assignedName ? ` (Assignada a: ${assignedName})` : ''}${t.due_date ? ` | Data límit: ${t.due_date}` : ''}`; }).join('\n')}

ABSÈNCIES PRÒXIMES DE L'EQUIP:
${(recentActivity || []).length === 0 ? '- Cap absència propera' : (recentActivity || []).map((a: any) => { const name = Array.isArray(a.profiles) ? a.profiles[0]?.full_name : a.profiles?.full_name; return `- ${name || '?'}: ${a.type} (${a.start_date} → ${a.end_date})`; }).join('\n')}

CLIENTS SENSE CONTACTE >90 DIES (${staleClients.length}):
${staleClients.length === 0 ? '- Cap client sense contacte recent' : staleClients.slice(0, 5).map(c => `- ${c.name}`).join('\n')}

${isAdmin && (balances || []).length > 0 ? `SALDOS DE VACANCES ${currentYear}:
${(balances || []).map((b: any) => { const name = Array.isArray(b.profiles) ? b.profiles[0]?.full_name : b.profiles?.full_name; return `- ${name || '?'}: ${b.used_days}/${b.total_days} dies usats (${b.pending_days} pendents)`; }).join('\n')}` : ''}
`

  const systemPrompt = `Ets l'Oriol, l'assistent intel·ligent financer i de gestió interna de Tràmit Economistes, una gestoria professional a Catalunya.

LLEIS I FONTS D'INFORMACIÓ PARTICULARS PER LES QUALS T'HAS DE REGIR STRICTAMENT (aplica-les a les consultes sobre temes relacionats):
${rulesContext}

TENS ACCÉS AL CONTEXT REAL I ACTUALITZAT DE LA FIRMA (dades de Supabase):
${contextData}

Les teves capacitats:
1. GESTIÓ INTERNA: Respondre preguntes sobre l'equip, vacances, tasques, terminis, clients
2. ASSESSORIA FISCAL: Expert en normativa espanyola i catalana (IRPF, IVA, IS, autònoms, SS) i en els textos legals particulars que s'adjunten a dalt.
3. REDACCIÓ: Redactar emails professionals als clients en el to de la firma
4. ALERTES: Detectar situacions que requereixen atenció immediata

FONTS LEGALS que cites quan és rellevant:
- AEAT (aeat.es), Agència Tributària de Catalunya, BOE, DOGC, Seguretat Social i les lleis particulars adjuntes.

INSTRUCCIONS:
- Respon sempre en català, de forma clara i professional però propera.
- Ets l'Oriol. Si l'usuari et pregunta el teu nom o qui ets, digues clarament que ets l'Oriol, l'assessor financer de Tràmit Economistes.
- Si una de les lleis o fonts adjuntes a dalt aplica al tema de la pregunta, dona-li prioritat absoluta i explica la condició segons aquest text.
- Usa les dades del context per respondre preguntes sobre l'equip i clients.
- Per emails al client: usa el to professional de Tràmit Economistes, inclou salutació i comiat.
- Per càlculs fiscals: indica que són estimacions orientatives.
- Si no saps alguna cosa, indica-ho clarament.
- Estructura les respostes llargues amb llistes o seccions.
- Sigues concís però complet.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // updated to standard current Claude 3.5 Sonnet
        max_tokens: 2000,
        system: systemPrompt,
        messages: messages.slice(-10),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Claude API error:', err)
      return NextResponse.json({ error: 'Error de l\'API' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    return NextResponse.json({ response: text })
  } catch (error) {
    console.error('Assessor error:', error)
    return NextResponse.json({ error: 'Error intern' }, { status: 500 })
  }
}
