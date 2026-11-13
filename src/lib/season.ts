/** '2026/27': the year a season starts, then the last two digits of the year it ends. */
export function isSeason(value: string) {
  const m = /^(\d{4})\/(\d{2})$/.exec(value.trim())
  return m !== null && (Number(m[1]) + 1) % 100 === Number(m[2])
}

/** The season that follows '2026/27', i.e. '2027/28'. */
export function nextSeason(value: string) {
  const start = Number(value.slice(0, 4)) + 1
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}
