import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

interface AuthState {
  loading: boolean
  session: Session | null
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  // null while we are still asking the database whether this user is an admin
  const [admin, setAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    let cancelled = false
    setAdmin(null)
    if (!uid) return
    supabase.rpc('is_admin').then(async ({ data }) => {
      if (cancelled) return
      const isAdmin = data === true
      setAdmin(isAdmin)
      if (isAdmin) {
        // Late fees are normally added by a daily job; this covers the days it did not run.
        await supabase.rpc('apply_late_fees_admin')
        qc.invalidateQueries()
      }
    })
    return () => {
      cancelled = true
    }
  }, [uid, qc])

  const value = useMemo<AuthState>(
    () => ({
      loading: !sessionLoaded || (Boolean(uid) && admin === null),
      session,
      isAdmin: admin === true,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error('Email ou palavra-passe incorretos.')
      },
      signOut: async () => {
        await supabase.auth.signOut()
        qc.invalidateQueries()
      },
    }),
    [sessionLoaded, uid, admin, session, qc],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
