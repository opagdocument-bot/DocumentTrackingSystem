import { useEffect, useState } from 'react'
import { AgeCell, Card, Empty, Modal, Note, NotePrompt, PrereqPicker, ProgramTag, ProofPrompt, StatusPill, Waffle, WaffleLegend } from '../components'
import { useStore } from '../store'
import {
  DIRECTIVE_LABEL, SIGNATORY_LABEL, STATUS_LABEL, TRAIL_OFFICES,
  allPrerequisites, assignmentReason, availableActions, can, currentStep, custodyOf, daysAtCurrentStep, expectedDays, isOpen,
  eventPhrase, nextMover, needsRefNumberNow, prereqStatus, prereqsMet, stepState, stepsOf, trailFor, updaterFor,
} from '../lib/workflow'
import type { Action } from '../lib/workflow'
import { EXTRA_FIELD_LABELS } from '../data/seed'
import type { Doc, ExternalRef } from '../types'
import { IconCamera, IconChevronRight, IconPaperclip } from '../icons'

type Tab = 'trail' | 'details' | 'attachments' | 'history'

export function DocumentDetail({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { db, role, userId, typeOf, officeName, advance, returnDoc, hold, resume, submit, receive, addFile, poke, cancelDoc, addExternalRef, assignLiaison, depart, markSeen, lang } = useStore()
  const [tab, setTab] = useState<Tab>('trail')
  const [pending, setPending] = useState<Action | null>(null)
  const [picking, setPicking] = useState(false)
  const [poking, setPoking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [askingRef, setAskingRef] = useState(false)
  const [handingOver, setHandingOver] = useState(false)
  const [proving, setProving] = useState<Action | null>(null)

  // Opening the document is what clears its "new" tag on the PA's table.
  useEffect(() => { markSeen(id) }, [id, markSeen])

  const doc = db.docs.find((d) => d.id === id)
  if (!doc) return <div className="body"><Empty>Document not found. <button className="btn sm" onClick={onBack}>Back</button></Empty></div>

  const trail = trailFor(doc.trailCode)
  const type = typeOf(doc)
  const steps = stepsOf(doc)
  const step = currentStep(doc)
  const actions = availableActions(doc, role, userId)
  const prereq = prereqStatus(doc)
  const ok = prereqsMet(doc)
  // The outside number has to be written down before the document moves on.
  const refBlocked = needsRefNumberNow(doc)
  const follows = doc.followsId ? db.docs.find((d) => d.id === doc.followsId) : null
  const linked = db.docs.filter((d) => doc.prereqDocIds.includes(d.id))

  function run(a: Action) {
    if (a.kind === 'handover') { setHandingOver(true); return }
    // Outside the office, nothing moves without a photograph of the paper — and
    // a step that also produces the outside reference number asks for both at
    // once (see ProofPrompt's askRefNumber), rather than risking a second,
    // separate prompt that would skip the photo entirely.
    if (a.needsProof) { setProving(a); return }
    // The outside number is captured as part of the recording, not before it.
    if (a.needsRef && refBlocked) { setAskingRef(true); return }
    if (a.needsNote) { setPending(a); return }
    if (a.kind === 'depart') return depart(doc!.id)
    if (a.kind === 'submit') return submit(doc!.id)
    if (a.kind === 'advance') return advance(doc!.id)
    if (a.kind === 'resume') return resume(doc!.id)
    if (a.kind === 'release') return advance(doc!.id)
  }

  function runWithNote(a: Action, v: string) {
    if (a.kind === 'return') returnDoc(doc!.id, v)
    else if (a.kind === 'hold') hold(doc!.id, v)
    setPending(null)
  }

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div style={{ minWidth: 0 }}>
            <button className="btn sm ghost" onClick={onBack} style={{ marginBottom: 6 }}>← Back</button>
            <h1 className="mono" style={{ fontSize: 20 }}>{doc.controlNo}</h1>
            <div className="head-sub">{doc.subject}</div>
          </div>
          <span className="spacer" />
          <div className="row" style={{ gap: 7 }}>
            <StatusPill doc={doc} />
            {actions.map((a) => (
              <button
                key={a.id}
                className={`btn ${a.tone === 'primary' ? 'primary' : a.tone === 'danger' ? 'danger' : ''}`}
                disabled={a.needsPrereqs && !ok}
                title={
                  a.needsPrereqs && !ok ? 'Attach every prerequisite first'
                  : a.needsRef && refBlocked ? 'You will be asked for the number this document came back with'
                  : undefined
                }
                onClick={() => run(a)}
              >
                {a.label}
              </button>
            ))}
            {can(role, 'cancel', doc, userId) && (
              <button className="btn danger" onClick={() => setCancelling(true)}>Cancel document</button>
            )}
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Type</div><div className="m-v" style={{ fontSize: 14 }}>{trail?.name}{trail?.variant ? ` — ${trail.variant}` : ''}</div></div>
          <div className="metric"><div className="m-l">Program</div><div className="m-v" style={{ fontSize: 14 }}><ProgramTag doc={doc} /></div></div>
          <div className="metric"><div className="m-l">Current step</div><div className="m-v" style={{ fontSize: 14 }}>{step ? `${step.seq} of ${steps.length}` : 'Complete'}</div></div>
          <div className="metric"><div className="m-l">Age</div><div className="m-v" style={{ fontSize: 14 }}><AgeCell doc={doc} /> <small>of {expectedDays(doc)}d expected</small></div></div>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'trail' ? 'on' : ''} onClick={() => setTab('trail')}>Trail <span className="n">{steps.length}</span></button>
        <button className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Details</button>
        <button className={tab === 'attachments' ? 'on' : ''} onClick={() => setTab('attachments')}>
          Prerequisites <span className="n">{prereq.met}/{prereq.total}</span>
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History <span className="n">{doc.events.length}</span></button>
      </div>

      {askingRef && trail?.refNumberOrigin && (
        <RefPrompt
          doc={doc} origin={trail.refNumberOrigin}
          onClose={() => setAskingRef(false)}
          onConfirm={(number) => {
            addExternalRef(doc.id, {
              officeCode: trail.refNumberOrigin!,
              label: `${trail.name} number`,
              number,
            })
            advance(doc.id)
            setAskingRef(false)
          }}
        />
      )}

      {proving && (
        <ProofPrompt
          doc={doc}
          title={proving.label}
          description="Recorded from the field. The photograph is filed with the document as proof it changed hands."
          askName={proving.kind === 'receive' ? 'Received by (name)' : undefined}
          askRefNumber={
            proving.needsRef && refBlocked && trail?.refNumberOrigin
              ? `${trail.name} number, from ${TRAIL_OFFICES[trail.refNumberOrigin] ?? trail.refNumberOrigin}`
              : undefined
          }
          confirmLabel="Record it"
          onClose={() => setProving(null)}
          onConfirm={(fileName, receivedBy, thumb, refNumber) => {
            if (refNumber && trail?.refNumberOrigin) {
              addExternalRef(doc.id, { officeCode: trail.refNumberOrigin, label: `${trail.name} number`, number: refNumber })
            }
            if (proving.kind === 'receive') receive(doc.id, receivedBy, fileName, thumb)
            else advance(doc.id, undefined, fileName, thumb)
            setProving(null)
          }}
        />
      )}

      {handingOver && (
        <HandoverPrompt
          doc={doc}
          onClose={() => setHandingOver(false)}
          onConfirm={(id) => { assignLiaison(doc.id, id); advance(doc.id); setHandingOver(false) }}
        />
      )}

      {cancelling && (
        <CancelPrompt doc={doc} onClose={() => setCancelling(false)}
          onConfirm={(reason, file) => { cancelDoc(doc.id, reason, file.name); setCancelling(false) }} />
      )}

      <div className="body">
        {doc.deficiency && <Note tone="crit"><b>Returned:</b> {doc.deficiency}</Note>}
        {refBlocked && (
          <Note tone="warn">
            <b>Reference number needed.</b> This document has been to{' '}
            <b>{TRAIL_OFFICES[trail?.refNumberOrigin ?? ''] ?? trail?.refNumberOrigin}</b>, which issues its
            number. Record that number under <b>Details</b> before the document goes any further — it cannot
            reach the Provincial Agriculturist without it.
          </Note>
        )}
        {doc.status === 'CANCELLED' && (
          <Note tone="crit">
            <b>Cancelled{doc.completedAt ? ` on ${doc.completedAt}` : ''}:</b> {doc.cancelReason ?? 'no reason recorded'}
            {doc.files.some((f) => f.pageRole === 'cancelled') && ' — the stamped paper is under Prerequisites.'}
          </Note>
        )}

        {/* Who owns this document right now, and what that means for you. */}
        {isOpen(doc) && (
          <Note tone={role === updaterFor(doc) ? 'info' : 'quiet'}>
            {custodyOf(doc) === 'office'
              ? <>This document is <b>inside the office</b>, so the <b>Encoder</b> updates it — including recording the Provincial Agriculturist's signature.</>
              : <>This document is <b>out of the office</b>, so <b>{nextMover(doc, db.users)}</b> updates it.</>}
            {role === 'pa' && ' You have oversight here; the Encoder records your signature once you have signed.'}
            {role === 'viewer' && ' You can follow up with the handler using the button above.'}
          </Note>
        )}

        {can(role, 'poke', doc, userId) && (
          <div style={{ marginBottom: 14 }}>
            <button className="btn primary" onClick={() => setPoking(true)}>Follow up with the handler</button>
            {(doc.pokes ?? []).length > 0 && (
              <span className="sub" style={{ marginLeft: 10 }}>
                {doc.pokes.length} follow-up{doc.pokes.length === 1 ? '' : 's'} already raised
              </span>
            )}
          </div>
        )}

        {(doc.pokes ?? []).length > 0 && role !== 'viewer' && (
          <Note tone="warn">
            <b>{doc.pokes.length} follow-up{doc.pokes.length === 1 ? '' : 's'}</b> from staff waiting on this
            document. Most recent: "{doc.pokes[doc.pokes.length - 1].note}" — {doc.pokes[doc.pokes.length - 1].by}
          </Note>
        )}
        {!ok && doc.status === 'DRAFT' && (
          <Note tone="warn">
            {prereq.total - prereq.met} of {prereq.total} prerequisites still missing. The document cannot be
            submitted until they are attached.
          </Note>
        )}

        {tab === 'trail' && (
          <Card
            title="Document trail"
            subtitle={`${trail?.name} · ${steps.length} steps · reference number from ${trail?.refNumberOrigin ? TRAIL_OFFICES[trail.refNumberOrigin] ?? trail.refNumberOrigin : 'not issued'}`}
          >
            {trail?.ownedByOpag === false && (
              <Note tone="quiet">
                This document is handled entirely inside the {TRAIL_OFFICES[trail.originOffice] ?? trail.originOffice}.
                OPAg records that it was requested and that it came back — there are no intermediate steps for this
                office to update.
              </Note>
            )}
            <div style={{ marginBottom: 14 }}>
              <Waffle doc={doc} />
              <WaffleLegend />
            </div>

            <Note tone="quiet">
              Each step shows <b>who it is for</b> — the office and the person who signs or acts — and, once done,
              <b> who recorded it</b> in the system. Those are usually different people: the Provincial Agriculturist
              signs on paper, and the Encoder logs it.
            </Note>
            <ul className="trail">
              {steps.map((s) => {
                const st = stepState(doc, s)
                const log = doc.stepLog.find((l) => l.seq === s.seq)
                return (
                  <li key={s.seq} className={`${st}${s.isCheckpoint ? ' checkpoint' : ''}`}>
                    <span className="n">{s.seq}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="what">{s.requirement}</div>
                      <div className="meta">
                        <span>{TRAIL_OFFICES[s.officeCode] ?? s.officeCode}</span>
                        <span>·</span>
                        <span>{SIGNATORY_LABEL[s.signatory]}</span>
                        {s.isCheckpoint && <span className="pill pill-accent">PA checkpoint</span>}
                        {log && (
                          <span title="The person who logged this step in the system, not necessarily the one who signed">
                            · recorded by {log.actorName}, {log.at}
                          </span>
                        )}
                      </div>
                      {log?.note && <div className="sub" style={{ marginTop: 3 }}>{log.note}</div>}
                    </div>
                    <div className="rt">
                      <div className="mono">{s.days != null ? `${s.days}d` : '—'}</div>
                      {st === 'current' && (
                        <span className="pill pill-accent" style={{ marginTop: 4 }}>{daysAtCurrentStep(doc)}d here</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {tab === 'details' && (
          <>
          <LiaisonCard doc={doc} />
          <ExternalRefs doc={doc} />
          <div className="grid-2">
            <Card title="Document">
              <dl className="kv">
                <dt>Control number</dt><dd className="mono">{doc.controlNo}</dd>
                <dt>Reference number</dt>
                <dd className="mono">
                  {doc.refNumber ?? <span className="muted">not yet issued</span>}
                  {trail?.refNumberOrigin && (
                    <div className="sub">
                      {trail.refNumberOrigin === 'OPAG'
                        ? 'issued by this office on registration'
                        : `issued by ${TRAIL_OFFICES[trail.refNumberOrigin] ?? trail.refNumberOrigin}`}
                    </div>
                  )}
                </dd>
                <dt>DRS number</dt><dd className="mono">{doc.drsNo ?? <span className="muted">—</span>}</dd>
                <dt>Tracking code</dt><dd className="mono">{doc.trackingCode}</dd>
                <dt>Registered</dt><dd className="mono">{doc.createdAt}</dd>
                <dt>Held by</dt><dd>{doc.currentHolderName ?? officeName(doc.currentOfficeId)}</dd>
                {doc.amount != null && <><dt>Amount</dt><dd className="mono">₱{doc.amount.toLocaleString()}</dd></>}
                {doc.directive && <><dt>Directive</dt><dd>{DIRECTIVE_LABEL[doc.directive]}</dd></>}
                <dt>Final product</dt><dd>{trail?.finalProduct ?? <span className="muted">—</span>}</dd>
              </dl>
            </Card>
            <Card title={`${trail?.name} fields`}>
              <dl className="kv">
                {Object.entries(doc.fields).filter(([, v]) => v).map(([k, v]) => {
                  const f = type?.fields.find((x) => x.key === k)
                  return (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{f ? (lang === 'fil' ? f.labelFil : f.labelEn) : EXTRA_FIELD_LABELS[k] ?? k}</dt>
                      <dd>{v}{f?.optionLabels?.[v] && <span className="muted"> — {f.optionLabels[v]}</span>}</dd>
                    </div>
                  )
                })}
              </dl>
              {Object.values(doc.fields).filter(Boolean).length === 0 && <Empty>No details recorded.</Empty>}
            </Card>
          </div>
          </>
        )}

        {tab === 'attachments' && (
          <>
            <Card
              title="Prerequisite documents"
              subtitle={`${prereq.met} of ${prereq.total} attached`}
              action={can(role, 'edit_prereqs', doc, userId)
                ? <button className="btn sm primary" onClick={() => setPicking(true)}><IconPaperclip size={13} /> Manage</button>
                : undefined}
            >
              {prereq.total === 0 ? <Empty>This document type has no prerequisites.</Empty> : (
                <ul className="trail">
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
              )}
              {linked.length > 0 && (
                <>
                  <h3 style={{ margin: '16px 0 8px' }}>Linked documents</h3>
                  <ul className="trail">
                    {linked.map((l) => (
                      <li key={l.id} className="done" style={{ cursor: 'pointer' }} onClick={() => onOpen(l.id)}>
                        <span className="n">→</span>
                        <div>
                          <div className="what">{l.subject}</div>
                          <div className="meta"><span className="mono">{l.controlNo}</span></div>
                        </div>
                        <div className="rt"><IconChevronRight size={14} /></div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {follows && (
                <Note tone="quiet">
                  Reports on <a href="#" onClick={(e) => { e.preventDefault(); onOpen(follows.id) }}>{follows.controlNo}</a> — {follows.subject}
                </Note>
              )}
            </Card>

            <Card
              title="Captured pages"
              subtitle={type?.captureProfile === 'signatory' ? 'Front page and signature page' : 'Front page only'}
              action={can(role, 'capture', doc, userId) ? (
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => addFile(doc.id, 'front')}><IconCamera size={13} /> Front</button>
                  {type?.captureProfile === 'signatory' && (
                    <button className="btn sm" onClick={() => addFile(doc.id, 'last')}><IconCamera size={13} /> Signature page</button>
                  )}
                </div>
              ) : undefined}
              flush
            >
              {doc.files.length === 0 ? <Empty>Nothing captured yet.</Empty> : (
                <div className="tw">
                  <table>
                    <thead><tr><th>File</th><th>Page</th><th className="right">Size</th><th>Captured</th></tr></thead>
                    <tbody>
                      {doc.files.map((f) => (
                        <tr key={f.id}>
                          <td className="mono">{f.name}</td>
                          <td>{f.pageRole}</td>
                          <td className="right mono">{f.sizeKb} KB</td>
                          <td className="mono muted">{f.capturedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {type?.captureProfile === 'signatory' && doc.files.length > 0 && !doc.files.some((f) => f.pageRole === 'last') && (
                <div style={{ padding: 14 }}><Note tone="crit">Signature page missing — detected by query, not by anyone noticing.</Note></div>
              )}
            </Card>
          </>
        )}

        {tab === 'history' && (
          <Card title="Audit trail" subtitle="Append-only — nothing here can be edited or deleted">
            <ul className="trail">
              {[...doc.events].reverse().map((e) => (
                <li key={e.id} className="done">
                  <span className="n">·</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="what"><b>{eventPhrase(doc, e)}</b></div>
                    <div className="meta">
                      <span>{e.actorName}</span><span>·</span><span className="mono">{e.at}</span><span>·</span><span>{e.source}</span>
                      {e.stepSeq && <span className="pill pill-neutral">step {e.stepSeq}</span>}
                    </div>
                    {e.note && <div className="sub" style={{ marginTop: 3 }}>{e.note}</div>}
                    {(() => {
                      // The photograph the liaison took, shown where it proves something.
                      const f = e.fileId ? doc.files.find((x) => x.id === e.fileId) : undefined
                      if (!f) return null
                      return (
                        <div className="proof">
                          {f.thumb
                            ? <img src={f.thumb} alt={`Page captured on ${f.capturedAt}`} />
                            : <span className="proof-none"><IconCamera size={13} /></span>}
                          <span className="sub mono">{f.name}</span>
                        </div>
                      )
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {picking && <PrereqPicker doc={doc} onClose={() => setPicking(false)} />}
      {poking && (
        <NotePrompt
          label="Follow up on this document"
          description={'This will notify ' + nextMover(doc, db.users) + ' that you are waiting on it.'}
          confirmLabel="Send follow-up"
          onCancel={() => setPoking(false)}
          onConfirm={(v) => { poke(doc.id, v); setPoking(false) }}
        />
      )}
      {pending && (
        <NotePrompt
          label={pending.noteLabel ?? 'Add a note'}
          confirmLabel={pending.label}
          danger={pending.tone === 'danger'}
          onCancel={() => setPending(null)}
          onConfirm={(v) => runWithNote(pending, v)}
        />
      )}
    </>
  )
}

/**
 * Numbers assigned outside OPAg. The process map shows PR numbers come from
 * the BAC, OBR numbers from the Budget Office, Travel Orders from the
 * Governor's Office — so the office needs somewhere to record a number it did
 * not issue, as it is assigned.
 */
function ExternalRefs({ doc }: { doc: Doc }) {
  const { role, userId, addExternalRef, removeExternalRef } = useStore()
  const editable = can(role, 'edit_refs', doc, userId)
  const [adding, setAdding] = useState(false)
  const [officeCode, setOfficeCode] = useState('')
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')

  const trail = trailFor(doc.trailCode)
  const refs = doc.externalRefs ?? []
  // A number this office issues itself is generated at registration, so it is
  // never something the Encoder has to chase. Only outside offices are "expected".
  const own = trail?.refNumberOrigin === 'OPAG'
  const expected = own ? null : trail?.refNumberOrigin

  function reset() { setAdding(false); setOfficeCode(''); setLabel(''); setNumber('') }

  function save() {
    if (!number.trim()) return
    addExternalRef(doc.id, {
      officeCode: officeCode || expected || 'OPAG',
      label: label.trim() || 'Reference number',
      number: number.trim(),
    })
    reset()
  }

  return (
    <Card
      title="Reference numbers issued elsewhere"
      subtitle={own
        ? 'This office issues this number itself — the system assigned it on registration'
        : expected
          ? `This document type is numbered by ${TRAIL_OFFICES[expected] ?? expected}`
          : 'No external office issues a number for this type'}
      action={editable && !adding
        ? <button className="btn sm primary" onClick={() => { setAdding(true); setOfficeCode(expected ?? ''); }}>+ Record a number</button>
        : undefined}
    >
      {refs.length === 0 && !adding && (
        <Note tone={needsRefNumberNow(doc) ? 'crit' : expected && editable ? 'warn' : 'quiet'}>
          {own
            ? <>This document carries <b className="mono">{doc.refNumber}</b>, issued by this office when it was registered. Nothing to chase — but if another office assigns it a number later, record that here.</>
            : !editable
            ? <>No number recorded yet.{expected && <> It is assigned by <b>{TRAIL_OFFICES[expected] ?? expected}</b>, and the Encoder records it here.</>}</>
            : expected
              ? <>No number recorded yet. It is assigned by <b>{TRAIL_OFFICES[expected] ?? expected}</b> — record it here as soon as the office issues it, so the document can be found by that number too.</>
              : <>Nothing to record. Numbers can still be added here if another office assigns one.</>}
        </Note>
      )}

      {refs.length > 0 && (
        <div className="tw" style={{ marginBottom: adding ? 14 : 0 }}>
          <table>
            <thead><tr><th>Number</th><th>Label</th><th>Issued by</th><th>Recorded</th><th></th></tr></thead>
            <tbody>
              {refs.map((r: ExternalRef) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.number}</td>
                  <td>{r.label}</td>
                  <td className="muted">{TRAIL_OFFICES[r.officeCode] ?? r.officeCode}</td>
                  <td className="muted mono">{r.issuedAt} · {r.recordedBy}</td>
                  <td className="right">
                    {editable && (
                      <button className="btn sm ghost" onClick={() => removeExternalRef(doc.id, r.id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="grid2" style={{ alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="ro">Issued by</label>
            <select id="ro" className="input" value={officeCode} onChange={(e) => setOfficeCode(e.target.value)}>
              <option value="">— select office —</option>
              {Object.entries(TRAIL_OFFICES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rl">What kind of number</label>
            <input id="rl" className="input" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. PR Number, OBR Number, PO Number" />
          </div>
          <div className="field">
            <label htmlFor="rn">Number <span className="req">*</span></label>
            <input id="rn" className="input mono" value={number} autoFocus
              onChange={(e) => setNumber(e.target.value)} placeholder="as written on the document" />
          </div>
          <div className="field">
            <div className="row">
              <button className="btn primary" disabled={!number.trim()} onClick={save}>Save number</button>
              <button className="btn" onClick={reset}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * Who carries this document once it leaves the office. Liaisons are assigned by
 * document type — and for Purchase Requests, by class of goods — so the reason
 * is shown alongside the name. Encoders can reassign, because the office's user
 * matrix allows for "other documents that may be assigned".
 */
function LiaisonCard({ doc }: { doc: Doc }) {
  const { db, role, userId, assignLiaison } = useStore()
  const [editing, setEditing] = useState(false)

  const liaisons = db.users.filter((u) => u.roles.includes('liaison'))
  const assigned = liaisons.find((u) => u.id === doc.assignedLiaisonId)
  const editable = can(role, 'assign', doc, userId)
  const inField = custodyOf(doc) === 'field'

  return (
    <Card
      title="Liaison responsible"
      subtitle="Who carries this document and updates it once it is out of the office"
      action={editable && !editing
        ? <button className="btn sm" onClick={() => setEditing(true)}>Reassign</button>
        : undefined}
    >
      {!assigned ? (
        <Note tone="warn">
          No liaison assigned. Nobody is responsible for this document once it leaves the office.
        </Note>
      ) : (
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="who-av">{assigned.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{assigned.name}</div>
            <div className="sub">{assigned.position}</div>
            <div className="sub" style={{ marginTop: 3 }}>{assignmentReason(assigned, doc)}</div>
          </div>
          <span className={`pill ${inField ? 'pill-accent' : 'pill-neutral'}`}>
            {inField ? 'Holding it now' : 'Not currently holding it'}
          </span>
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label htmlFor="reassign">Hand this document to</label>
            <select
              id="reassign" className="input"
              defaultValue={doc.assignedLiaisonId ?? ''}
              onChange={(e) => { if (e.target.value) { assignLiaison(doc.id, e.target.value); setEditing(false) } }}
            >
              <option value="">— select a liaison —</option>
              {liaisons.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.assignment?.trailCodes.length ? ` — ${u.assignment.trailCodes.join(', ')}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}
    </Card>
  )
}

/**
 * Cancelling a disapproved document.
 *
 * The office's rule is that a cancellation is only valid with two things: the
 * reason it was cancelled, and a photograph of the paper stamped CANCELLED.
 * Both are required here, and `cancelDoc` writes them in the same update as the
 * status — so the registry can never hold a cancelled document whose evidence
 * is missing. Only the Encoder ever sees this dialog; `can(role, 'cancel', …)`
 * is what puts the button on screen.
 */
function CancelPrompt({ doc, onClose, onConfirm }: {
  doc: Doc; onClose: () => void; onConfirm: (reason: string, file: File) => void
}) {
  const [reason, setReason] = useState('')
  // A real file must be chosen. The earlier button confirmed itself on click,
  // which let a document be cancelled with no supporting paper at all.
  const [file, setFile] = useState<File | null>(null)
  const ready = reason.trim().length >= 5 && file !== null

  return (
    <Modal
      title="Cancel this document"
      description="A cancellation is permanent. It closes the document and takes it out of every queue."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Keep the document</button>
          <button className="btn danger" disabled={!ready} onClick={() => onConfirm(reason.trim(), file!)}>
            Cancel document
          </button>
        </>
      }
    >
      <Note tone="warn">
        <b>{doc.controlNo}</b> will be closed as cancelled. Both the reason and a photo of the
        stamped paper are required before this can be confirmed.
      </Note>

      <div className="field">
        <label htmlFor="creason">1 · Why is it being cancelled? <span className="req">*</span></label>
        <textarea
          id="creason" className="input" rows={3} autoFocus value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Disapproved by the Provincial Administrator — activity was moved to the next quarter"
        />
        {reason.trim().length > 0 && reason.trim().length < 5 && (
          <div className="sub">Write the actual reason — this is what the office will see in the registry.</div>
        )}
      </div>

      <div className="field">
        <label htmlFor="cfile">2 · Photo or PDF of the paper marked CANCELLED <span className="req">*</span></label>
        {file ? (
          <Note tone="quiet">
            <IconCamera size={14} /> <b className="mono">{file.name}</b>{' '}
            <span className="muted">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
            {' '}<button className="btn sm ghost" onClick={() => setFile(null)}>Choose another</button>
          </Note>
        ) : (
          <>
            <input
              id="cfile" className="input" type="file" accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="sub" style={{ marginTop: 6 }}>
              Write CANCELLED across the face of the document first, then photograph or scan it. The file is
              filed with the document as proof the paper itself was voided.
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/**
 * The number an outside office wrote on the document, captured as part of
 * recording that the document came back — not as a separate errand afterwards.
 */
function RefPrompt({ doc, origin, onClose, onConfirm }: {
  doc: Doc; origin: string; onClose: () => void; onConfirm: (number: string) => void
}) {
  const [number, setNumber] = useState('')
  const office = TRAIL_OFFICES[origin] ?? origin
  const trail = trailFor(doc.trailCode)

  return (
    <Modal
      title={`${trail?.name} number from ${office}`}
      description="This number is issued outside OPAg. Record it now, with the receipt — the document cannot go to the Provincial Agriculturist without it."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!number.trim()} onClick={() => onConfirm(number.trim())}>
            Record and continue
          </button>
        </>
      }
    >
      <Note tone="quiet">
        <b className="mono">{doc.controlNo}</b> is this office's own number. The one below is the number{' '}
        <b>{office}</b> assigned, as written on the paper.
      </Note>
      <div className="field">
        <label htmlFor="refno">Number from {office} <span className="req">*</span></label>
        <input
          id="refno" className="input mono" autoFocus value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Copy it exactly as written on the document"
        />
      </div>
    </Modal>
  )
}

/**
 * Naming the liaison who carries the document out. The assignment matrix
 * proposes one; the encoder can send it with somebody else.
 */
function HandoverPrompt({ doc, onClose, onConfirm }: {
  doc: Doc; onClose: () => void; onConfirm: (liaisonId: string) => void
}) {
  const { db, officeName } = useStore()
  const liaisons = db.users.filter((u) => u.roles[0] === 'liaison')
  const [picked, setPicked] = useState(doc.assignedLiaisonId ?? liaisons[0]?.id ?? '')
  const step = currentStep(doc)

  return (
    <Modal
      title="Hand to a liaison"
      description="The document is leaving the office. Whoever you name here carries it, and is responsible for updating it until it comes back."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!picked} onClick={() => onConfirm(picked)}>
            Hand over
          </button>
        </>
      }
    >
      <Note tone="quiet">
        Bound for <b>{step ? TRAIL_OFFICES[step.officeCode] ?? step.officeCode : officeName(doc.currentOfficeId)}</b>
        {step ? <> — {step.requirement}</> : null}
      </Note>
      <div className="field">
        <label htmlFor="carrier2">Carried by <span className="req">*</span></label>
        <select id="carrier2" className="input" value={picked} onChange={(e) => setPicked(e.target.value)}>
          {liaisons.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}{doc.assignedLiaisonId === u.id ? ' — currently assigned' : ''}
            </option>
          ))}
        </select>
      </div>
    </Modal>
  )
}
