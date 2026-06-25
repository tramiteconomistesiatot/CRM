import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/calendar']

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  attendees?: { email: string; displayName?: string }[]
  location?: string
  conferenceData?: unknown
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !privateKey) {
    console.log('[google-calendar] Google credentials not configured in .env.local. Skipping Calendar sync.')
    return null
  }

  try {
    // Format the private key to handle line breaks correctly
    const formattedKey = privateKey.replace(/\\n/g, '\n')

    const auth = new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: SCOPES
    })

    return google.calendar({ version: 'v3', auth })
  } catch (err) {
    console.error('[google-calendar] Failed to initialize Google Auth:', err)
    return null
  }
}

export async function createCalendarEvent(event: CalendarEvent): Promise<string> {
  const calendar = getCalendarClient()
  if (!calendar) return ''

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
      },
    })
    return res.data.id || ''
  } catch (err) {
    console.error('[google-calendar] Error creating event:', err)
    return ''
  }
}

export async function updateCalendarEvent(eventId: string, event: CalendarEvent): Promise<void> {
  const calendar = getCalendarClient()
  if (!calendar) return

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

  try {
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
      },
    })
  } catch (err) {
    console.error('[google-calendar] Error updating event:', err)
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient()
  if (!calendar) return

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    })
  } catch (err) {
    console.error('[google-calendar] Error deleting event:', err)
  }
}

export async function listCalendarEvents(calendarId: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient()
  if (!calendar) return []

  try {
    const res = await calendar.events.list({
      calendarId: calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const items = res.data.items || []
    return items.map(item => ({
      id: item.id || undefined,
      summary: item.summary || '',
      description: item.description || undefined,
      start: {
        dateTime: item.start?.dateTime || undefined,
        date: item.start?.date || undefined,
        timeZone: item.start?.timeZone || undefined,
      },
      end: {
        dateTime: item.end?.dateTime || undefined,
        date: item.end?.date || undefined,
        timeZone: item.end?.timeZone || undefined,
      },
      location: item.location || undefined,
      status: item.status as 'confirmed' | 'tentative' | 'cancelled' | undefined
    }))
  } catch (err) {
    console.error('[google-calendar] Error listing events:', err)
    return []
  }
}
