/** The maths of a slide-to-confirm control, kept apart from the screen so it can be tested. */

/** How far along the track the knob must be let go to count as a confirmation (0 to 1). */
export const CONFIRM_AT = 0.85

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Where the knob is after the finger moved `delta` pixels from where it started, kept on the track. */
export function knobPosition(startX: number, delta: number, max: number) {
  return clamp(startX + delta, 0, Math.max(0, max))
}

/** Was the knob let go far enough along. A track with no room never confirms. */
export function isConfirmed(x: number, max: number) {
  return max > 0 && x >= max * CONFIRM_AT
}

/** 0 at the start, 1 at the end of the track. */
export function progress(x: number, max: number) {
  return max > 0 ? clamp(x / max, 0, 1) : 0
}

/** True when the touch was a tap rather than a slide: it barely moved. */
export function isTap(x: number, max: number) {
  return x < Math.min(12, max * 0.1)
}
