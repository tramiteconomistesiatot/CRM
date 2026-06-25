import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { clientId, email } = await request.json()

    if (!clientId || !email) {
      return NextResponse.json({ error: 'Falten camps' }, { status: 400 })
    }

    const supabase = createClient()

    // Invalidar tokens anteriors del client
    await supabase
      .from('client_portal_tokens')
      .delete()
      .eq('client_id', clientId)
      .gt('expires_at', new Date().toISOString())

    // Crear nou token
    const { data: tokenData, error } = await supabase
      .from('client_portal_tokens')
      .insert({
        client_id: clientId,
        email,
        created_by: auth.user.id,
      })
      .select('token, expires_at')
      .single()

    if (error) throw error

    const portalUrl = `${process.env.NEXTAUTH_URL}/portal/${tokenData.token}`

    return NextResponse.json({
      success: true,
      url: portalUrl,
      expires_at: tokenData.expires_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
