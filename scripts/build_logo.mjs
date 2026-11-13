// Builds the app's logo files from branding/original.png (the club crest).
//
//   node scripts/build_logo.mjs
//
// Writes:
//   branding/logo-source.png  1024x1024, crest on near-black. The master the icons below are cut from.
//   public/logo.png           256x256 transparent crest, used in the header and on the login page.
//   public/pwa-64x64.png, pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png,
//   public/apple-touch-icon-180x180.png, public/favicon-48x48.png   app icons (see index.html and vite.config.ts)
//
// The original is small (388 px) and sits on a noisy near-black background. This crops to the
// crest, removes everything that is background (flood fill from the border, so the dark parts
// inside the crest are kept), and upsamples with Lanczos plus a light sharpen.
import sharp from 'sharp'

const SRC = new URL('../branding/original.png', import.meta.url).pathname
const OUT_SOURCE = new URL('../branding/logo-source.png', import.meta.url).pathname
const OUT_UI = new URL('../public/logo.png', import.meta.url).pathname
const BG = { r: 5, g: 5, b: 5 }

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: w, height: h } = info
const at = (x, y) => (y * w + x) * 4
const dark = (i) => data[i] + data[i + 1] + data[i + 2] < 110

// 1. Background = dark pixels connected to the border.
const bg = new Uint8Array(w * h)
const queue = []
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h || bg[y * w + x] || !dark(at(x, y))) return
  bg[y * w + x] = 1
  queue.push(x, y)
}
for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
while (queue.length) {
  const y = queue.pop(), x = queue.pop()
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
}

// 2. Alpha: 0 on the background, soft on the pixels touching it (anti-aliased rim), 255 elsewhere.
const rgba = Buffer.from(data)
let x0 = w, y0 = h, x1 = 0, y1 = 0
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = at(x, y)
    if (bg[y * w + x]) { rgba[i + 3] = 0; continue }
    let touches = false
    for (let dy = -1; dy <= 1 && !touches; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) { touches = true; break }
      }
    if (touches) {
      const light = data[i] + data[i + 1] + data[i + 2]
      rgba[i + 3] = Math.max(0, Math.min(255, Math.round(((light - 40) * 255) / 360)))
    }
  }
}
// Specks of noise on the frame can survive the flood fill. Drop every connected piece that is
// too small to be part of the crest (the three stars are the smallest real pieces).
const seen = new Uint8Array(w * h)
const MIN_PIECE = 150
x0 = w; y0 = h; x1 = 0; y1 = 0
for (let sy = 0; sy < h; sy++) {
  for (let sx = 0; sx < w; sx++) {
    if (seen[sy * w + sx] || rgba[at(sx, sy) + 3] <= 40) continue
    const piece = []
    const stack = [sx, sy]
    seen[sy * w + sx] = 1
    while (stack.length) {
      const y = stack.pop(), x = stack.pop()
      piece.push(x, y)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || rgba[at(nx, ny) + 3] <= 40) continue
        seen[ny * w + nx] = 1
        stack.push(nx, ny)
      }
    }
    if (piece.length / 2 < MIN_PIECE) {
      for (let k = 0; k < piece.length; k += 2) rgba[at(piece[k], piece[k + 1]) + 3] = 0
    } else {
      for (let k = 0; k < piece.length; k += 2) {
        const x = piece[k], y = piece[k + 1]
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
  }
}
const crest = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
console.log('crest', crest)

const cutout = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).extract(crest).png().toBuffer()

/** The crest scaled so its taller side is `side` px, on a transparent square of `canvas` px. */
async function onSquare(canvas, side, background) {
  const scaled = await sharp(cutout)
    .resize({ height: side, fit: 'inside', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.7, m1: 0.8, m2: 1.4 })
    .toBuffer()
  const { width: sw, height: sh } = await sharp(scaled).metadata()
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: scaled, left: Math.round((canvas - sw) / 2), top: Math.round((canvas - sh) / 2) }])
}

// Icon source: leaves room around the crest so launchers can crop to a circle or rounded square.
await (await onSquare(1024, 860, { ...BG, alpha: 1 })).png({ compressionLevel: 9 }).toFile(OUT_SOURCE)
// UI copy: transparent, almost edge to edge.
await (await onSquare(256, 244, { r: 0, g: 0, b: 0, alpha: 0 })).png({ compressionLevel: 9 }).toFile(OUT_UI)
console.log('wrote', OUT_SOURCE, OUT_UI)

// App icons, cut from the master. Opaque, so launchers show the same dark square everywhere.
const PUBLIC = new URL('../public/', import.meta.url).pathname
const master = await sharp(OUT_SOURCE).toBuffer()
/** The master scaled to `fill` of a `size` square (the rest is background), like extra padding. */
async function icon(file, size, fill = 1) {
  const inner = Math.round(size * fill)
  const art = await sharp(master).resize(inner, inner, { kernel: 'lanczos3' }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: { ...BG, alpha: 1 } } })
    .composite([{ input: art, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(PUBLIC + file)
}
await icon('pwa-64x64.png', 64)
await icon('pwa-192x192.png', 192)
await icon('pwa-512x512.png', 512)
await icon('maskable-icon-512x512.png', 512, 0.84) // Android may crop to a circle: keep the crest in the middle ~70%
await icon('apple-touch-icon-180x180.png', 180, 0.96)
await icon('favicon-48x48.png', 48)
console.log('wrote app icons in', PUBLIC)
