import { useMemo, useState } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { restoreChange } from '../../lib/api'
import { describeChange, whoLabel } from '../../lib/changes'
import { describeEntry } from '../../lib/entries'
import { useAction, useChanges, useLookups, useQueuedEntries } from '../../lib/hooks'
import { flush, outbox } from '../../lib/sync'

const when = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Everything that was added, changed or deleted, newest first, and who did it. A deleted entry can be put
 * back exactly as it was. The record is kept by the database itself: nobody can edit it from here.
 *
 * On top, what is only on THIS phone: entries waiting to be sent, and entries the server refused. The rule is
 * simple: a change in the server's list below was saved; "Por enviar" is only on this phone; "Não aceite" was refused.
 */
export default function History() {
  const q = useChanges()
  const { players, types } = useLookups()
  const [onlyDeleted, setOnlyDeleted] = useState(false)
  const restore = useAction(restoreChange)
  const mine = useQueuedEntries()
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
      <p className="muted small" style={{ margin: '0 2px 10px' }}>
        O que está em <b>Guardado no servidor</b> está mesmo guardado. <b>Por enviar</b> só existe neste telemóvel até haver ligação. <b>Não aceite</b> foi recusado pelo servidor.
      </p>
      {mine.length > 0 && (
        <section aria-label="Neste telemóvel">
          <h2>Neste telemóvel</h2>
          <ul className="list">
            {mine.map((e) => (
              <li key={e.id} className="row">
                <div className="row-main">
                  <div className="row-title">{describeEntry(e, (id) => players.get(id)?.name, (id) => types.get(id)?.name)}</div>
                  <div className="row-sub">
                    <span className={`badge ${e.failed ? 'failed' : 'sync'}`}>{e.failed ? 'Não aceite' : 'Por enviar'}</span>
                    {e.failed && <span> {e.failed}</span>}
                  </div>
                  <div className="row-actions">
                    {e.failed && <button className="link" onClick={() => { outbox.retry(e.id); void flush() }}>Tentar de novo</button>}
                    <button className="link danger" onClick={() => confirm('Descartar esta alteração? Não será enviada.') && outbox.discard(e.id)}>Descartar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2>Guardado no servidor</h2>
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
