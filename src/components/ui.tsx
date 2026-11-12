import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { money } from '../lib/format'
import { STATUS_LABEL } from '../lib/labels'
import type { Balance, FineStatus } from '../lib/types'

/** Renders query data, or a loading / error state. */
export function Async<T>({ q, children }: { q: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (q.isPending) return <p className="muted pad">A carregar…</p>
  if (q.isError)
    return (
      <p className="error pad" role="alert">
        Não foi possível carregar os dados. <button className="link" onClick={() => q.refetch()}>Tentar de novo</button>
      </p>
    )
  return <>{children(q.data)}</>
}

export function StatCard({ label, value, tone, hint }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn'; hint?: string }) {
  return (
    <div className={`card stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function StatusBadge({ status, remaining, amount }: { status: FineStatus; remaining?: number; amount?: number }) {
  const partial = remaining !== undefined && amount !== undefined && remaining > 0 && remaining < amount && status !== 'cancelled'
  return (
    <span className={`badge ${status}`}>
      {STATUS_LABEL[status]}
      {partial && ` · faltam ${money(remaining)}`}
    </span>
  )
}

export function BalanceLine({ b }: { b: Balance }) {
  if (b.credit > 0) return <span className="good">Crédito {money(b.credit)}</span>
  if (b.outstanding > 0)
    return (
      <span className="bad">
        Em dívida {money(b.outstanding)}
        {b.overdue > 0 && <span className="muted"> · {money(b.overdue)} vencido</span>}
      </span>
    )
  return <span className="muted">Sem dívidas</span>
}

export function PlayerSelect({
  balances, value, onChange, placeholder = 'Todos', id, required,
}: {
  balances: Balance[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  id?: string
  required?: boolean
}) {
  return (
    <select id={id} value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {balances.map((b) => (
        <option key={b.player_id} value={b.player_id}>
          {b.name}
          {!b.active ? ' (inativo)' : ''}
        </option>
      ))}
    </select>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <p className="error" role="alert">{error}</p> : null
}
