import { useMemo, useState } from 'react'
import { Card, DocPreview, Empty, Modal, Note, ProofPrompt, StatusPill, Waffle } from '../components'
import { useStore } from '../store'
import { SIGNATORY_LABEL, TRAIL_OFFICES, currentStep, daysAtCurrentStep, liaisonLoad, loadBucket, needsRefNumberNow, trailFor } from '../lib/workflow'
import { officeIdFor } from '../data/seed'
import { IconCheck, IconEye, IconSend, IconTruck } from '../icons'

/**
 * Liaison view — mirrors the mobile app's "my load" screen. Documents are
 * grouped by the office named in the *next* step of their trail, so batching
 * follows the real route rather than a guess.
 */
export function Liaison({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, userId, currentUser, officeName, createTransmittal, receiveTransmittal, advance, depart, isUntouched, addExternalRef } = useStore()
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [slipId, setSlipId] = useState<string | null>(null)
  const [receiving, setReceiving] = useState<string | null>(null)
  const [signing, setSigning] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const previewDoc = preview ? db.docs.find((d) => d.id === preview) : null

  // Only what this liaison is assigned, per the office's user matrix. Every open
  // document falls into exactly one bucket, so releasing a batch moves a document
  // between sections — it never drops it off the screen.
  const mine = liaisonLoad(db.docs, userId)
  const ready = mine.filter((d) => loadBucket(d) === 'carry')
  const out = mine.filter((d) => loadBucket(d) === 'field')
  const back = mine.filter((d) => loadBucket(d) === 'office')
  const openTransmittals = db.transmittals.filter((t) => t.status === 'RELEASED' && t.liaisonId === userId)
  // Assigned to her and not yet acted on — the tag clears on her first update.
  const fresh = mine.filter(isUntouched)

  const groups = useMemo(() => {
    const g: Record<string, typeof ready> = {}
    for (const d of ready) {
      const code = currentStep(d)?.officeCode ?? 'OPAG'
      const oid = officeIdFor(code)
      ;(g[oid] ?? (g[oid] = [])).push(d)
    }
    return g
  }, [ready])

  function release(officeId: string) {
    const ids = (groups[officeId] ?? []).filter((d) => picked[d.id]).map((d) => d.id)
    if (!ids.length) return
    setSlipId(createTransmittal(officeId, ids))
    setPicked({})
  }

  const slip = slipId ? db.transmittals.find((t) => t.id === slipId) : null
  const receivingSlip = receiving ? db.transmittals.find((t) => t.id === receiving) : null
  const signingDoc = signing ? db.docs.find((d) => d.id === signing) : null

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>My load</h1>
            <div className="head-sub">
              Documents assigned to you, once they leave the office
              {fresh.length > 0 && <span className="new-tag">{fresh.length} new</span>}
            </div>
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Ready to carry</div><div className="m-v">{ready.length}</div></div>
          <div className="metric"><div className="m-l">Out of the office</div><div className="m-v">{out.length}</div></div>
          <div className="metric"><div className="m-l">Back in the office</div><div className="m-v">{back.length}</div></div>
          <div className="metric"><div className="m-l">Awaiting receipt</div><div className="m-v">{openTransmittals.length}</div></div>
        </div>
      </div>

      <div className="body">
        {Object.keys(groups).length === 0 ? (
          <Card><Empty>
            {mine.length === 0
              ? 'Nothing assigned to you. Verify something in the Review queue first.'
              : 'Nothing waiting to be carried out — everything assigned to you is already moving. See below.'}
          </Empty></Card>
        ) : (
          Object.entries(groups).map(([officeId, docs]) => {
            const n = docs.filter((d) => picked[d.id]).length
            return (
              <Card
                key={officeId}
                title={`To ${officeName(officeId)}`}
                subtitle={`${docs.length} document${docs.length === 1 ? '' : 's'} bound for this office`}
                action={
                  <button className="btn primary sm" disabled={!n} onClick={() => release(officeId)}>
                    <IconSend size={13} /> Build transmittal{n ? ` (${n})` : ''}
                  </button>
                }
                flush
              >
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox" aria-label="Select all"
                            checked={docs.every((d) => picked[d.id])}
                            onChange={(e) => {
                              const v = e.target.checked
                              setPicked((p) => { const nx = { ...p }; docs.forEach((d) => { nx[d.id] = v }); return nx })
                            }} />
                        </th>
                        <th>Control no.</th><th>Description</th><th>Next step</th><th>Progress</th>
                        <th className="action-col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => {
                        const s = currentStep(d)
                        return (
                          <tr key={d.id}>
                            <td>
                              <input type="checkbox" aria-label={`Select ${d.controlNo}`}
                                checked={!!picked[d.id]}
                                onChange={(e) => setPicked((p) => ({ ...p, [d.id]: e.target.checked }))} />
                            </td>
                            <td className="mono link" onClick={() => onOpen(d.id)}>{d.controlNo}{isUntouched(d) && <span className="new-tag">new</span>}</td>
                            <td><span className="trunc">{d.subject}</span></td>
                            <td>
                              <span className="trunc" style={{ maxWidth: 220 }}>{s?.requirement}</span>
                              {s && <div className="sub">{SIGNATORY_LABEL[s.signatory]}</div>}
                            </td>
                            <td><Waffle doc={d} small /></td>
                            <td className="right action-col">
                              <button className="btn sm" onClick={() => setPreview(d.id)}>
                                <IconEye size={13} /> View
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })
        )}

        {openTransmittals.length > 0 && (
          <Card title="Transmittals awaiting receipt" flush>
            <div className="tw">
              <table>
                <thead><tr><th>Transmittal</th><th>To</th><th className="right">Items</th><th>Released</th><th></th></tr></thead>
                <tbody>
                  {openTransmittals.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{t.no}</td>
                      <td>{officeName(t.toOfficeId)}</td>
                      <td className="right mono">{t.docIds.length}</td>
                      <td className="mono muted">{t.releasedAt}</td>
                      <td className="right">
                        <button className="btn sm" onClick={() => setReceiving(t.id)}>Record receipt</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {out.length > 0 && (
          <Card title="Out of the office" subtitle="In your custody until each office finishes its step — including anything sent back to you" flush>
            <div className="tw">
              <table>
                <thead><tr><th>Control no.</th><th>Description</th><th>Where</th><th>Step</th><th>Status</th><th className="num-col">Days</th><th className="action-col">Action</th></tr></thead>
                <tbody>
                  {out.map((d) => {
                    const s = currentStep(d)
                    return (
                      <tr key={d.id}>
                        <td className="mono link" onClick={() => onOpen(d.id)}>{d.controlNo}{isUntouched(d) && <span className="new-tag">new</span>}</td>
                        <td><span className="trunc" style={{ maxWidth: 200 }}>{d.subject}</span></td>
                        <td className="muted">{d.currentHolderName ?? officeName(d.currentOfficeId)}</td>
                        <td><span className="trunc" style={{ maxWidth: 190 }}>{s?.requirement}</span></td>
                        <td><StatusPill doc={d} /></td>
                        <td className="num-col"><span className="age age-ok">{daysAtCurrentStep(d)}d</span></td>
                        <td className="right action-col">
                          <div className="actions">
                            <button className="btn sm" onClick={() => setPreview(d.id)}><IconEye size={13} /> View</button>
                            {d.status === 'AT_OFFICE' ? (
                              <button className="btn sm primary" onClick={() => setSigning(d.id)}>
                                <IconCheck size={13} /> Signed
                              </button>
                            ) : d.status === 'FOR_RELEASE' ? (
                              <button className="btn sm primary" onClick={() => depart(d.id)}>
                                <IconSend size={13} /> Leaving now
                              </button>
                            ) : <span className="slot" />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {back.length > 0 && (
          <Card
            title="Back in the office"
            subtitle="Still assigned to you, but the Encoder holds them — nothing for you to update yet"
            flush
          >
            <div className="tw">
              <table>
                <thead><tr><th>Control no.</th><th>Description</th><th>Where</th><th>Step</th><th>Status</th><th className="num-col">Days</th><th className="action-col">Action</th></tr></thead>
                <tbody>
                  {back.map((d) => {
                    const s = currentStep(d)
                    return (
                      <tr key={d.id}>
                        <td className="mono link" onClick={() => onOpen(d.id)}>{d.controlNo}{isUntouched(d) && <span className="new-tag">new</span>}</td>
                        <td><span className="trunc" style={{ maxWidth: 200 }}>{d.subject}</span></td>
                        <td className="muted">{d.currentHolderName ?? officeName(d.currentOfficeId)}</td>
                        <td><span className="trunc" style={{ maxWidth: 190 }}>{s?.requirement}</span></td>
                        <td><StatusPill doc={d} /></td>
                        <td className="num-col"><span className="age age-ok">{daysAtCurrentStep(d)}d</span></td>
                        <td className="right action-col">
                          <button className="btn sm" onClick={() => setPreview(d.id)}>
                            <IconEye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {slip && (
        <Modal
          title={`Transmittal ${slip.no}`}
          description="One QR covers the whole batch. The receiving clerk scans once and every document in it is acknowledged with their name and the timestamp."
          onClose={() => setSlipId(null)}
          footer={
            <>
              <button className="btn" onClick={() => setSlipId(null)}>Close</button>
              <button className="btn primary" onClick={() => { setReceiving(slip.id); setSlipId(null) }}>
                Simulate receiver scanning it
              </button>
            </>
          }
        >
          <div className="note note-quiet" style={{ display: 'block' }}>
            <dl className="kv">
              <dt>Transmittal no.</dt><dd className="mono">{slip.no}</dd>
              <dt>To</dt><dd>{officeName(slip.toOfficeId)}</dd>
              <dt>Items</dt><dd>{slip.docIds.length}</dd>
              <dt>Released</dt><dd className="mono">{slip.releasedAt}</dd>
              <dt>Scan code</dt><dd className="mono" style={{ fontSize: 17, letterSpacing: '.1em' }}>▣ {slip.no.slice(-6)}</dd>
            </dl>
          </div>
        </Modal>
      )}

      {previewDoc && (
        <DocPreview doc={previewDoc} onClose={() => setPreview(null)} onOpenFull={onOpen} />
      )}

      {signingDoc && (
        <ProofPrompt
          doc={signingDoc}
          title={`Signed — ${currentStep(signingDoc)?.requirement ?? 'this step'}`}
          description="Record that the signatory has signed. The photograph is filed with the document, and it moves to its next step automatically."
          askRefNumber={
            needsRefNumberNow(signingDoc) && trailFor(signingDoc.trailCode)?.refNumberOrigin
              ? `${trailFor(signingDoc.trailCode)!.name} number, from ${TRAIL_OFFICES[trailFor(signingDoc.trailCode)!.refNumberOrigin!] ?? trailFor(signingDoc.trailCode)!.refNumberOrigin}`
              : undefined
          }
          confirmLabel="Record it"
          onClose={() => setSigning(null)}
          onConfirm={(fileName, _receivedBy, _thumb, refNumber) => {
            const origin = trailFor(signingDoc.trailCode)?.refNumberOrigin
            if (refNumber && origin) {
              addExternalRef(signingDoc.id, { officeCode: origin, label: `${trailFor(signingDoc.trailCode)!.name} number`, number: refNumber })
            }
            advance(signingDoc.id, undefined, fileName)
            setSigning(null)
          }}
        />
      )}

      {receivingSlip && (
        <ProofPrompt
          doc={db.docs.find((d) => receivingSlip.docIds.includes(d.id))!}
          title={`Receipt of transmittal ${receivingSlip.no}`}
          description={`${receivingSlip.docIds.length} document${receivingSlip.docIds.length === 1 ? '' : 's'} handed to ${officeName(receivingSlip.toOfficeId)}. One photograph of the stamped transmittal covers the batch.`}
          askName="Received by (name)"
          confirmLabel="Confirm receipt"
          onClose={() => setReceiving(null)}
          onConfirm={(fileName, name) => { receiveTransmittal(receivingSlip.id, name, fileName); setReceiving(null) }}
        />
      )}
    </>
  )
}
