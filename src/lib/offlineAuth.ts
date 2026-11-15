import type { Session } from '@supabase/supabase-js'

/**
 * What the phone still knows about the signed-in person when it cannot reach the server.
 *
 * Supabase hands out no session while its access token has expired and cannot be refreshed, which is
 * exactly the situation offline after an hour. The sign-in itself is still stored on the phone, so
 * the app can carry on as that person and let Supabase refresh the token once there is a connection.
 */
export function storedSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && /^sb-.+-auth-token$/.test(key)) {
        const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (parsed?.user?.id) return parsed as Session
      }
    }
  } catch {
    /* storage blocked */
  }
  return null
}

const ADMIN_KEY = (uid: string) => `loko.admin.${uid}`

/** Remember whether the server last said this person is an admin, for when it cannot be asked. */
export function rememberAdmin(uid: string, isAdmin: boolean) {
  try {
    localStorage.setItem(ADMIN_KEY(uid), isAdmin ? '1' : '0')
  } catch {
    /* storage blocked */
  }
}

/** The last answer the server gave, or null if it never has. Only ever used when offline: the server decides. */
export function rememberedAdmin(uid: string): boolean | null {
  try {
    const v = localStorage.getItem(ADMIN_KEY(uid))
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}
