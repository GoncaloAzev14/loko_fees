import { Async } from '../components/ui'
import { finesInForce } from '../lib/fineTable'
import { money } from '../lib/format'
import { useFineTypes, useSettings } from '../lib/hooks'

/** Every fine that is being enforced and what it costs, so any player can look it up. Open to everyone. */
export default function FineTable() {
  const types = useFineTypes()
  const settings = useSettings() // only adds the late-fee card; if it cannot be read the list is still shown
  return (
    <>
      <h1>Tabela de multas</h1>
      <Async q={types}>
        {(list) => {
          const rows = finesInForce(list, settings.data?.late_fine_amount)
          if (rows.length === 0) return <p className="muted pad">Ainda não há multas definidas.</p>
          return (
            <ul className="list">
              {rows.map((r) => (
                <li key={r.key} className="row">
                  <div className="row-main">
                    <div className="row-title">{r.description}</div>
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
