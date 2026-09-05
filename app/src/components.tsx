import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Doc } from './types'
import { useStore } from './store'
import { EXTRA_FIELD_LABELS } from './data/seed'
import { makeThumb } from './lib/thumb'
import {
  SIGNATORY_LABEL, TRAIL_OFFICES, ageInWorkingDays, allPrerequisites, assignmentReason, availableActions, liaisonLoad, statusPhrase,
  currentStep, daysAtCurrentStep, isOpen, prereqStatus, prereqsMet, slaState,
  stepState, stepsOf, trailFor,
} from './lib/workflow'
import { IconAlert, IconBell, IconCamera, IconCheck, IconChevronDown, IconTruck, IconX } from './icons'

export function StatusPill({ doc }: { doc: Doc }) {
  const { lang } = useStore()
  const s = statusPhrase(doc)
  return <span className={`pill pill-${s.tone}`}><span className="dot" />{lang === 'fil' ? s.fil : s.en}</span>
}

export function ProgramTag({ doc }: { doc: Doc }) {
  const { programOf } = useStore()
  const p = programOf(doc)
  return <span className="ptag"><i style={{ background: p.color }} />{p.code}</span>
}

export function AgeCell({ doc }: { doc: Doc }) {
  if (!isOpen(doc)) return <span className="muted">—</span>
  return (
    <span className={`age age-${slaState(doc)}`} title={`${daysAtCurrentStep(doc)}d at the current step`}>
      {ageInWorkingDays(doc)}d
    </span>
  )
}

/**
 * Trail progress as a waffle grid — one square per step, from the compliance
 * reference. Checkpoint steps (the PA record-in/record-out) render as circles
 * so they read as custody markers rather than approvals.
 */
export function Waffle({ doc, small }: { doc: Doc; small?: boolean }) {
  const steps = stepsOf(doc)
  return (
    <span className={`waffle${small ? ' sm' : ''}`}>
      {steps.map((s) => (
        <i
          key={s.seq}
          className={`${stepState(doc, s)}${s.isCheckpoint ? ' checkpoint' : ''}`}
          title={`${s.seq}. ${s.requirement} — ${SIGNATORY_LABEL[s.signatory]}`}
        />
      ))}
    </span>
  )
}

