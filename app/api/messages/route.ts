export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  const { data: received } = await supabase
    .from('internal_messages')
    .select('*, sender:profiles!internal_messages_sender_id_fkey(full_name, color, role)')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: sent } = await supabase
    .from('internal_messages')
    .select('*, recipient:profiles!internal_messages_recipient_id_fkey(full_name, color, role)')
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ received: received || [], sent: sent || [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  const { recipient_id, subject, body, parent_id } = await request.json()

  if (!recipient_id || !subject || !body) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('internal_messages')
    .insert({
      sender_id: user.id,
      recipient_id,
      subject,
      body,
      parent_id: parent_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notificació interna
  await supabase.from('notifications').insert({
    user_id: recipient_id,
    title: 'Nou missatge intern',
    body: `Has rebut un missatge de l\'equip: "${subject}"`,
    type: 'message',
    read: false,
    link: '/worker/missatges',
  })

  return NextResponse.json({ success: true, data })
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  const { id } = await request.json()

  await supabase
    .from('internal_messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', user.id)

  return NextResponse.json({ success: true })
}
