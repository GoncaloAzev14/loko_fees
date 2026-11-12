/**
 * Where each option of the swing menu lands: an arc over the centre button.
 * `cx` / `cy` are the cosine and sine of the angle; CSS multiplies them by the radius,
 * so the arc can shrink on narrow screens.
 */
export function fanPositions(count: number, from = 160, to = 20) {
  return Array.from({ length: count }, (_, i) => {
    const angle = count === 1 ? 90 : from + ((to - from) * i) / (count - 1)
    const rad = (angle * Math.PI) / 180
    return { cx: Math.round(Math.cos(rad) * 1e4) / 1e4, cy: Math.round(Math.sin(rad) * 1e4) / 1e4 }
  })
}
