export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth-guard'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const { supabase, user } = auth

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unreadCount = notifications?.filter(n => !n.read).length || 0

  return NextResponse.json({ notifications: notifications || [], unreadCount })
}

export async function PATCH(request: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const { supabase, user } = auth
  const body = await request.json()
  const { ids, markAllRead } = body

  if (markAllRead) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  } else if (ids && Array.isArray(ids)) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
