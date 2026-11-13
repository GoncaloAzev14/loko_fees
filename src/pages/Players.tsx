import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SearchIcon } from '../components/icons'
import { Async, Avatar } from '../components/ui'
import { money } from '../lib/format'
import { useBalances } from '../lib/hooks'

type Filter = 'all' | 'debt' | 'credit'

export default function Players() {
  const q = useBalances()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  return (
    <>
      <div className="sticky-box">
        <h1>Jogadores</h1>
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
        {(list) => {
          const term = search.trim().toLowerCase()
          const shown = list
            .filter((b) => b.name.toLowerCase().includes(term))
            .filter((b) => (filter === 'debt' ? b.outstanding > 0 : filter === 'credit' ? b.credit > 0 : true))
          if (shown.length === 0) return <p className="muted pad">Nenhum jogador encontrado.</p>
          return (
            <ul className="list">
              {shown.map((b) => (
                <li key={b.player_id} className={`row ${b.active ? '' : 'cancelled'}`}>
                  <Avatar name={b.name} />
                  <div className="row-main">
                    <Link className="row-title" to={`/players/${b.player_id}`}>{b.name}</Link>
                    <div className="row-sub">
                      {b.role === 'staff' ? 'Equipa técnica' : 'Jogador'}
                      {!b.active && ' · inativo'}
                      {b.overdue > 0 && ` · ${money(b.overdue)} vencido`}
                    </div>
                  </div>
                  <div className="row-side">
                    {b.credit > 0 ? (
                      <span className="amount good">Crédito {money(b.credit)}</span>
                    ) : b.outstanding > 0 ? (
                      <span className="amount bad">{money(b.outstanding)}</span>
                    ) : (
                      <span className="muted small">Sem dívidas</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        }}
      </Async>
    </>
  )
}
