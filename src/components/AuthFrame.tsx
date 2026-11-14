import { useMemo, type ReactNode } from 'react'
import { contourPaths } from '../lib/contours'
import Logo from './Logo'
import TabBar from './TabBar'

const HERO_W = 390
const HERO_H = 380

/** The full screen shared by the sign-in and first-access pages: crest on contour lines, then the form. */
export default function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const lines = useMemo(() => contourPaths(HERO_W, HERO_H), [])
  return (
    <>
      <div className="login-screen">
        <div className="login-hero">
          <svg className="login-lines" viewBox={`0 0 ${HERO_W} ${HERO_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {lines.map((d, i) => <path key={i} d={d} />)}
          </svg>
          <Logo className="login-crest" />
          <svg className="login-wave" viewBox="0 0 390 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 46C70 6 128 8 196 36S330 76 390 30V80H0Z" />
          </svg>
        </div>

        <div className="login-panel">
          <h1>{title}</h1>
          {children}
        </div>
      </div>
      <TabBar />
    </>
  )
}
