import { useEffect, useState, type ReactNode } from 'react'
import { groupRows, type GroupBy } from '../lib/groups'
import { money } from '../lib/format'
import { ChevronRightIcon } from './icons'

interface Props<T> {
  /** Newest first. */
  rows: T[]
  dateOf: (row: T) => string
  by: GroupBy
  /** If given, each header shows the group's total. */
  amountOf?: (row: T) => number
  formatTotal?: (total: number) => string
  /** One <li key=...> per row. */
  render: (row: T) => ReactNode
  /** A search or filter narrowed the list: open every group at first, so the results are not hidden. */
  filtering?: boolean
  /** When this changes (a new search, a new filter) the groups go back to their defaults. */
  resetKey?: string
  /** Makes the ids of the groups unique on the page. */
  idPrefix: string
  /** [singular, plural] of what the rows are, for the count in each header: ['multa', 'multas']. */
  noun?: [string, string]
}

/**
 * A long list of dated rows as groups (days or months) that open and close. They start closed, so the
 * list is a short column of headers (what, how many, how much) and the person opens what they are looking for.
 * Searching or filtering opens the matching groups. The rows themselves are drawn by the caller.
 */
export default function Folded<T>({ rows, dateOf, by, amountOf, formatTotal = money, render, filtering = false, resetKey, idPrefix, noun }: Props<T>) {
  // groups opened or closed by hand; one without an entry follows the default (closed, or open while filtering)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  useEffect(() => setToggled({}), [resetKey])

  const groups = groupRows(rows, dateOf, by, amountOf)
  const isOpen = (key: string) => toggled[key] ?? filtering
  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.key))
  const count = (n: number) => (noun ? `${n} ${n === 1 ? noun[0] : noun[1]}` : String(n))

  return (
    <>
      {groups.length > 1 && (
        <p className="fold-tools">
          <button className="link" onClick={() => setToggled(Object.fromEntries(groups.map((g) => [g.key, !allOpen])))}>
            {allOpen ? 'Recolher tudo' : 'Abrir tudo'}
          </button>
        </p>
      )}
      {groups.map((g) => {
        const open = isOpen(g.key)
        const id = `${idPrefix}-${g.key}`
        return (
          <section key={g.key} className="fold">
            <button className="fold-head" aria-expanded={open} aria-controls={id} onClick={() => setToggled((t) => ({ ...t, [g.key]: !open }))}>
              <ChevronRightIcon className={`ic sm chev${open ? ' open' : ''}`} />
              <span className="fold-name">{g.label}</span>
              <span className="fold-meta">{count(g.rows.length)}{amountOf ? ` · ${formatTotal(g.total)}` : ''}</span>
            </button>
            {open && <ul className="list" id={id}>{g.rows.map(render)}</ul>}
          </section>
        )
      })}
    </>
  )
}
