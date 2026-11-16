import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { isConfirmed, isTap, knobPosition, progress } from '../lib/slide'
import { ArrowRightIcon, ChevronRightIcon } from './icons'

interface Props {
  /** What sliding will do, e.g. "Deslize para registar". */
  label: string
  /** A line under the label, e.g. how many and how much. */
  detail?: string
  /** Shown instead of the label while the action runs. */
  busyLabel: string
  busy: boolean
  disabled: boolean
  /** Called when the knob is let go at the end. Return false if the action cannot go ahead, so the knob springs back. */
  onConfirm: () => boolean | void
}

const KNOB = 52
const PAD = 8

/**
 * Confirm by sliding the knob along the track instead of tapping a button, so a stray tap cannot
 * register anything. Let go early and it springs back; a plain tap only nudges it as a hint.
 * Without a finger (keyboard, screen reader) activating the knob confirms, as nobody can slide there.
 */
export default function SlideToConfirm({ label, detail, busyLabel, busy, disabled, onConfirm }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [nudge, setNudge] = useState(false)
  const xRef = useRef(0)
  const origin = useRef<{ pointer: number; x: number } | null>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy

  const room = () => (track.current ? track.current.clientWidth - KNOB - PAD * 2 : 0)
  const move = (value: number) => {
    xRef.current = value
    setX(value)
  }

  // the action finished (or failed): the knob goes home
  useEffect(() => {
    if (!busy) move(0)
  }, [busy])
  useEffect(() => {
    if (disabled) move(0)
  }, [disabled])

  // the newest props, for handlers that were set up when the finger went down
  const latest = useRef({ disabled, onConfirm })
  latest.current = { disabled, onConfirm }
  const stopListening = useRef<(() => void) | null>(null)
  useEffect(() => () => stopListening.current?.(), [])

  function confirm() {
    if (latest.current.disabled || busyRef.current) return
    move(room())
    if (latest.current.onConfirm() === false) return move(0)
    // if nothing started (the form refused it), do not leave the knob stranded at the end
    setTimeout(() => !busyRef.current && move(0), 700)
  }

  function release() {
    if (!origin.current) return
    origin.current = null
    setDragging(false)
    if (isConfirmed(xRef.current, room())) return confirm()
    if (isTap(xRef.current, room())) {
      setNudge(true)
      setTimeout(() => setNudge(false), 700)
    }
    move(0)
  }

  function down(e: PointerEvent<HTMLButtonElement>) {
    if (disabled || busy) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* not every browser lets a synthetic pointer be captured; the window listeners below cover it */
    }
    origin.current = { pointer: e.clientX, x: xRef.current }
    setDragging(true)
    // follow the finger on the whole window, so the knob keeps moving wherever it strays
    const onMove = (ev: globalThis.PointerEvent) => {
      if (origin.current) move(knobPosition(origin.current.x, ev.clientX - origin.current.pointer, room()))
    }
    const onEnd = () => {
      stopListening.current?.()
      release()
    }
    stopListening.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      stopListening.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  function key(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault()
      confirm()
    }
  }

  const p = progress(x, room())
  return (
    <div className={`slide${disabled ? ' off' : ''}${busy ? ' busy' : ''}`} ref={track}>
      <div className="slide-fill" style={{ width: x + KNOB + PAD, transition: dragging ? 'none' : undefined }} />
      <span className="slide-tx" style={{ opacity: busy ? 1 : 1 - p * 1.3 }}>
        <b>{busy ? busyLabel : label}</b>
        {detail && !busy && <small>{detail}</small>}
      </span>
      <ChevronRightIcon className="ic slide-hint" />
      <button
        type="button"
        className={`slide-knob${nudge ? ' nudge' : ''}`}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : undefined }}
        disabled={disabled}
        aria-label={`${label}${detail ? `. ${detail}` : ''}. Deslize para a direita, ou ative com Enter.`}
        onPointerDown={down}
        onKeyDown={key}
        onClick={(e) => e.detail === 0 && confirm()} // keyboard or screen reader; a finger has to slide
      >
        <ArrowRightIcon />
      </button>
    </div>
  )
}
