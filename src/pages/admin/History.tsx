import { useMemo, useState } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { restoreChange } from '../../lib/api'
import { describeChange, whoLabel } from '../../lib/changes'
import { useAction, useChanges, useLookups } from '../../lib/hooks'

const when = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Everything that was added, changed or deleted, newest first, and who did it. A deleted entry can be put
 * back exactly as it was. The record is kept by the database itself: nobody can edit it from here.
 */
export default function History() {
  const q = useChanges()
  const { players, types } = useLookups()
  const [onlyDeleted, setOnlyDeleted] = useState(false)
  const restore = useAction(restoreChange)
  const names = useMemo(() => new Map([...players].map(([id, p]) => [id, p.name])), [players])
  const typeNames = useMemo(() => new Map([...types].map(([id, t]) => [id, t.name])), [types])

  return (
    <>
      <div className="sticky-box">
        <h1>Histórico</h1>
        <div className="chips" role="group" aria-label="Filtro">
          <button className={`chip ${!onlyDeleted ? 'on' : ''}`} aria-pressed={!onlyDeleted} onClick={() => setOnlyDeleted(false)}>Tudo</button>
          <button className={`chip ${onlyDeleted ? 'on' : ''}`} aria-pressed={onlyDeleted} onClick={() => setOnlyDeleted(true)}>Só apagados</button>
        </div>
      </div>
      <ErrorNote error={restore.error} />
      <Async q={q}>
        {(rows) => {
          const shown = onlyDeleted ? rows.filter((c) => c.action === 'delete') : rows
          if (shown.length === 0)
            return <p className="muted pad">{onlyDeleted ? 'Nada foi apagado desde que o histórico começou.' : 'O histórico começa a partir da primeira alteração.'}</p>
          return (
            <ul className="list">
              {shown.map((c) => {
                const { title, detail } = describeChange(c, names, typeNames)
                return (
                  <li key={c.id} className="row">
                    <div className="row-main">
                      <div className="row-title" style={c.action === 'delete' ? { textDecoration: 'line-through' } : undefined}>
                        {title}{detail && <span className="muted"> · {detail}</span>}
                      </div>
                      <div className="row-sub">{when.format(new Date(c.at))} · {whoLabel(c.who_email)}</div>
                      {c.restorable && (
                        <div className="row-actions">
                          <button
                            className="link"
                            disabled={restore.busy}
                            onClick={() => confirm('Repor esta linha tal como estava?') && restore.run(c.id)}
                          >
                            Repor
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        }}
      </Async>
    </>
  )
}
