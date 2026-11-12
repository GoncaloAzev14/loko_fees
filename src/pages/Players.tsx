import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Async, BalanceLine } from '../components/ui'
import { useBalances } from '../lib/hooks'

type Filter = 'all' | 'debt' | 'credit'

export default function Players() {
  const q = useBalances()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  return (
    <>
      <h1>Jogadores</h1>
      <div className="filters">
        <input type="search" placeholder="Procurar…" aria-label="Procurar jogador" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="chips" role="group" aria-label="Filtro">
          {(['all', 'debt', 'credit'] as const).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
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
                  <div className="row-main">
                    <Link className="row-title" to={`/players/${b.player_id}`}>{b.name}</Link>
                    <div className="row-sub">{b.role === 'staff' ? 'Equipa técnica' : 'Jogador'}{!b.active && ' · inativo'}</div>
                  </div>
                  <div className="row-side"><BalanceLine b={b} /></div>
                </li>
              ))}
            </ul>
          )
        }}
      </Async>
    </>
  )
}
