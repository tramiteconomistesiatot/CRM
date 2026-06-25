/**
 * Utilitat per a enviar notificacions automàtiques a través de Telegram.
 */

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN no configurat. Missatge no enviat:', text.slice(0, 50) + '...')
    return false
  }

  if (!chatId) {
    console.log('[telegram] telegram_chat_id no definit per a l\'usuari. Saltant notificació.')
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[telegram] Error de la API de Telegram:', err)
      return false
    }

    return true
  } catch (err) {
    console.error('[telegram] Error de xarxa connectant a Telegram:', err)
    return false
  }
}
