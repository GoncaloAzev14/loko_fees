import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isNetworkFailure } from './errors'
import { rememberAdmin, rememberedAdmin, storedSession } from './offlineAuth'
import { supabase } from './supabase'

interface AuthState {
  loading: boolean
  session: Session | null
  isAdmin: boolean
  /** Signed in (for example through the invitation link) with an admin invitation not finished yet: no password chosen. */
  pendingInvite: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Call after the person has chosen a password: accepts a pending admin invitation and re-checks the rights. */
  completeFirstAccess: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  // null while we are still asking the database whether this user is an admin
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [pendingInvite, setPendingInvite] = useState(false)
  // An invited person only becomes an admin once they sign in with their password or choose one.
  // These two make the next rights check accept a pending invitation first.
  const acceptNext = useRef(false)
  const [recheck, setRecheck] = useState(0)

  useEffect(() => {
    // Offline, Supabase has no session once its access token has run out and cannot be refreshed.
    // The sign-in is still stored on the phone: carry on as that person until there is a connection.
    const orStored = (s: Session | null, offline: boolean) => s ?? (offline ? storedSession() : null)
    supabase.auth.getSession().then(({ data, error }) => {
      setSession(orStored(data.session, navigator.onLine === false || isNetworkFailure(error, error?.status)))
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(orStored(s, navigator.onLine === false)))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    let cancelled = false
    setAdmin(null)
    setPendingInvite(false)
    if (!uid) return
    supabase.rpc('is_admin').then(async ({ data, error, status }) => {
      // Cannot ask the server (offline): use its last answer for this person. This only shapes the
      // screens; the server still decides whether any change is allowed when it is sent.
      const unreachable = isNetworkFailure(error, status)
      let isAdmin = unreachable ? rememberedAdmin(uid) === true : data === true
      if (!unreachable && !isAdmin && acceptNext.current) {
        // errors are ignored on purpose: before the migration there is nothing to accept
        await supabase.rpc('accept_admin_invite')
        isAdmin = (await supabase.rpc('is_admin')).data === true
      }
      acceptNext.current = false
      if (cancelled) return
      if (!unreachable) rememberAdmin(uid, isAdmin)
      setAdmin(isAdmin)
      if (!isAdmin && !unreachable) {
        // Someone the invitation link signed in, who has not chosen a password yet, should be taken to do so.
        const pending = await supabase.rpc('my_invite_pending')
        if (!cancelled) setPendingInvite(pending.data === true)
      }
      if (isAdmin && !unreachable) {
        // Late fees are normally added by a daily job; this covers the days it did not run.
        await supabase.rpc('apply_late_fees_admin')
        qc.invalidateQueries()
      }
    })
    return () => {
      cancelled = true
    }
  }, [uid, recheck, qc])

  // Back online: ask again, quietly (no loading screen), in case rights changed while away.
  useEffect(() => {
    if (!uid) return
    const ask = () =>
      supabase.rpc('is_admin').then(({ data, error, status }) => {
        if (isNetworkFailure(error, status)) return
        rememberAdmin(uid, data === true)
        setAdmin(data === true)
      })
    window.addEventListener('online', ask)
    return () => window.removeEventListener('online', ask)
  }, [uid])

  const value = useMemo<AuthState>(
    () => ({
      loading: !sessionLoaded || (Boolean(uid) && admin === null),
      session,
      isAdmin: admin === true,
      pendingInvite,
      signIn: async (email, password) => {
        acceptNext.current = true
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          acceptNext.current = false
          if (isNetworkFailure(error, error.status)) throw new Error('Sem ligação. Para entrar é preciso internet.')
          throw new Error('Email ou palavra-passe incorretos.')
        }
      },
      completeFirstAccess: () => {
        acceptNext.current = true
        setRecheck((n) => n + 1)
      },
      signOut: async () => {
        await supabase.auth.signOut()
        qc.invalidateQueries()
      },
    }),
    [sessionLoaded, uid, admin, pendingInvite, session, qc],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
