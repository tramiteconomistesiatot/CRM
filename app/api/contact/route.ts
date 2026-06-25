import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { name, email, phone, subject, message } = await request.json()

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    // Validar email bàsic
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Email no vàlid' }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('contact_forms')
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        source: 'web',
        status: 'new',
      })

    if (error) throw error

    // Notificar a les admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        title: 'Nou formulari de contacte',
        body: `${name} (${email}) ha enviat una consulta: "${subject}"`,
        type: 'contact_form',
        read: false,
        link: '/dashboard/contactes',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
