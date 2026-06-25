export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth-guard'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyUser, notifyAdmins } from '@/lib/utils/notify'
import { sendEmail, emailCitaAssignada } from '@/lib/resend'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const mainAttendeeId = body.mainAttendeeId || body.main_attendee_id
    const clientId = body.clientId !== undefined ? body.clientId : body.client_id
    const startTime = body.startTime || body.start_time
    const endTime = body.endTime || body.end_time
    const topic = body.topic
    const channel = body.channel
    const priority = body.priority
    const location = body.location
    const meetLink = body.meetLink || body.meet_link
    const internalNotes = body.internalNotes || body.internal_notes
    const additionalAttendeeIds = body.additionalAttendeeIds || body.additional_attendee_ids
    const externalAttendees = body.externalAttendees || body.external_attendees

    if (!mainAttendeeId || !startTime || !endTime || !topic || !channel) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    const { user, profile } = auth
    const supabase = createServiceClient()

    // Check if creator IS the main attendee and no other internal attendees are convocated
    const isCreatorMainAttendee = mainAttendeeId === user.id
    const otherAttendees = (additionalAttendeeIds || []).filter((id: string) => id !== user.id)
    const hasOtherAttendees = otherAttendees.length > 0
    const initialStatus = (isCreatorMainAttendee && !hasOtherAttendees) ? 'confirmed' : 'pending'

    // Create appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        created_by: user.id,
        client_id: clientId || null,
        main_attendee_id: mainAttendeeId,
        start_time: startTime,
        end_time: endTime,
        topic,
        channel,
        priority: priority || 'normal',
        status: initialStatus,
        location: location || null,
        meet_link: meetLink || null,
        internal_notes: internalNotes || null,
      })
      .select()
      .single()

    if (apptError || !appointment) throw apptError || new Error('Error creant la cita')

    // Sincronització amb Google Calendar
    let googleEventId = null
    try {
      const { createCalendarEvent } = await import('@/lib/google/calendar')
      
      const attendeeIds = [mainAttendeeId, ...(additionalAttendeeIds || [])]
      const { data: profilesList } = await supabase
        .from('profiles')
        .select('email, full_name')
        .in('id', attendeeIds)

      const googleAttendees = [
        ...(profilesList?.map(p => ({ email: p.email, displayName: p.full_name })) || []),
        ...(externalAttendees || []).map((ext: { name: string; email: string }) => ({
          email: ext.email,
          displayName: ext.name
        }))
      ]
      
      const topicLabels: Record<string, string> = {
        fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
        income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
        internal_meeting: 'Reunió interna', client_query: 'Consulta client',
        documentation: 'Documentació', other: 'Altre',
      }

      let clientName = ''
      if (clientId) {
        const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).single()
        clientName = client?.name ? ` - ${client.name}` : ''
      }

      googleEventId = await createCalendarEvent({
        summary: `${topicLabels[topic] || topic}${clientName}`,
        description: `Cita de Tràmit Economistes.\nCanal: ${channel}\nNotes internures: ${internalNotes || 'Cap'}`,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        location: location || channel,
        attendees: googleAttendees
      })

      if (googleEventId) {
        await supabase
          .from('appointments')
          .update({ google_event_id: googleEventId })
          .eq('id', appointment.id)
      }
    } catch (gErr) {
      console.error('[appointments/create] Error syncing to Google Calendar:', gErr)
    }

    // Create attendee records
    const attendees = [
      { appointment_id: appointment.id, user_id: mainAttendeeId, is_main: true, status: isCreatorMainAttendee ? 'accepted' : 'pending' },
      ...(additionalAttendeeIds || []).filter((id: string) => id !== mainAttendeeId).map((id: string) => ({
        appointment_id: appointment.id, user_id: id, is_main: false, status: 'pending'
      })),
      ...(externalAttendees || []).map((ext: { name: string; email: string }) => ({
        appointment_id: appointment.id,
        external_name: ext.name,
        external_email: ext.email,
        is_main: false,
        status: 'pending'
      }))
    ]

    await supabase.from('appointment_attendees').insert(attendees)

    // Notify all convocated attendees (excluding the creator)
    const topicLabels: Record<string, string> = {
      fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
      income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
      internal_meeting: 'Reunió interna', client_query: 'Consulta client',
      documentation: 'Documentació', other: 'Altre',
    }
    const startFormatted = new Date(startTime).toLocaleString('ca-ES', { dateStyle: 'full', timeStyle: 'short' })
    const notifyIds = Array.from(new Set([mainAttendeeId, ...(additionalAttendeeIds || [])])).filter(id => id !== user.id)

    if (notifyIds.length > 0) {
      const { data: profilesList } = await supabase
        .from('profiles')
        .select('id, full_name, email, email_notifications')
        .in('id', notifyIds)

      if (profilesList && profilesList.length > 0) {
        let clientName = null
        if (clientId) {
          const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).single()
          clientName = client?.name || null
        }

        await Promise.all(
          profilesList.map(async (attendeeProfile) => {
            // 1. In-app and Telegram notification
            await notifyUser(attendeeProfile.id, {
              title: 'Nova cita assignada 📅',
              body: `${profile.full_name} t'ha convocat a una cita de ${topicLabels[topic] || topic} el ${startFormatted}.`,
              type: 'appointment_assigned',
              link: '/worker/cites',
              metadata: { appointmentId: appointment.id, topic, startTime },
            })

            // 2. Email notification (non-blocking)
            if (attendeeProfile.email && (attendeeProfile as any).email_notifications !== false) {
              sendEmail(emailCitaAssignada({
                workerEmail: attendeeProfile.email,
                workerName: attendeeProfile.full_name,
                appointmentId: appointment.id,
                topic: topicLabels[topic] || topic,
                startTime: startFormatted,
                clientName,
                createdByName: profile.full_name,
              })).catch(err => console.error('[email cita]', err))
            }
          })
        )
      }
    }

    return NextResponse.json({ success: true, appointment })
  } catch (error) {
    console.error('[appointments/create]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