export function WaffleLegend() {
  return (
    <div className="waffle-legend">
      <span><i style={{ background: 'var(--brand)' }} /> Done</span>
      <span><i style={{ background: 'var(--accent)' }} /> Current</span>
      <span><i style={{ background: 'var(--panel)', border: '1px solid var(--line-2)' }} /> Pending</span>
      <span><i style={{ background: 'var(--accent)', borderRadius: '50%' }} /> PA checkpoint</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Card({ title, subtitle, action, children, flush }: {
  title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; flush?: boolean
}) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-h">
          <div className="card-t">
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`card-b${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  )
}

export function Note({ tone = 'quiet', children }: { tone?: 'info' | 'crit' | 'warn' | 'quiet'; children: ReactNode }) {
  return (
    <div className={`note note-${tone}`}>
      {tone === 'crit' || tone === 'warn' ? <IconAlert size={15} /> : null}
      <span>{children}</span>
    </div>
  )
}

export function Modal({ title, description, onClose, footer, wide, children }: {
  title: string; description?: string; onClose: () => void; footer?: ReactNode
  /** widen for form-sized content, such as registering a document */
  wide?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-h">
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><IconX size={15} /></button>
        </header>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function NotePrompt({ label, description, confirmLabel, danger, onConfirm, onCancel }: {
  label: string; description?: string; confirmLabel: string; danger?: boolean
  onConfirm: (v: string) => void; onCancel: () => void
}) {
  const [v, setV] = useState('')
  return (
    <Modal
      title={label} description={description} onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={!v.trim()} onClick={() => onConfirm(v.trim())}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <textarea className="input" rows={3} value={v} autoFocus onChange={(e) => setV(e.target.value)} />
    </Modal>
  )
}

/**
 * Prerequisite picker — the nested checkbox tree from the reference. Each
 * requirement can be satisfied either by linking a tracked document or by
 * ticking it off manually.
 */
export function PrereqPicker({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { db, setPrereqs, typeOf } = useStore()
  const trail = trailFor(doc.trailCode)
  const reqs = allPrerequisites(doc.trailCode)
  const [linked, setLinked] = useState<string[]>(doc.prereqDocIds)
  const [manual, setManual] = useState<string[]>(doc.prereqManual)

  /** Candidate documents that could satisfy a requirement, by trail code. */
  const candidatesFor = (code: string) =>
    db.docs.filter((d) => d.trailCode === code && d.status === 'COMPLETED' && d.id !== doc.id)

  const codes = trail?.prerequisiteCodes ?? []

  return (
    <Modal
      title="Attach prerequisite documents"
      description={`${trail?.name} requires the documents below before it can be released. Link a tracked document, or tick it off if the copy is on paper only.`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => { setPrereqs(doc.id, linked, manual); onClose() }}>
            <IconCheck size={14} /> Save attachments
          </button>
        </>
      }
    >
      {reqs.length === 0 ? (
        <Empty>This document type has no prerequisites.</Empty>
      ) : (
        <ul className="tree">
          {reqs.map((req, i) => {
            const code = codes[i]
            const cands = code ? candidatesFor(code) : []
            const ticked = manual.includes(req)
            return (
              <li key={req}>
                <label className="ck head">
                  <input
                    type="checkbox" checked={ticked}
                    onChange={(e) => setManual((m) => e.target.checked ? [...m, req] : m.filter((x) => x !== req))}
                  />
                  <span className="tx">
                    {req}
                    {code && <span className="tag">{code}</span>}
                  </span>
                </label>
                {cands.length > 0 && (
                  <ul className="kids">
                    {cands.map((c) => (
                      <li key={c.id}>
                        <label className="ck">
                          <input
                            type="checkbox" checked={linked.includes(c.id)}
                            onChange={(e) => setLinked((l) => e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id))}
                          />
                          <span className="tx">
                            {c.subject}
                            <span className="tag">{c.controlNo}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="note note-quiet" style={{ marginTop: 14, marginBottom: 0 }}>
        Linking a tracked document lets the system show the whole chain — for example, which Purchase Request a
        Disbursement Voucher is paying for.
      </div>
    </Modal>
  )
}

/**
 * Quick look at a document without leaving the queue. The encoder needs to see
 * what they are about to record before recording it — and going out to the full
 * document and back loses their place in a list they are working through.
 */
export function DocPreview({ doc, onClose, onOpenFull }: {
  doc: Doc
  onClose: () => void
  onOpenFull: (id: string) => void
}) {
  const { db, role, userId, advance, returnDoc, hold, resume, submit, typeOf, officeName, lang } = useStore()
  const liaison = db.users.find((u) => u.id === doc.assignedLiaisonId)
  const [pending, setPending] = useState<import('./lib/workflow').Action | null>(null)

  const trail = trailFor(doc.trailCode)
  const type = typeOf(doc)
  const step = currentStep(doc)
  const actions = availableActions(doc, role, userId)
  const prereq = prereqStatus(doc)
  const ok = prereqsMet(doc)
  const refs = doc.externalRefs ?? []
  const days = daysAtCurrentStep(doc)

  function run(a: import('./lib/workflow').Action) {
    if (a.needsNote) { setPending(a); return }
    // Anything needing a photograph of the paper belongs on the full document
    // screen, where the capture dialog lives — not in a quick look.
    if (a.needsProof || a.kind === 'depart' || a.kind === 'handover') { onOpenFull(doc.id); return }
    if (a.kind === 'submit') submit(doc.id)
    else if (a.kind === 'advance' || a.kind === 'release') advance(doc.id)
    else if (a.kind === 'resume') resume(doc.id)
    onClose()
  }

  function runWithNote(a: import('./lib/workflow').Action, v: string) {
    if (a.kind === 'return') returnDoc(doc.id, v)
    else if (a.kind === 'hold') hold(doc.id, v)
    setPending(null)
    onClose()
  }

  if (pending) {
    return (
      <NotePrompt
        label={pending.noteLabel ?? 'Add a note'}
        confirmLabel={pending.label}
        danger={pending.tone === 'danger'}
        onCancel={() => setPending(null)}
        onConfirm={(v) => runWithNote(pending, v)}
      />
    )
  }

  return (
    <Modal
      title={doc.controlNo}
      description={doc.subject}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => { onClose(); onOpenFull(doc.id) }}>Open full document</button>
          <span className="spacer" />
          {actions.map((a) => (
            <button
              key={a.id}
              className={`btn ${a.tone === 'primary' ? 'primary' : a.tone === 'danger' ? 'danger' : ''}`}
              disabled={a.needsPrereqs && !ok}
              title={a.needsPrereqs && !ok ? 'Attach every prerequisite first' : undefined}
              onClick={() => run(a)}
            >
              {a.label}
            </button>
          ))}
          {actions.length === 0 && <button className="btn" onClick={onClose}>Close</button>}
        </>
      }
    >
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <StatusPill doc={doc} />
        <ProgramTag doc={doc} />
        <span className="spacer" />
        <span className={`age ${days > 3 ? 'age-breach' : days > 1 ? 'age-warn' : 'age-ok'}`}>{days}d at this step</span>
      </div>

      {doc.deficiency && <Note tone="crit"><b>Returned:</b> {doc.deficiency}</Note>}

      {step && (
        <Note tone="info">
          <span>
            <b>Step {step.seq} of {trail?.steps.length}</b> — {step.requirement}
            <br />
            <span style={{ opacity: .85 }}>
              {TRAIL_OFFICES[step.officeCode] ?? step.officeCode} · {SIGNATORY_LABEL[step.signatory]}
              {step.days != null && ` · typically ${step.days}d`}
            </span>
          </span>
        </Note>
      )}

      <div style={{ marginBottom: 14 }}>
        <Waffle doc={doc} />
      </div>

      <dl className="kv" style={{ marginBottom: 14 }}>
        <dt>Type</dt><dd>{trail?.name}{trail?.variant ? ` — ${trail.variant}` : ''}</dd>
        <dt>Held by</dt><dd>{doc.currentHolderName ?? officeName(doc.currentOfficeId)}</dd>
        <dt>Liaison responsible</dt>
        <dd>
          {liaison
            ? <>{liaison.name}<div className="sub">{assignmentReason(liaison, doc)}</div></>
            : <span className="muted">not assigned</span>}
        </dd>
        {doc.amount != null && <><dt>Amount</dt><dd className="mono">₱{doc.amount.toLocaleString()}</dd></>}
        <dt>Reference numbers</dt>
        <dd>
          {refs.length === 0
            ? <span className="muted">none recorded{trail?.refNumberOrigin ? ` — expected from ${TRAIL_OFFICES[trail.refNumberOrigin] ?? trail.refNumberOrigin}` : ''}</span>
            : refs.map((r) => <div key={r.id} className="mono">{r.number} <span className="muted">· {r.label}</span></div>)}
        </dd>
        <dt>Captured pages</dt>
        <dd>{doc.files.length === 0 ? <span className="muted">none</span> : `${doc.files.length} page${doc.files.length === 1 ? '' : 's'}`}</dd>
      </dl>

      {Object.entries(doc.fields).filter(([, v]) => v).length > 0 && (
        <>
          <h3 style={{ marginBottom: 7 }}>Details</h3>
          <dl className="kv" style={{ marginBottom: 14 }}>
            {Object.entries(doc.fields).filter(([, v]) => v).map(([k, v]) => {
              const f = type?.fields.find((x) => x.key === k)
              return (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{f ? (lang === 'fil' ? f.labelFil : f.labelEn) : EXTRA_FIELD_LABELS[k] ?? k}</dt>
                  <dd>{v}</dd>
                </div>
              )
            })}
          </dl>
        </>
      )}

      {prereq.total > 0 && (
        <>
          <h3 style={{ marginBottom: 7 }}>
            Prerequisites <span className={`pill ${ok ? 'pill-ok' : 'pill-warn'}`}>{prereq.met}/{prereq.total}</span>
          </h3>
          <ul className="trail" style={{ marginBottom: 4 }}>
            {allPrerequisites(doc.trailCode).map((p) => {
              const ticked = doc.prereqManual.includes(p)
              return (
                <li key={p} className={ticked ? 'done' : 'pending'}>
                  <span className="n">{ticked ? '✓' : '·'}</span>
                  <div><div className="what">{p}</div></div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {(doc.pokes ?? []).length > 0 && (
        <Note tone="warn">
          <b>{doc.pokes.length} follow-up{doc.pokes.length === 1 ? '' : 's'}</b> waiting —
          most recent: "{doc.pokes[doc.pokes.length - 1].note}" ({doc.pokes[doc.pokes.length - 1].by})
        </Note>
      )}
    </Modal>
  )
}

/**
 * Proof of custody.
 *
 * The office's rule for anything outside its walls: a liaison never updates a
 * document on their word alone. Every hand-over and every signature is recorded
 * with a photograph of the paper showing the RECEIVED stamp, sticker or note.
 * The file and the status change are written together, so a document cannot end
 * up marked received with nothing to show for it.
 */
export function ProofPrompt({ title, description, doc, askName, askRefNumber, confirmLabel, onClose, onConfirm }: {
  title: string
  description: string
  doc: Doc
  /** when set, also collect who at the receiving office signed for it */
  askName?: string
  /** when set, also collect the outside reference number this step produces —
   *  the label names the office, since that is what the liaison actually sees
   *  written on the paper. A step out in the field can need both a photo and
   *  this number in the same motion, so one prompt collects both rather than
   *  risking a second one silently skipping the photo. */
  askRefNumber?: string
  confirmLabel: string
  onClose: () => void
  onConfirm: (fileName: string, receivedBy: string, thumb: string | undefined, refNumber: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [thumb, setThumb] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [refNumber, setRefNumber] = useState('')
  const ready = file !== null && (!askName || name.trim() !== '') && (!askRefNumber || refNumber.trim() !== '')

  async function pick(f: File | null) {
    setFile(f)
    setThumb(f ? await makeThumb(f) : undefined)
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!ready} onClick={() => onConfirm(file!.name, name.trim(), thumb, refNumber.trim())}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <Note tone="quiet">
        <b className="mono">{doc.controlNo}</b> — {doc.subject}
      </Note>

      {askName && (
        <div className="field">
          <label htmlFor="proof-name">{askName} <span className="req">*</span></label>
          <input
            id="proof-name" className="input" autoFocus value={name}
            onChange={(e) => setName(e.target.value)} placeholder="e.g. Mila R."
          />
        </div>
      )}

      {askRefNumber && (
        <div className="field">
          <label htmlFor="proof-ref">{askRefNumber} <span className="req">*</span></label>
          <input
            id="proof-ref" className="input mono" autoFocus={!askName} value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)} placeholder="As written on the paper"
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="proof-file">
          Photo of the document marked RECEIVED <span className="req">*</span>
        </label>
        {file ? (
          <Note tone="quiet">
            {thumb && <img src={thumb} alt="" className="proof-thumb" />}
            <IconCamera size={14} /> <b className="mono">{file.name}</b>{' '}
            <span className="muted">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
            {' '}<button className="btn sm ghost" onClick={() => pick(null)}>Choose another</button>
          </Note>
        ) : (
          <>
            <input
              id="proof-file" className="input" type="file" accept="image/*,application/pdf" capture="environment"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <div className="sub" style={{ marginTop: 6 }}>
              The stamp, sticker or the word RECEIVED written on the paper must be legible. This is
              what proves the document changed hands.
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/**
 * The liaison's notifications.
 *
 * Two things reach a liaison out in the field: a coordinator chasing a document
 * she is carrying, and a new assignment landing in her load. Both belong in one
 * place she can check from a phone, rather than being discovered by scrolling.
 * A follow-up clears when she updates the document — the same act that answers
 * the coordinator's question.
 */
export function Notifications({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, userId, isUntouched, isUnseen } = useStore()
  const [open, setOpen] = useState(false)

  const mine = liaisonLoad(db.docs, userId)
  // A new assignment clears here as soon as it's opened — that's what a
  // notification is. My load's own NEW tag is a different signal (it wants
  // acted on, not just looked at) and keeps using isUntouched.
  const assigned = mine.filter(isUnseen)
  const followUps = mine
    .flatMap((d) => (d.pokes ?? []).map((p) => ({ doc: d, poke: p })))
    .filter(({ doc }) => isUntouched(doc))
    .sort((a, b) => (a.poke.at < b.poke.at ? 1 : -1))

  const count = assigned.length + followUps.length

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div className="notif" onClick={(e) => e.stopPropagation()}>
      <button
        className={`notif-btn${count ? ' has' : ''}`} onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count ? ` — ${count} unread` : ''}`}
      >
        <IconBell size={16} />
        {count > 0 && <span className="notif-dot">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-h">
            <b>Notifications</b>
            <span className="sub">{count === 0 ? 'Nothing new' : `${count} waiting`}</span>
          </div>

          {followUps.length > 0 && (
            <div className="notif-group">
              <h4>Follow-ups</h4>
              {followUps.map(({ doc, poke }) => (
                <button key={poke.id} className="notif-item" onClick={() => { setOpen(false); onOpen(doc.id) }}>
                  <span className="notif-ico warn"><IconAlert size={13} /></span>
                  <span className="notif-tx">
                    <b>{poke.by}</b> is following up
                    <span className="sub">{poke.note}</span>
                    <span className="sub mono">{doc.controlNo} · {poke.at}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {assigned.length > 0 && (
            <div className="notif-group">
              <h4>Newly assigned to you</h4>
              {assigned.map((d) => (
                <button key={d.id} className="notif-item" onClick={() => { setOpen(false); onOpen(d.id) }}>
                  <span className="notif-ico"><IconTruck size={13} /></span>
                  <span className="notif-tx">
                    <b>{d.subject}</b>
                    <span className="sub">{statusPhrase(d).en}</span>
                    <span className="sub mono">{d.controlNo}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {count === 0 && (
            <div className="notif-empty">
              Nothing waiting. New assignments and follow-ups appear here.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A dropdown whose rows carry two weights — a bold code and a regular name —
 * which a native `<select>` cannot render (option text is always one plain
 * string; there is no way to bold part of it). Built only where that
 * distinction was actually asked for, not as a blanket replacement for
 * ordinary selects.
 */
export function RichSelect({ id, value, options, onChange, placeholder }: {
  id?: string
  value: string
  options: { value: string; code: string; name: string }[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="rselect" ref={ref}>
      <button
        id={id} type="button" className="rselect-trigger"
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rselect-val">
          {current ? <><b>{current.code}</b> — {current.name}</> : <span className="muted">{placeholder ?? 'Select…'}</span>}
        </span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="rselect-panel" role="listbox">
          {options.map((o) => (
            <button
              key={o.value} type="button" role="option" aria-selected={o.value === value}
              className={`rselect-opt${o.value === value ? ' on' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              <b>{o.code}</b> — {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
