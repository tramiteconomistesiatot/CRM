export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal',
  labor: 'Laboral',
  accounting: 'Comptable',
  income_tax: 'Renda',
  freelance: 'Autònoms',
  companies: 'Societats',
  internal_meeting: 'Reunió interna',
  client_query: 'Consulta client',
  documentation: 'Documentació',
  other: 'Altre',
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const search = `%${q}%`

  const [clientsRes, appointmentsRes, tasksRes, messagesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, company, email, phone, nif_cif, status, client_type')
      .or(`name.ilike.${search},company.ilike.${search},email.ilike.${search},nif_cif.ilike.${search},phone.ilike.${search}`)
      .limit(5),
    supabase
      .from('appointments')
      .select('id, topic, start_time, status, clients(name)')
      .or(`topic.ilike.${search}`)
      .gte('start_time', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(3),
    supabase
      .from('tasks')
      .select('id, title, status, priority')
      .or(`title.ilike.${search},description.ilike.${search}`)
      .limit(3),
    supabase
      .from('internal_messages')
      .select('id, subject, body, created_at')
      .or(`subject.ilike.${search},body.ilike.${search}`)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .limit(3),
  ])

  const results = [
    ...(clientsRes.data || []).map(c => ({
      type: 'client' as const,
      id: c.id,
      title: c.name,
      subtitle: [c.company, c.email, c.nif_cif].filter(Boolean).join(' · '),
      url: `/dashboard/clients/${c.id}`,
      meta: c.status,
    })),
    ...(appointmentsRes.data || []).map(a => ({
      type: 'appointment' as const,
      id: a.id,
      title: TOPIC_LABELS[a.topic as string] ?? a.topic,
      subtitle: new Date(a.start_time).toLocaleDateString('ca-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      url: `/dashboard/agenda`,
      meta: a.status,
    })),
    ...(tasksRes.data || []).map(t => ({
      type: 'task' as const,
      id: t.id,
      title: t.title,
      subtitle: t.status === 'done' ? 'Completada' : t.status === 'in_progress' ? 'En curs' : 'Pendent',
      url: `/dashboard/tasques`,
      meta: t.priority,
    })),
    ...(messagesRes.data || []).map(m => ({
      type: 'message' as const,
      id: m.id,
      title: m.subject,
      subtitle: m.body.slice(0, 60) + (m.body.length > 60 ? '...' : ''),
      url: `/worker/missatges`,
      meta: new Date(m.created_at).toLocaleDateString('ca-ES'),
    })),
  ]

  return NextResponse.json({ results })
}
