import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Async, ErrorNote } from '../../components/ui'
import { applyLateFees, closeSeason, saveSettings } from '../../lib/api'
import { money, parseAmount } from '../../lib/format'
import { useAction, useSettings, useSummary } from '../../lib/hooks'
import { isSeason, nextSeason } from '../../lib/season'
import type { Settings as S } from '../../lib/types'

export default function Settings() {
  const q = useSettings()
  return (
    <>
      <h1>Definições</h1>
      <Async q={q}>{(s) => <SettingsForm s={s} />}</Async>
    </>
  )
}

function SettingsForm({ s }: { s: S }) {
  const [late, setLate] = useState(String(s.late_fine_amount).replace('.', ','))
  const [day, setDay] = useState(String(s.due_day))
  const [season, setSeason] = useState(s.season)
  useEffect(() => setSeason(s.season), [s.season]) // follows a season closed from the card below
  const [result, setResult] = useState<string | null>(null)
  const save = useAction(saveSettings)
  const apply = useAction(async () => {
    const n = await applyLateFees()
    setResult(n === 0 ? 'Nenhuma multa de atraso por aplicar.' : `${n} ${n === 1 ? 'multa de atraso aplicada' : 'multas de atraso aplicadas'}.`)
  })

  const amount = parseAmount(late)
  const dueDay = Number(day)
  const valid = amount >= 0 && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28 && isSeason(season)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (valid) await save.run({ late_fine_amount: amount, due_day: dueDay, season: season.trim() })
  }

  return (
    <>
      <form className="card form" onSubmit={submit}>
        <label className="field" htmlFor="season">Época</label>
        <input id="season" required inputMode="numeric" placeholder="2026/27" value={season} onChange={(e) => setSeason(e.target.value)} aria-invalid={!isSeason(season)} />
        <p className="muted small">
          {isSeason(season) ? `O nome da aplicação é «FC Lokomotiv ${season.trim()}».` : 'Use o formato 2026/27.'} Isto só muda o nome
          (para corrigir um engano). Para começar uma nova época, use «Fechar época» mais abaixo.
        </p>
        <label className="field" htmlFor="due">Dia limite de pagamento (do mês seguinte)</label>
        <input id="due" type="number" min={1} max={28} required value={day} onChange={(e) => setDay(e.target.value)} />
        <p className="muted small">Uma multa de outubro tem de ser paga até ao dia {valid ? dueDay : '…'} de novembro.</p>
        <label className="field" htmlFor="late">Multa por falta de pagamento (€)</label>
        <input id="late" inputMode="decimal" required value={late} onChange={(e) => setLate(e.target.value)} />
        <p className="muted small">
          Aplicada automaticamente uma vez por jogador e por mês, a quem ainda deve multas desse mês depois do prazo
          {valid && ` (${money(amount)})`}.
        </p>
        <ErrorNote error={save.error} />
        <button className="btn" disabled={!valid || save.busy}>Guardar</button>
      </form>

      <section className="card">
        <h2>Multas de atraso</h2>
        <p className="muted small">São aplicadas todos os dias e sempre que um administrador abre a aplicação. Pode forçar agora:</p>
        <ErrorNote error={apply.error} />
        {result && <p className="good" role="status">{result}</p>}
        <button className="btn secondary" disabled={apply.busy} onClick={() => apply.run()}>Aplicar agora</button>
      </section>

      <CloseSeason current={s.season} />
    </>
  )
}

/** Archive the season and start again. Destructive, so it asks to type the season to confirm. */
function CloseSeason({ current }: { current: string }) {
  const summary = useSummary()
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState(nextSeason(current))
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => setNext(nextSeason(current)), [current])
  const close = useAction(async () => {
    await closeSeason(next.trim())
    setDone(`Época ${current} arquivada. Começou a época ${next.trim()}.`)
    setOpen(false)
    setTyped('')
  })

  const ready = isSeason(next) && next.trim() !== current && typed.trim() === current

  return (
    <section className="card">
      <h2>Fechar época</h2>
      <p className="muted small">
        No fim da época: guarda um resumo no <Link to="/admin/archive">arquivo</Link> e recomeça com as multas, os pagamentos,
        as receitas e as despesas a zero. O dinheiro da caixa transita. Os jogadores e os tipos de multa mantêm-se.
      </p>
      {done && <p className="good" role="status">{done}</p>}
      {!open ? (
        <button className="btn secondary" onClick={() => { setOpen(true); setDone(null) }}>Fechar a época {current}…</button>
      ) : (
        <div className="form">
          <div role="alert" style={{ border: '1px solid var(--brand)', borderRadius: 14, padding: 12 }}>
            <strong>Isto apaga dados e não se pode desfazer.</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }} className="small">
              <li>Todas as multas e pagamentos da época {current} são apagados (ficam só os totais no arquivo).</li>
              {summary.data && (
                <>
                  <li>Dívidas por pagar que <strong>deixam de existir</strong>: {money(summary.data.total_outstanding)}.</li>
                  <li>Crédito de jogadores que <strong>deixa de existir</strong>: {money(summary.data.total_credit)}.</li>
                  <li>Caixa que transita para a nova época: {money(summary.data.box)}.</li>
                </>
              )}
            </ul>
          </div>
          <label className="field" htmlFor="next">Nova época</label>
          <input id="next" inputMode="numeric" placeholder="2027/28" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!isSeason(next)} />
          <label className="field" htmlFor="typed">Para confirmar, escreva {current}</label>
          <input id="typed" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <ErrorNote error={close.error} />
          <div className="actions">
            <button className="btn" disabled={!ready || close.busy} onClick={() => close.run()}>
              {close.busy ? 'A fechar…' : `Fechar ${current} e começar ${isSeason(next) ? next.trim() : '…'}`}
            </button>
            <button className="btn secondary" onClick={() => { setOpen(false); setTyped('') }}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}
