import { useMemo } from 'react'
import { Card, Empty, ProgramTag } from '../components'
import { useStore } from '../store'
import { currentStep, custodyOf, daysAtCurrentStep, isOpen, trailFor } from '../lib/workflow'
import { IconInbox, IconSend } from '../icons'

/**
 * The encoder's front desk: everything about to cross the threshold, in either
 * direction. "To receive" is paper physically arriving back at OPAg — a
 * routine hand-off partway through a trail, or a document an outside office
 * bounced back — and "to release" is paper signed and waiting for a liaison
 * to be named. Both queues are already real actions elsewhere (the Registry
 * row, the PA desk, the document itself); this just puts the two that need
 * the front desk's attention side by side instead of buried across screens.
 */
export function ReceiveRelease({ onOpen }: { onOpen: (id: string) => void }) {
  const { db } = useStore()

  const toReceive = useMemo(() => db.docs.filter((d) => {
    if (!isOpen(d) || custodyOf(d) !== 'office') return false
    if (d.status === 'RETURNED_EXT') return true
    return d.status === 'AT_OFFICE' && currentStep(d)?.kind === 'record_receipt'
  }), [db.docs])

  const toRelease = useMemo(() => db.docs.filter((d) => d.status === 'FOR_RELEASE'), [db.docs])

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Receive &amp; release</h1>
            <div className="head-sub">Documents crossing the office threshold, either direction</div>
          </div>
        </div>
      </div>

      <div className="body">
        <div className="grid-2">
          <Card title="To receive" subtitle={`${toReceive.length} waiting to be checked in`} flush>
            {toReceive.length === 0 ? <Empty>Nothing waiting to be received.</Empty> : (
              <div className="tw">
                <table>
                  <thead><tr><th>Control no.</th><th>Description</th><th>Why it's here</th><th className="num-col">Waiting</th></tr></thead>
                  <tbody>
                    {toReceive.map((d) => (
                      <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                        <td className="mono">{d.controlNo}</td>
                        <td>
                          <span className="link trunc" style={{ maxWidth: 180 }}>{d.subject}</span>
                          <div className="sub">{trailFor(d.trailCode)?.name}</div>
                        </td>
                        <td className="muted">
                          <span className="trunc" style={{ maxWidth: 220 }}>
                            {d.status === 'RETURNED_EXT' ? (d.deficiency || 'Returned by an outside office') : currentStep(d)?.requirement}
                          </span>
                        </td>
                        <td className="num-col"><span className="age age-warn"><IconInbox size={12} /> {daysAtCurrentStep(d)}d</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="To release" subtitle={`${toRelease.length} signed, waiting for a liaison`} flush>
            {toRelease.length === 0 ? <Empty>Nothing waiting to go out.</Empty> : (
              <div className="tw">
                <table>
                  <thead><tr><th>Control no.</th><th>Description</th><th>Program</th><th className="num-col">Waiting</th></tr></thead>
                  <tbody>
                    {toRelease.map((d) => (
                      <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                        <td className="mono">{d.controlNo}</td>
                        <td>
                          <span className="link trunc" style={{ maxWidth: 180 }}>{d.subject}</span>
                          <div className="sub">{trailFor(d.trailCode)?.name}</div>
                        </td>
                        <td><ProgramTag doc={d} /></td>
                        <td className="num-col"><span className="age age-ok"><IconSend size={12} /> {daysAtCurrentStep(d)}d</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
