const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
export const money = (n: number) => eur.format(n)

/** '124,00' and '€' separately, so the symbol can be styled on its own. */
export function moneyParts(n: number) {
  const parts = eur.formatToParts(n)
  return {
    value: parts.filter((p) => p.type !== 'currency' && p.type !== 'literal').map((p) => p.value).join(''),
    symbol: parts.find((p) => p.type === 'currency')?.value ?? '€',
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())

/** 'YYYY-MM-DD' as a local date (new Date('YYYY-MM-DD') would be UTC and can shift a day). */
export function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const short = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
const long = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
export const formatDate = (iso: string) => short.format(parseDate(iso))
export const formatDateLong = (iso: string) => long.format(parseDate(iso))

/** First and last day of the month `offset` months from now, as ISO dates. */
export function monthRange(offset = 0, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: toISO(start), to: toISO(end) }
}

/** Accepts '2,5' and '2.5'. Returns NaN for anything else. */
export function parseAmount(s: string) {
  const t = s.trim().replace(',', '.')
  return t === '' ? NaN : Number(t)
}
