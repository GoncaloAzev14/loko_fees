/**
 * Hand-drawn-looking contour lines (like the rings on a topographic map) for backgrounds.
 * Fully deterministic: the same call always gives the same drawing, so it never "jumps".
 */

type Point = [number, number]

/** A smooth closed curve through the points (Catmull-Rom converted to cubic Béziers). */
function smoothClosed(points: Point[]): string {
  const n = points.length
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

export interface Blob {
  /** centre, as a fraction of the width / height */
  x: number
  y: number
  /** radius of the outermost ring, as a fraction of the width */
  radius: number
  rings: number
  /** changes the shape */
  phase: number
}

export const DEFAULT_BLOBS: Blob[] = [
  { x: 0.22, y: 0.28, radius: 0.62, rings: 9, phase: 0.4 },
  { x: 0.86, y: 0.7, radius: 0.55, rings: 8, phase: 2.1 },
  { x: 0.55, y: 0.05, radius: 0.34, rings: 5, phase: 4.2 },
]

/** One closed path per ring, for a drawing of `width` x `height`. */
export function contourPaths(width: number, height: number, blobs: Blob[] = DEFAULT_BLOBS): string[] {
  const paths: string[] = []
  for (const b of blobs) {
    for (let ring = 1; ring <= b.rings; ring++) {
      const r = (b.radius * width * ring) / b.rings
      const drift = b.phase + ring * 0.17 // rings change shape slowly, like real contours
      const points: Point[] = []
      const steps = 30
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2
        const wobble = 1 + 0.17 * Math.sin(2 * a + drift) + 0.09 * Math.sin(3 * a + drift * 1.7) + 0.05 * Math.sin(5 * a + drift * 0.6)
        points.push([b.x * width + Math.cos(a) * r * wobble, b.y * height + Math.sin(a) * r * wobble])
      }
      paths.push(smoothClosed(points))
    }
  }
  return paths
}
