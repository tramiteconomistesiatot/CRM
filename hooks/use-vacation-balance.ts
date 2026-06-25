'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { VacationBalance } from '@/types'

export function useVacationBalance(userId?: string, year?: number) {
  const [balance, setBalance] = useState<VacationBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    const currentYear = year || new Date().getFullYear()

    async function loadBalance() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const targetUserId = userId || user?.id
        if (!targetUserId) return

        const { data, error: balanceError } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('year', currentYear)
          .single()

        if (balanceError && balanceError.code !== 'PGRST116') {
          setError(balanceError.message)
          return
        }

        setBalance(data as VacationBalance | null)
      } catch (err) {
        setError('Error carregant el saldo de vacances')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadBalance()
  }, [userId, year])

  return { balance, loading, error }
}
