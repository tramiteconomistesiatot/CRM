import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Esborrar relacions (en ordre per evitar errors de foreign key)
    await supabase.from('appointment_attendees').delete().eq('user_id', userId)
    await supabase.from('appointments').delete().eq('main_attendee_id', userId)
    await supabase.from('appointments').delete().eq('created_by', userId)
    await supabase.from('absence_requests').delete().eq('user_id', userId)
    await supabase.from('vacation_balances').delete().eq('user_id', userId)
    await supabase.from('notifications').delete().eq('user_id', userId)
    await supabase.from('audit_logs').delete().eq('user_id', userId)

    // 2. Esborrar perfil
    await supabase.from('profiles').delete().eq('id', userId)

    // 3. Esborrar d'Auth
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
