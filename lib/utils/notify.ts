import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/utils/telegram'

type NotificationType =
  | 'vacation_request'
  | 'vacation_approved'
  | 'vacation_rejected'
  | 'appointment_assigned'
  | 'appointment_confirmed'
  | 'appointment_rejected'
  | 'task_assigned'
  | 'system'
  | 'other'

interface CreateNotificationParams {
  userId: string
  title: string
  body: string
  type: NotificationType
  link?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(params: CreateNotificationParams) {
  const supabase = createServiceClient()
  
  // 1. Inserir a la base de dades
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    body: params.body,
    type: params.type,
    link: params.link ?? null,
    metadata: params.metadata ?? {},
  })
  if (error) {
    console.error('[notify] Error creant notificació a BD:', error)
  }

  // 2. Enviar notificació per Telegram (si té configurat el chat id)
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', params.userId)
      .single()

    if (profile?.telegram_chat_id) {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const linkHtml = params.link
        ? `<a href="${appUrl}${params.link}">Veure detalls a l'App</a>`
        : `<a href="${appUrl}">Anar a l'App</a>`
      const msgText = `<b>${params.title}</b>\n\n${params.body}\n\n🔗 ${linkHtml}`
      await sendTelegramMessage(profile.telegram_chat_id, msgText)
    }
  } catch (err) {
    console.error('[notify] Error enviant Telegram:', err)
  }
}

export async function notifyAdmins(params: Omit<CreateNotificationParams, 'userId'>) {
  const supabase = createServiceClient()
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'supervisor'])
    .eq('active', true)
  if (!admins || admins.length === 0) return
  await Promise.all(admins.map(admin =>
    createNotification({ ...params, userId: admin.id })
  ))
}

export async function notifyUser(userId: string, params: Omit<CreateNotificationParams, 'userId'>) {
  return createNotification({ ...params, userId })
}
