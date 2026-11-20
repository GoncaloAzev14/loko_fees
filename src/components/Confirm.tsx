import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  /** Default "Confirmar". For a delete, say what it does: "Apagar". */
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' paints the button red and puts the focus on Cancel, so Enter cannot delete by accident. */
  tone?: 'normal' | 'danger'
}
type Ask = (options: ConfirmOptions) => Promise<boolean>

// Without a provider (a test, say) fall back to the browser's own question rather than doing nothing.
const Ctx = createContext<Ask>((o) => Promise.resolve(window.confirm([o.title, typeof o.message === 'string' ? o.message : ''].filter(Boolean).join('\n\n'))))

/** `const ask = useConfirm(); if (await ask({ title: 'Apagar?', tone: 'danger' })) ...` */
export const useConfirm = () => useContext(Ctx)

/**
 * A confirmation that belongs to the app instead of the browser: title, a sentence of explanation, and two
 * clearly labelled buttons. A plain overlay (not the <dialog> element) so it also works on older iPhones.
 * Escape or a tap outside means "no".
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const ok = useRef<HTMLButtonElement>(null)
  const before = useRef<HTMLElement | null>(null)
  const current = useRef(open)
  current.current = open

  const ask = useCallback<Ask>(
    (options) =>
      new Promise<boolean>((resolve) => {
        current.current?.resolve(false) // a newer question replaces an unanswered one
        before.current = document.activeElement as HTMLElement | null
        setOpen({ options, resolve })
      }),
    [],
  )

  const answer = useCallback((value: boolean) => {
    current.current?.resolve(value)
    setOpen(null)
    before.current?.focus?.() // back to the button that was pressed
  }, [])

  useEffect(() => {
    if (open) (open.options.tone === 'danger' ? cancel : ok).current?.focus()
  }, [open])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      answer(false)
    } else if (e.key === 'Tab') {
      // two buttons only: keep the focus inside the question
      e.preventDefault()
      ;(document.activeElement === cancel.current ? ok : cancel).current?.focus()
    }
  }

  const o = open?.options
  return (
    <Ctx.Provider value={ask}>
      {children}
      {o && (
        <div className="dlg-scrim" onClick={() => answer(false)}>
          <div
            className="dlg"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dlg-title"
            aria-describedby={o.message ? 'dlg-message' : undefined}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <h2 id="dlg-title">{o.title}</h2>
            {o.message && <p id="dlg-message">{o.message}</p>}
            <div className="dlg-actions">
              <button ref={cancel} type="button" className="no" onClick={() => answer(false)}>{o.cancelLabel ?? 'Cancelar'}</button>
              <button ref={ok} type="button" className={`ok${o.tone === 'danger' ? ' danger' : ''}`} onClick={() => answer(true)}>{o.confirmLabel ?? 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
