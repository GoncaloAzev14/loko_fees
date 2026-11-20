import { AddFineType, FineTypeRow, LateFeeAdminCard } from '../components/FineTypeAdmin'
import { Async } from '../components/ui'
import { useAuth } from '../lib/auth'
import { money } from '../lib/format'
import { useFineTypes, useSettings } from '../lib/hooks'
import { finesInForce, lateFeeEntry, sortedTypes, type RuleEntry } from '../lib/regulamento'

function RuleCard({ r }: { r: RuleEntry }) {
  return (
    <li className="row">
      <div className="row-main">
        <div className="row-title">{r.description}</div>
        {r.note && <div className="row-sub">{r.note}</div>}
      </div>
      <div className="amount">{money(r.amount)}</div>
    </li>
  )
}

/**
 * Every fine that is being enforced and what it costs, so any player can look it up. Open to everyone.
 * Admins also get, on this same page, the form to add a fine type and, on each one, its Ativo box and its delete button.
 */
export default function Regulamento() {
  const { isAdmin } = useAuth()
  const types = useFineTypes()
  const settings = useSettings() // only adds the late-fee card; if it cannot be read the list is still shown
  const lateFee = settings.data ? { amount: settings.data.late_fine_amount, dueDay: settings.data.due_day, enabled: settings.data.late_fee_enabled } : null
  const late = lateFeeEntry(lateFee)
  return (
    <>
      {isAdmin ? (
        <div className="sticky-box form">
          <h1>Regulamento</h1>
          <AddFineType />
        </div>
      ) : (
        <h1>Regulamento</h1>
      )}
      <Async q={types}>
        {(list) => {
          // an admin sees every type, so that one switched off can be switched on again; everyone else only the ones in force
          if (isAdmin)
            return (
              <ul className="list">
                {sortedTypes(list).map((t) => <FineTypeRow key={t.id} t={t} />)}
                {late && <LateFeeAdminCard r={late} />}
              </ul>
            )
          const rows = finesInForce(list, lateFee)
          if (rows.length === 0) return <p className="muted pad">Ainda não há multas definidas.</p>
          return <ul className="list">{rows.map((r) => <RuleCard key={r.key} r={r} />)}</ul>
        }}
      </Async>
    </>
  )
}
