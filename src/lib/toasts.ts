export type ToastTone = 'good' | 'warn' | 'bad'

export interface ToastItem {
  id: number
  text: string
  tone: ToastTone
  /** A smaller second line, e.g. whether it reached the server. */
  detail?: string
}

/** How long each kind stays on screen. A warning or an error stays longer: it has to be read. */
export const LIFETIME: Record<ToastTone, number> = { good: 3500, warn: 6500, bad: 8000 }

/** How many show at once. A new one pushes the oldest out, so a burst of saves cannot cover the screen. */
export const MAX_TOASTS = 3

export const addToast = (list: ToastItem[], item: ToastItem, max = MAX_TOASTS) => [...list, item].slice(-max)
export const removeToast = (list: ToastItem[], id: number) => list.filter((t) => t.id !== id)
