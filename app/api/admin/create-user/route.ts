import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import { sendEmail, emailBenvinguda } from '@/lib/resend'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { email, password, full_name, phone, role, color } = await request.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Crear usuari a Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Inserir perfil a profiles (no update, insert)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name,
        role,
        phone: phone || null,
        color: color || '#2272A3',
        active: true,
      }, { onConflict: 'id' })

    if (profileError) {
      // Si falla el perfil, esborrar l'usuari d'Auth per no deixar-lo a mitges
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // 3. Enviar email de benvinguda
    await sendEmail(emailBenvinguda({
      workerEmail: email,
      workerName: full_name,
      password,
      appUrl: process.env.NEXTAUTH_URL || 'https://tramit-app.vercel.app',
    }))

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
