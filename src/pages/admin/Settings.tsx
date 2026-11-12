import { useState, type FormEvent } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { applyLateFees, saveSettings } from '../../lib/api'
import { money, parseAmount } from '../../lib/format'
import { useAction, useSettings } from '../../lib/hooks'
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
  const [result, setResult] = useState<string | null>(null)
  const save = useAction(saveSettings)
  const apply = useAction(async () => {
    const n = await applyLateFees()
    setResult(n === 0 ? 'Nenhuma multa de atraso por aplicar.' : `${n} ${n === 1 ? 'multa de atraso aplicada' : 'multas de atraso aplicadas'}.`)
  })

  const amount = parseAmount(late)
  const dueDay = Number(day)
  const valid = amount >= 0 && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (valid) await save.run({ late_fine_amount: amount, due_day: dueDay })
  }

  return (
    <>
      <form className="card form" onSubmit={submit}>
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
    </>
  )
}
