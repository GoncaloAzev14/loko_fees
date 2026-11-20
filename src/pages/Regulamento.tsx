import { Async } from '../components/ui'
import { finesInForce } from '../lib/regulamento'
import { money } from '../lib/format'
import { useFineTypes, useSettings } from '../lib/hooks'

/** Every fine that is being enforced and what it costs, so any player can look it up. Open to everyone. */
export default function Regulamento() {
  const types = useFineTypes()
  const settings = useSettings() // only adds the late-fee card; if it cannot be read the list is still shown
  const lateFee = settings.data ? { amount: settings.data.late_fine_amount, dueDay: settings.data.due_day } : null
  return (
    <>
      <h1>Regulamento</h1>
      <Async q={types}>
        {(list) => {
          const rows = finesInForce(list, lateFee)
          if (rows.length === 0) return <p className="muted pad">Ainda não há multas definidas.</p>
          return (
            <ul className="list">
              {rows.map((r) => (
                <li key={r.key} className="row">
                  <div className="row-main">
                    <div className="row-title">{r.description}</div>
                    {r.note && <div className="row-sub">{r.note}</div>}
                  </div>
                  <div className="amount">{money(r.amount)}</div>
                </li>
              ))}
            </ul>
          )
        }}
      </Async>
    </>
  )
}
