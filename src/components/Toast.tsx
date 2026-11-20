import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addToast, LIFETIME, removeToast, type ToastItem, type ToastTone } from '../lib/toasts'

export interface ToastOptions {
  tone?: ToastTone
  detail?: string
}
type Show = (text: string, options?: ToastOptions) => void

const Ctx = createContext<Show>(() => {})

/** Show a short confirmation of something that was just done: `toast('Multa apagada')`. */
export const useToast = () => useContext(Ctx)

const MARK: Record<ToastTone, string> = { good: '✓', warn: '!', bad: '✕' }

/** Holds the toasts on screen: a small stack above the tab bar that clears itself, and a tap closes one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((list) => removeToast(list, id))
  }, [])

  const show = useCallback<Show>(
    (text, options = {}) => {
      const tone = options.tone ?? 'good'
      const id = next.current++
      setItems((list) => addToast(list, { id, text, tone, detail: options.detail }))
      timers.current.set(id, window.setTimeout(() => dismiss(id), LIFETIME[tone]))
    },
    [dismiss],
  )

  useEffect(() => {
    const all = timers.current
    return () => all.forEach((t) => window.clearTimeout(t))
  }, [])

  const value = useMemo(() => show, [show])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Avisos" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast t-${t.tone}`} role="status" onClick={() => dismiss(t.id)}>
            <span className="toast-mark" aria-hidden="true">{MARK[t.tone]}</span>
            <span className="toast-text">
              <b>{t.text}</b>
              {t.detail && <small>{t.detail}</small>}
            </span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
