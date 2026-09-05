import { Fragment, useState } from 'react'
import { Card, Modal, Note, RichSelect } from '../components'
import { useStore } from '../store'
import { DIRECTIVE_LABEL, SIGNATORY_LABEL, TODAY, TRAIL_OFFICES, allPrerequisites, nextControlNo, paperNumber, trailDays, trailFor } from '../lib/workflow'
import { TRAILS_WITH_CHECKPOINTS } from '../data/trail'
import { DERIVED_SUBJECT, INTERNAL_PROGRAM_IDS, NO_PROGRAM, liaisonFor } from '../data/seed'
import type { Directive, TypeField } from '../types'

/**
 * Intake renders itself from the document type's field definition and shows
 * the trail the document is about to enter, so the encoder can see what
 * happens next before saving.
 */
export function Intake({ onCreated, onClose }: { onCreated: (id: string) => void; onClose: () => void }) {
  const { db, addDoc, lang } = useStore()
  const [trailCode, setTrailCode] = useState('TO')
  const [programId, setProgramId] = useState('p-rice')
  const [subject, setSubject] = useState('')
  const [directive, setDirective] = useState<Directive | ''>('')
  const [amount, setAmount] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [prereqManual, setPrereqManual] = useState<string[]>([])
  const [disposition, setDisposition] = useState<'pa' | 'release' | ''>('')
  const [liaisonId, setLiaisonId] = useState('')

  const trail = trailFor(trailCode)!
  const type = db.types.find((t) => t.code === trailCode)!
  // The directive comes off the routing slip attached to an incoming letter.
  const isComm = trailCode === 'COMM-IN'
  const showAmount = ['PR', 'DV', 'OBR', 'PO', 'PROP', 'PAY-P', 'PAY-C', 'PAY-JO'].includes(trailCode)
  // Payroll, the PPMP and leave applications belong to no single program, and
  // are filed under Administrative & Finance.
  const noProgram = NO_PROGRAM.has(trailCode)
  // Some types name themselves from their own fields rather than a typed line.
  const derive = DERIVED_SUBJECT[trailCode]
  const headline = derive ? derive(values) : subject.trim()

  const missingRequired = [
    ...type.fields.filter((f) => f.required && !(values[f.key] ?? '').trim()).map((f) => f.labelEn),
    // "Other" is not an answer on its own — the actual class of goods is needed.
    ...(values.supply_category === 'Other' && !(values.supply_category_other ?? '').trim()
      ? ['Class of goods — specify which'] : []),
  ]
  // Attachments plus the in-office counter-signatures the paper must already
  // carry. A document is not registered until the encoder confirms every one is
  // in hand — registering without them is what lets an incomplete folder travel
  // down the trail and come back returned, weeks later.
  const prereqs = allPrerequisites(trailCode)
  const missingPrereqs = prereqs.filter((p) => !prereqManual.includes(p))
  // Where the document goes the moment it is registered. The encoder must say.
  const liaisons = db.users.filter((u) => u.roles[0] === 'liaison')
  const suggested = liaisonFor(trailCode, values.supply_category)
  const carrier = liaisonId || suggested?.id || liaisons[0]?.id || ''
  const canSave = headline !== '' && missingRequired.length === 0
    && missingPrereqs.length === 0 && disposition !== ''

  function set(k: string, v: string) {
    setValues((p) => {
      const next = { ...p, [k]: v }
      // Moving off "Other" takes the free-text answer with it.
      if (k === 'supply_category' && v !== 'Other') delete next.supply_category_other
      return next
    })
  }

  function save() {
    onCreated(addDoc({
      trailCode, programId: noProgram ? 'p-admin' : programId, subject: headline, fields: values,
      directive: directive || undefined,
      amount: amount ? Number(amount) : undefined,
      prereqManual,
      disposition: disposition as 'pa' | 'release',
      liaisonId: disposition === 'release' ? carrier : undefined,
    }))
  }

  function renderField(f: TypeField) {
    const common = { id: f.key, className: 'input', value: values[f.key] ?? '', onChange: (e: any) => set(f.key, e.target.value) }
    // The list cannot name everything the office buys, so "Other" opens a box.
    const specify = f.key === 'supply_category' && values[f.key] === 'Other'
    return (
      <Fragment key={f.key}>
      <div className="field">
        <label htmlFor={f.key}>
          {f.labelEn}
          {lang === 'fil' && <span className="fil">{f.labelFil}</span>}
          {f.required && <span className="req"> *</span>}
        </label>
        {f.type === 'textarea' ? <textarea {...common} rows={3} />
          : f.type === 'select' ? (
            <select {...common}>
              <option value="">—</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === 'combo' ? (
            // Suggestions, not a cage: the encoder can type a code that is not
            // on the list, which an office chart of accounts will always need.
            <>
              <input {...common} list={`dl-${f.key}`} placeholder="Pick a code or type one" autoComplete="off" />
              <datalist id={`dl-${f.key}`}>
                {f.options?.map((o) => <option key={o} value={o}>{f.optionLabels?.[o] ?? o}</option>)}
              </datalist>
              {f.optionLabels?.[values[f.key] ?? ''] && (
                <div className="sub" style={{ marginTop: 4 }}>{f.optionLabels[values[f.key]]}</div>
              )}
            </>
          ) : f.type === 'people' ? (
            <input {...common} placeholder="Comma-separated — a travel order can cover several people" />
          ) : <input {...common} type={f.type === 'number' || f.type === 'money' ? 'number' : 'text'} />}
      </div>
      {specify && (
        <div className="field">
          <label htmlFor="supply_category_other">
            Specify the class of goods <span className="req">*</span>
          </label>
          <input
            id="supply_category_other" className="input" autoFocus
            value={values.supply_category_other ?? ''}
            onChange={(e) => set('supply_category_other', e.target.value)}
            placeholder="What is actually being bought"
          />
        </div>
      )}
      </Fragment>
    )
  }

  const blockers = [
    headline === '' ? (derive ? 'the details it is named from' : 'a description') : null,
    ...missingRequired,
    ...missingPrereqs,
    disposition === '' ? 'where it goes' : null,
  ].filter(Boolean) as string[]

  return (
    <Modal
      wide
      title="Register a document"
      description="The number is issued on save. Every prerequisite must be in hand, and you must say where the document goes."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary" disabled={!canSave} onClick={save}
            title={blockers.length ? `Still needed: ${blockers.join(', ')}` : undefined}
          >
            Register document
          </button>
        </>
      }
    >
      <div className="intake">
        <div className="split">
          <div>
            <Card title="Classification">
              <div className="ctrl-preview">
                <span>Control number</span>
                <b className="mono">{nextControlNo(db.docs, trailCode, TODAY)}</b>
                {trail.refNumberOrigin === 'OPAG' && (
                  <small>write <b className="mono">{paperNumber(nextControlNo(db.docs, trailCode, TODAY))}</b> on the paper</small>
                )}
              </div>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="type">Document type <span className="req">*</span></label>
                  <select id="type" className="input" value={trailCode}
                    onChange={(e) => {
                      setTrailCode(e.target.value); setValues({}); setPrereqManual([])
                      setDisposition(''); setLiaisonId('')
                    }}>
                    {TRAILS_WITH_CHECKPOINTS.map((t) => (
                      <option key={t.code} value={t.code}>{t.name}{t.variant ? ` — ${t.variant}` : ''}</option>
                    ))}
                  </select>
                </div>
                {!noProgram && (
                  <div className="field">
                    <label htmlFor="prog">Program <span className="req">*</span></label>
                    <RichSelect
                      id="prog" value={programId} onChange={setProgramId}
                      options={db.programs.filter((p) => !INTERNAL_PROGRAM_IDS.has(p.id))
                        .map((p) => ({ value: p.id, code: p.code, name: p.name }))}
                    />
                  </div>
                )}
              </div>
              {!derive && (
                <div className="field">
                  <label htmlFor="subject">Description <span className="req">*</span></label>
                  <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}
                    placeholder="One line describing the document" />
                </div>
              )}
              {isComm && (
                <div className="field">
                  <label htmlFor="dir">Directive <span className="muted">(from the routing slip)</span></label>
                  <select id="dir" className="input" value={directive} onChange={(e) => setDirective(e.target.value as Directive)}>
                    <option value="">—</option>
                    {Object.entries(DIRECTIVE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              {showAmount && (
                <div className="field">
                  <label htmlFor="amt">Amount (PHP)</label>
                  <input id="amt" className="input" type="number" min={0} value={amount}
                    onChange={(e) => setAmount(e.target.value)} />
                </div>
              )}
            </Card>

            {type.fields.length > 0 && (
            <Card title={`Details — ${trail.name}`} subtitle="Fields come from the document type definition, so adding a type needs no code change">
              {trail.category === 'Procurement' && !noProgram && (
                <Note tone="info">
                  Purchase Requests are prepared by the program coordinator for a specific activity. The
                  <b> program</b> and <b>activity</b> together identify the procurement case, and are what groups
                  this document with the Abstract, OBR, PO and DV that follow it.
                </Note>
              )}
              <div className="grid2">{type.fields.map(renderField)}</div>
            </Card>
            )}

            {prereqs.length > 0 && (
              <Card
                title="Prerequisites"
                subtitle="Every one must be in hand before the document can be registered"
                action={missingPrereqs.length === 0
                  ? <span className="pill pill-ok"><span className="dot" />All in hand</span>
                  : <span className="pill pill-warn"><span className="dot" />{missingPrereqs.length} missing</span>}
              >
                <ul className="tree">
                  {prereqs.map((p) => (
                    <li key={p}>
                      <label className="ck">
                        <input type="checkbox" checked={prereqManual.includes(p)}
                          onChange={(e) => setPrereqManual((m) => e.target.checked ? [...m, p] : m.filter((x) => x !== p))} />
                        <span className="tx">{p}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div>
            <Card
              title="Where does it go?"
              subtitle="The document moves here the moment it is registered"
              action={disposition
                ? <span className="pill pill-ok"><span className="dot" />Set</span>
                : <span className="pill pill-warn"><span className="dot" />Required</span>}
            >
              <div className="choices">
                <label className={`choice${disposition === 'pa' ? ' on' : ''}`}>
                  <input type="radio" name="disposition" checked={disposition === 'pa'}
                    onChange={() => setDisposition('pa')} />
                  <span>
                    <b>For signature of the Provincial Agriculturist</b>
                    <small>Lands on his table. You record the signature once he has signed.</small>
                  </span>
                </label>
                <label className={`choice${disposition === 'release' ? ' on' : ''}`}>
                  <input type="radio" name="disposition" checked={disposition === 'release'}
                    onChange={() => setDisposition('release')} />
                  <span>
                    <b>For release</b>
                    <small>Leaves the office. Lands in the carrying liaison's Ready to carry.</small>
                  </span>
                </label>
              </div>

              {disposition === 'release' && (
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="carrier">Carried by <span className="req">*</span></label>
                  <select id="carrier" className="input" value={carrier}
                    onChange={(e) => setLiaisonId(e.target.value)}>
                    {liaisons.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}{suggested?.id === u.id ? ' — assigned to this type' : ''}
                      </option>
                    ))}
                  </select>
                  {suggested && carrier !== suggested.id && (
                    <div className="sub">
                      The assignment matrix gives this type to <b>{suggested.name}</b>. Choosing someone
                      else is recorded against the document.
                    </div>
                  )}
                </div>
              )}
            </Card>

          <Card title="What happens next" subtitle={`${trail.steps.length} steps · ${trailDays(trail)} working days`}>
            {(() => {
              // Every document gets the office's own number on save. For the
              // types OPAg numbers itself, the tail of that number is what the
              // clerk writes on the paper.
              const willBe = nextControlNo(db.docs, trailCode, TODAY)
              return trail.refNumberOrigin === 'OPAG' ? (
                <Note tone="info">
                  The system will record this as <b className="mono">{willBe}</b> when you save.
                  This office issues its own number for this type — write{' '}
                  <b className="mono">{paperNumber(willBe)}</b> on the paper.
                </Note>
              ) : (
                <Note tone="quiet">
                  The system will record this as <b className="mono">{willBe}</b> when you save.
                  {trail.refNumberOrigin
                    ? <> Its reference number is issued by <b>{TRAIL_OFFICES[trail.refNumberOrigin] ?? trail.refNumberOrigin}</b>, and recorded here once that office assigns it.</>
                    : <> No outside office issues a reference number for this type.</>}
                </Note>
              )
            })()}
            <ul className="trail">
              {trail.steps.map((s) => (
                <li key={s.seq} className={`pending${s.isCheckpoint ? ' checkpoint' : ''}`}>
                  <span className="n">{s.seq}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="what" style={{ color: 'var(--ink-2)' }}>{s.requirement}</div>
                    <div className="meta">
                      <span>{TRAIL_OFFICES[s.officeCode] ?? s.officeCode}</span>
                      {s.isCheckpoint && <span className="pill pill-accent">PA checkpoint</span>}
                    </div>
                  </div>
                  <div className="rt mono">{s.days != null ? `${s.days}d` : '—'}</div>
                </li>
              ))}
            </ul>
          </Card>
          </div>
        </div>

        {missingRequired.length > 0 && (
          <Note tone="warn">Required before saving: {missingRequired.join(', ')}</Note>
        )}
        {missingPrereqs.length > 0 && (
          <Note tone="crit">
            <b>Cannot register yet.</b> {missingPrereqs.length} of {prereqs.length} prerequisites
            are not in hand: {missingPrereqs.join(', ')}. Tick each one once you are holding it.
          </Note>
        )}
      </div>
    </Modal>
  )
}
