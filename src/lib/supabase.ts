import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// Placeholders keep the module importable when unconfigured; main.tsx shows a setup
// message instead of rendering the app in that case.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing')
