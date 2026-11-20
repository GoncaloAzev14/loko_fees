import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import SaveStatus from '../../components/SaveStatus'
import SlideToConfirm from '../../components/SlideToConfirm'
import { Async, ErrorNote } from '../../components/ui'
import { addFines } from '../../lib/api'
import { money, parseAmount, todayISO } from '../../lib/format'
import { useAction, useBalances, useFineTypes } from '../../lib/hooks'

/** Register the same fine for one or many players (e.g. the whole squad after a defeat). */
export default function AddFine() {
  const [params] = useSearchParams()
  const balances = useBalances()
  const types = useFineTypes()
  const [typeId, setTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(params.get('player') ? [params.get('player')!] : []))
  const save = useAction(addFines, (_r, n) => (n.playerIds.length === 1 ? 'Multa registada' : `${n.playerIds.length} multas registadas`))
  const formRef = useRef<HTMLFormElement>(null)
  const amountValue = parseAmount(amount)

  const allSelected = (active: { player_id: string }[]) => active.length > 0 && active.every((p) => selected.has(p.player_id))

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!typeId || selected.size === 0 || !(value >= 0)) return
    const ok = await save.run({ playerIds: [...selected], fineTypeId: typeId, amount: value, finedOn: date, description })
    if (ok) {
      setSelected(new Set())
      setDescription('')
    }
  }

  return (
    <div className="fill">
      <h1 style={{ fontSize: '1.35rem', margin: '0.1rem 0 0.7rem' }}>Registar multa</h1>
      <Async q={types}>
        {(typeList) => (
          <Async q={balances}>
            {(players) => {
              const active = players.filter((p) => p.active)
              return (
                <form className="cf fill-form" ref={formRef} onSubmit={submit}>
                  <div className="cf-row">
                    <select
                      aria-label="Motivo" required value={typeId}
                      onChange={(e) => {
                        setTypeId(e.target.value)
                        const t = typeList.find((x) => x.id === e.target.value)
                        if (t) setAmount(String(t.default_amount).replace('.', ','))
                      }}
                    >
                      <option value="">Motivo</option>
                      {typeList.filter((t) => t.active).map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({money(t.default_amount)})</option>
                      ))}
                    </select>
                    <input className="narrow" aria-label="Valor por pessoa (€)" placeholder="€" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>

                  <div className="cf-row">
                    <label className="field-inline" style={{ flex: '0 0 170px' }}>
                      <span>Data</span>
                      <input type="date" aria-label="Data" required value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    <input aria-label="Descrição (opcional)" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>

                  <div className="field-row" style={{ marginTop: 4 }}>
                    <span className="field" style={{ marginTop: 0 }}>Quem ({selected.size})</span>
                    <label className="check all">
                      <input
                        type="checkbox"
                        checked={allSelected(active)}
                        ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected(active) }}
                        onChange={() => setSelected(allSelected(active) ? new Set() : new Set(active.map((p) => p.player_id)))}
                      />
                      Todos
                    </label>
                  </div>
                  <div className="chips-fill">
                    {active.map((p) => (
                      <button type="button" key={p.player_id} aria-pressed={selected.has(p.player_id)} className={`chip ${selected.has(p.player_id) ? 'on' : ''}`} onClick={() => toggle(p.player_id)}>
                        {p.name}
                      </button>
                    ))}
                  </div>

                  <ErrorNote error={save.error} />
                  <SaveStatus save={save.saved} />
                  <SlideToConfirm
                    label="Deslize para registar"
                    busyLabel="A guardar…"
                    detail={`${selected.size === 1 ? '1 jogador' : `${selected.size} jogadores`}${amountValue >= 0 ? ` · ${money(amountValue * selected.size)}` : ''}`}
                    busy={save.busy}
                    disabled={!typeId || selected.size === 0}
                    onConfirm={() => {
                      const form = formRef.current
                      if (!form || !form.reportValidity()) return false // shows what is missing
                      if (form.requestSubmit) form.requestSubmit()
                      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
                    }}
                  />
                </form>
              )
            }}
          </Async>
        )}
      </Async>
    </div>
  )
}
