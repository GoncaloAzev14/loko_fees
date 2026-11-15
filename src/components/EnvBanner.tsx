import { envNotice } from '../lib/env'

const notice = envNotice({
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
})

/** A thin strip across the top of development and test builds. Absent from the published site. */
export default function EnvBanner() {
  if (!notice) return null
  return (
    <div className={`env-banner ${notice.tone}`} role="status">
      {notice.label}
    </div>
  )
}
