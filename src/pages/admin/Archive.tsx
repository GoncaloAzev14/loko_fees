import { useState } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { deleteArchivedSeason } from '../../lib/api'
import { formatDate, money } from '../../lib/format'
import { useAction, useArchivedDetail, useArchivedSeasons } from '../../lib/hooks'
import type { ArchivedSeason } from '../../lib/types'

/** Closed seasons, as a record: totals per season, per player and per fine type. Admins only. */
export default function Archive() {
  const q = useArchivedSeasons()
  return (
    <>
      <h1>Arquivo de épocas</h1>
      <p className="muted small">Cada vez que fecha uma época fica aqui um resumo, não todas as multas uma a uma. Só os administradores o veem.</p>
      <Async q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="muted pad">Ainda não fechou nenhuma época. Faça-o em Definições.</p>
          ) : (
            rows.map((s) => <Season key={s.id} s={s} />)
          )
        }
      </Async>
    </>
  )
}

function Season({ s }: { s: ArchivedSeason }) {
  const [open, setOpen] = useState(false)
  const multas = (n: number) => `${n} ${n === 1 ? 'multa' : 'multas'}`
  const detail = useArchivedDetail(s.id, open)
  const del = useAction(deleteArchivedSeason)
  return (
    <section className="card">
      <button className="card-head" style={{ width: '100%', background: 'none', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0 }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="nm" style={{ fontWeight: 700 }}>Época {s.season}</div>
          <div className="row-sub">Fechada em {formatDate(s.closed_at)} · {multas(s.fines_count)}</div>
        </div>
        <div className="big">{money(s.box)}</div>
      </button>
      <div className="lab" style={{ marginTop: 12 }}>
        <div>Multado<b>{money(s.total_fined)}</b></div>
        <div>Pago<b>{money(s.total_paid)}</b></div>
        <div style={{ textAlign: 'right' }}>Por pagar<b>{money(s.total_outstanding)}</b></div>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <p className="muted small">
            Receitas {money(s.total_income)} · despesas {money(s.total_expenses)} · crédito de jogadores {money(s.total_credit)} · caixa no fecho {money(s.box)}.
          </p>
          <Async q={detail}>
            {(d) => (
              <>
                <h2>Por tipo de multa</h2>
                <ul className="list">
                  {d.types.map((t) => (
                    <li key={t.fine_type} className="row">
                      <div className="row-main"><div className="row-title">{t.fine_type}</div><div className="row-sub">{multas(t.fines_count)}</div></div>
                      <div className="row-side amount">{money(t.total_amount)}</div>
                    </li>
                  ))}
                </ul>
                <h2>Por jogador</h2>
                <ul className="list">
                  {d.players.map((p) => (
                    <li key={p.player_name} className="row">
                      <div className="row-main">
                        <div className="row-title">{p.player_name}</div>
                        <div className="row-sub">
                          {multas(p.fines_count)} · pagou {money(p.total_paid)}
                          {p.outstanding > 0 && ` · ficou a dever ${money(p.outstanding)}`}
                          {p.credit > 0 && ` · crédito ${money(p.credit)}`}
                        </div>
                      </div>
                      <div className="row-side amount">{money(p.total_fined)}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Async>
          <ErrorNote error={del.error} />
          <button
            className="link danger"
            disabled={del.busy}
            onClick={() => confirm(`Apagar o arquivo da época ${s.season}? Não se pode desfazer.`) && del.run(s.id)}
          >
            Apagar este arquivo
          </button>
        </div>
      )}
    </section>
  )
}
