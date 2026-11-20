/**
 * A random id (version 4) for a new row, made on the phone so that sending it twice cannot create it twice.
 *
 * It uses the browser's own generator wherever there is one, which is every current phone, so nothing
 * changes there. `crypto.randomUUID` is missing on iPhones before iOS 15.4: there, calling it throws,
 * and with it saving a fine or a payment fails before anything is sent. This falls back to random
 * bytes from the browser, and as a last resort to Math.random (the id only has to be unique, not secret).
 */
export function newUuid(): string {
  const c: Crypto | undefined = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // the standard variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
