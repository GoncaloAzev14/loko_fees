import { useState } from 'react'
import { SearchIcon } from '../components/icons'
import { AddPlayer, PlayerCard } from '../components/PlayerAdmin'
import { Async } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useBalances } from '../lib/hooks'
import { plantelFor } from '../lib/roster'

type Filter = 'all' | 'debt' | 'credit'

/**
 * The club's players and staff, open to everyone. Visitors only see the members who are active. Admins see all of
 * them and, on this same page, can add a member and switch off, edit or delete each one.
 */
export default function Players() {
  const { isAdmin } = useAuth()
  const q = useBalances()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  return (
    <>
      <div className="sticky-box">
        <h1>Plantel</h1>
        {isAdmin && <div className="stack-gap"><AddPlayer /></div>}
        <div className="srch">
          <SearchIcon className="ic sm" />
          <input type="search" placeholder="Procurar…" aria-label="Procurar jogador" value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 0, background: 'none', minHeight: 0, padding: 0, boxShadow: 'none' }} />
        </div>
        <div className="chips" role="group" aria-label="Filtro" style={{ marginTop: 10 }}>
          {(['all', 'debt', 'credit'] as const).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {{ all: 'Todos', debt: 'Em dívida', credit: 'Com crédito' }[f]}
            </button>
          ))}
        </div>
      </div>
      <Async q={q}>
        {(all) => {
          const term = search.trim().toLowerCase()
          const shown = plantelFor(all, isAdmin)
            .filter((b) => b.name.toLowerCase().includes(term))
            .filter((b) => (filter === 'debt' ? b.outstanding > 0 : filter === 'credit' ? b.credit > 0 : true))
          if (shown.length === 0) return <p className="muted pad">Nenhum jogador encontrado.</p>
          return <ul className="list">{shown.map((b) => <PlayerCard key={b.player_id} b={b} admin={isAdmin} />)}</ul>
        }}
      </Async>
    </>
  )
}
