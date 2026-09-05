import { useState } from 'react'
import { AgeCell, Card, DocPreview, Empty, Note, ProgramTag, StatusPill } from '../components'
import { useStore } from '../store'
import { currentStep, daysAtCurrentStep, prereqStatus, prereqsMet, trailDays, trailFor } from '../lib/workflow'
import { IconEye } from '../icons'

export function Review({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, advance } = useStore()
  const [preview, setPreview] = useState<string | null>(null)
  const previewDoc = preview ? db.docs.find((d) => d.id === preview) : null
  const queue = db.docs.filter((d) => d.status === 'FOR_REVIEW')
  const returned = db.docs.filter((d) => d.status === 'RETURNED' || d.status === 'RETURNED_EXT')
  const ready = queue.filter(prereqsMet).length
  const withPa = db.docs.filter((d) => d.status === 'AT_PA')

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Review queue</h1>
            <div className="head-sub">Check prerequisites before the trail starts</div>
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Waiting</div><div className="m-v">{queue.length}</div></div>
          <div className="metric"><div className="m-l">Ready to verify</div><div className="m-v" style={{ color: 'var(--ok)' }}>{ready}</div></div>
          <div className="metric"><div className="m-l">Returned</div><div className="m-v" style={{ color: returned.length ? 'var(--warn)' : undefined }}>{returned.length}</div></div>
        </div>
      </div>

      <div className="body">
        <Note tone="quiet">
          Verifying a document starts its trail. A document cannot be verified while a prerequisite is missing —
          this is the check that stops it leaving the office incomplete.
        </Note>

        <Card
          title="With the Provincial Agriculturist"
          subtitle="The PA signs on paper — record it here once he has"
          flush
        >
          {withPa.length === 0 ? <Empty>Nothing with the PA.</Empty> : (
            <div className="tw">
              <table>
                <thead>
                  <tr><th>Control no.</th><th>Description</th><th>Waiting for</th><th>Program</th><th className="num-col">On his table</th><th className="action-col">Action</th></tr>
                </thead>
                <tbody>
                  {withPa.map((d) => {
                    const s = currentStep(d)
                    const days = daysAtCurrentStep(d)
                    return (
                      <tr key={d.id} className="clickable" onClick={() => setPreview(d.id)}>
                        <td className="mono link">{d.controlNo}</td>
                        <td><span className="trunc" style={{ maxWidth: 220 }}>{d.subject}</span></td>
                        <td>
                          <span className={`pill ${s?.kind === 'record_in' ? 'pill-neutral' : 'pill-accent'}`}>
                            {s?.kind === 'record_in' ? 'To be received' : 'Signature'}
                          </span>
                        </td>
                        <td><ProgramTag doc={d} /></td>
                        <td className="num-col">
                          <span className={`age `}>{days}d</span>
                        </td>
                        <td className="right action-col" onClick={(e) => e.stopPropagation()}>
                          <div className="actions">
                            <button className="btn sm" onClick={() => setPreview(d.id)}>
                              <IconEye size={13} /> Review
                            </button>
                            <button className="btn sm primary" onClick={() => advance(d.id)}>
                              {s?.kind === 'record_in' ? 'Record received' : 'Record signed'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Waiting for review" flush>
          {queue.length === 0 ? <Empty>Queue is clear.</Empty> : (
            <div className="tw">
              <table>
                <thead>
                  <tr><th>Control no.</th><th>Description</th><th>Type</th><th>Program</th><th>Prerequisites</th><th>Trail</th><th className="num-col">Age</th><th className="action-col">Action</th></tr>
                </thead>
                <tbody>
                  {queue.map((d) => {
                    const p = prereqStatus(d)
                    const trail = trailFor(d.trailCode)
                    return (
                      <tr key={d.id} className="clickable" onClick={() => setPreview(d.id)}>
                        <td className="mono">{d.controlNo}</td>
                        <td><span className="link trunc">{d.subject}</span></td>
                        <td className="muted">{trail?.name}</td>
                        <td><ProgramTag doc={d} /></td>
                        <td>
                          <span className={`pill ${p.met >= p.total ? 'pill-ok' : 'pill-warn'}`}>
                            {p.met}/{p.total} attached
                          </span>
                        </td>
                        <td className="muted mono">{trail?.steps.length} steps · {trail ? trailDays(trail) : 0}d</td>
                        <td className="num-col"><AgeCell doc={d} /></td>
                        <td className="right action-col" onClick={(e) => e.stopPropagation()}>
                          <div className="actions">
                            <button className="btn sm" onClick={() => setPreview(d.id)}>
                              <IconEye size={13} /> Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Returned for deficiency" subtitle="Each return costs a full trip to the Capitol" flush>
          {returned.length === 0 ? <Empty>Nothing returned.</Empty> : (
            <div className="tw">
              <table>
                <thead><tr><th>Control no.</th><th>Description</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>
                  {returned.map((d) => (
                    <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                      <td className="mono">{d.controlNo}</td>
                      <td><span className="link trunc">{d.subject}</span></td>
                      <td className="muted"><span className="trunc">{d.deficiency ?? '—'}</span></td>
                      <td><StatusPill doc={d} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {previewDoc && (
        <DocPreview doc={previewDoc} onClose={() => setPreview(null)} onOpenFull={onOpen} />
      )}
    </>
  )
}
