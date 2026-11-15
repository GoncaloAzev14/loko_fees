import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as api from './api'
import { useAuth } from './auth'
import { getSyncStatus, outbox, subscribeSyncStatus } from './sync'
import type { LedgerFilter } from './types'

export const useSummary = () => useQuery({ queryKey: ['summary'], queryFn: api.getSummary })
export const useBalances = () => useQuery({ queryKey: ['balances'], queryFn: api.getBalances })
export const useFineTypes = () => useQuery({ queryKey: ['fine-types'], queryFn: api.getFineTypes })
// Read on every page for the app name: do not retry or refetch on focus if it fails.
export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: api.getSettings, retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60_000 })
export const useLedger = (f: LedgerFilter = {}, enabled = true) =>
  useQuery({ queryKey: ['ledger', f], queryFn: () => api.getLedger(f), enabled })
export const usePayments = (playerId?: string) =>
  useQuery({ queryKey: ['payments', playerId ?? null], queryFn: () => api.getPayments(playerId) })
/** 'FC Lokomotiv 2026/27'; just 'FC Lokomotiv' until the season has loaded. */
export function useClubName() {
  const { data } = useSettings()
  return data?.season ? `FC Lokomotiv ${data.season}` : 'FC Lokomotiv'
}
export const useIncomes = () => useQuery({ queryKey: ['incomes'], queryFn: api.getIncomes })
export const useAdmins = () => useQuery({ queryKey: ['admins'], queryFn: api.listAdmins })
export const useArchivedSeasons = () => useQuery({ queryKey: ['archive'], queryFn: api.getArchivedSeasons })
export const useArchivedDetail = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['archive', id],
    enabled,
    queryFn: async () => ({ players: await api.getArchivedPlayers(id), types: await api.getArchivedFineTypes(id) }),
  })
export const useExpenses = () => useQuery({ queryKey: ['expenses'], queryFn: api.getExpenses })

/** id -> row lookups for joining names client-side. */
export function useLookups() {
  const balances = useBalances()
  const types = useFineTypes()
  return useMemo(
    () => ({
      players: new Map((balances.data ?? []).map((b) => [b.player_id, b])),
      types: new Map((types.data ?? []).map((t) => [t.id, t])),
      ready: balances.isSuccess && types.isSuccess,
    }),
    [balances.data, balances.isSuccess, types.data, types.isSuccess],
  )
}

/**
 * Wraps a write. Every view is derived from the same ledger, so on success
 * everything is refetched rather than patched.
 */
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  const qc = useQueryClient()
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const run = useCallback(
    async (...args: A) => {
      setState({ busy: true, error: null })
      try {
        const result = await fnRef.current(...args)
        // Saved on the phone to be sent later: nothing changed on the server, so there is nothing to read again.
        if (!(result as { queued?: boolean } | undefined)?.queued) await qc.invalidateQueries()
        setState({ busy: false, error: null })
        return true
      } catch (e) {
        setState({ busy: false, error: e instanceof Error ? e.message : 'Erro inesperado' })
        return false
      }
    },
    [qc],
  )
  return { run, ...state }
}

// --- offline: what is waiting to be sent, and whether the phone has a connection ---

/** The signed-in person's changes that are saved on the phone and not yet on the server (refused ones included). */
export function useQueuedEntries() {
  const { session } = useAuth()
  const uid = session?.user.id
  const all = useSyncExternalStore(outbox.subscribe, outbox.all)
  return useMemo(() => (uid ? all.filter((e) => e.uid === uid) : []), [all, uid])
}

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}
/** What the phone says about its connection. It can say yes while the server is out of reach: see useSyncStatus. */
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine)

/** Is a sync running, and did the last attempt fail to reach the server. */
export const useSyncStatus = () => useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
