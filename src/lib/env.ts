export interface EnvNotice {
  label: string
  /** 'test' = safe dummy data; 'real' = a development server that is talking to the real database */
  tone: 'test' | 'real'
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/

/**
 * What to tell the person looking at the screen about the data behind it. Nothing for the published
 * site. A test environment says so. A development server pointed at a hosted project warns, because
 * whatever is clicked there changes the real data.
 */
export function envNotice({ mode, dev, url }: { mode: string; dev: boolean; url: string }): EnvNotice | null {
  if (mode === 'fake') return { label: 'Ambiente de teste · dados fictícios', tone: 'test' }
  if (mode === 'staging') return { label: 'Ambiente de teste · projeto de teste', tone: 'test' }
  if (dev && url && !LOCAL.test(url)) return { label: 'Atenção: a usar a base de dados REAL', tone: 'real' }
  return null
}
