import { useMemo } from 'react'
import { Card, Empty, Note, ProgramTag, StatusPill, Waffle } from '../components'
import { useStore } from '../store'
import {
  SIGNATORY_LABEL, TRAIL_OFFICES, ageInWorkingDays, currentStep, custodyOf,
  daysAtCurrentStep, isOpen, nextMover, onPaDesk, slaState, stepOverdue, trailFor,
} from '../lib/workflow'
import {
  IconAlert, IconCheck, IconClock, IconFolder, IconGrid, IconRefresh, IconTruck, IconUser,
} from '../icons'
import { TODAY } from '../lib/workflow'
import { useViewState } from '../lib/viewstate'

type Tab = 'desk' | 'overview' | 'attention'

const LONG_DATE = new Date(TODAY + 'T00:00:00').toLocaleDateString('en-PH', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

/**
 * The Provincial Agriculturist's view. Deliberately read-only: the office's
 * user matrix gives the PA oversight and a signing queue, and assigns the
 * recording of that signature to the Encoder. There are no buttons here.
 */
export function PaDesk({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, officeName, currentUser, isUnseen } = useStore()
  const me = currentUser()
  const [tab, setTab] = useViewState<Tab>('padesk.tab', 'desk')

  const desk = onPaDesk(db.docs)
  const inbound = desk.filter((d) => currentStep(d)?.kind === 'record_in')
  const forSignature = desk.filter((d) => currentStep(d)?.signatory === 'provincial_agriculturist')
  // Arrived on his table and not yet opened at this step.
  const unseen = desk.filter(isUnseen)

  const open = db.docs.filter(isOpen)
  const overdue = open.filter(stepOverdue)
  const returned = db.docs.filter((d) => d.status === 'RETURNED' || d.status === 'RETURNED_EXT')
  const breached = open.filter((d) => slaState(d) === 'breach')

  const byOffice = useMemo(() => {
    const m = new Map<string, { count: number; oldest: number }>()
    for (const d of open) {
      const e = m.get(d.currentOfficeId) ?? { count: 0, oldest: 0 }
      e.count += 1
      e.oldest = Math.max(e.oldest, daysAtCurrentStep(d))
      m.set(d.currentOfficeId, e)
    }
    return [...m.entries()].map(([id, v]) => ({ id, name: officeName(id), ...v }))
      .sort((a, b) => b.count - a.count)
  }, [open, officeName])

  const inOffice = open.filter((d) => custodyOf(d) === 'office').length
  const inField = open.length - inOffice

  return (
    <>
      <div style={{ padding: '18px 26px 0' }}>
        <section className="hero">
          <div className="hero-top">
            <div>
              <div className="row" style={{ gap: 11 }}>
                <h1>Welcome back, {me.name.split(' ')[0]}</h1>
                <span className="date-pill">{LONG_DATE}</span>
              </div>
              <p className="lede">Oversight of every document the office is processing</p>
            </div>
            <span className="spacer" />
            <span className="date-pill">View only</span>
            <button className="hero-btn" title="Refresh" onClick={() => location.reload()}>
              <IconRefresh size={14} />
            </button>
          </div>

          <div className="hero-stats">
            <HeroStat
              icon={<IconUser size={14} />} label="On my table" value={desk.length}
              note={unseen.length ? `${unseen.length} not yet opened` : 'waiting on you'}
            />
            <HeroStat icon={<IconCheck size={14} />} label="For signature" value={forSignature.length} note="received, ready to sign" />
            <HeroStat icon={<IconFolder size={14} />} label="In the office" value={inOffice} note="with the encoder" />
            <HeroStat icon={<IconTruck size={14} />} label="Out with liaisons" value={inField} note="at other offices" />
            <HeroStat
              icon={<IconAlert size={14} />} label="Needs attention"
              value={overdue.length + returned.length} note="overdue or returned"
              alert={overdue.length + returned.length > 0}
            />
          </div>
        </section>
      </div>

      <div className="tabs">
        <button className={tab === 'desk' ? 'on' : ''} onClick={() => setTab('desk')}>
          <IconUser size={14} /> On my table <span className="n">{desk.length}</span>
          {unseen.length > 0 && <span className="new-tag">{unseen.length} new</span>}
        </button>
        <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>
          <IconGrid size={14} /> All documents <span className="n">{open.length}</span>
        </button>
        <button className={tab === 'attention' ? 'on' : ''} onClick={() => setTab('attention')}>
          <IconAlert size={14} /> Needs attention <span className="n">{overdue.length + returned.length}</span>
        </button>
      </div>

      <div className="body">
        {tab === 'desk' && (
          <>
            <Note tone="quiet">
              These are the documents waiting on you. Once you have signed, the <b>Encoder</b> records it in the
              system — you do not need to update anything here.
            </Note>

            <Card title="For your signature" subtitle="Received and awaiting signature" flush>
              {forSignature.length === 0 ? <Empty>Nothing awaiting signature.</Empty> : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr><th>Control no.</th><th>Description</th><th>What you are signing</th><th>Program</th><th>Progress</th><th className="num-col">On table</th></tr>
                    </thead>
                    <tbody>
                      {forSignature.map((d) => {
                        const days = daysAtCurrentStep(d)
                        return (
                          <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                            <td className="mono">{d.controlNo}{isUnseen(d) && <span className="new-tag">new</span>}</td>
                            <td><span className="link trunc">{d.subject}</span>
                              <div className="sub">{trailFor(d.trailCode)?.name}</div>
                            </td>
                            <td><span className="trunc" style={{ maxWidth: 220 }}>{currentStep(d)?.requirement}</span></td>
                            <td><ProgramTag doc={d} /></td>
                            <td><Waffle doc={d} small /></td>
                            <td className="right">
                              <span className={`age ${days > 3 ? 'age-breach' : days > 1 ? 'age-warn' : 'age-ok'}`}>{days}d</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Coming to you" subtitle="Recorded inbound, not yet acknowledged as received" flush>
              {inbound.length === 0 ? <Empty>Nothing inbound.</Empty> : (
                <div className="tw">
                  <table>
                    <thead><tr><th>Control no.</th><th>Description</th><th>Type</th><th className="num-col">Waiting</th></tr></thead>
                    <tbody>
                      {inbound.map((d) => (
                        <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                          <td className="mono">{d.controlNo}{isUnseen(d) && <span className="new-tag">new</span>}</td>
                          <td><span className="link trunc">{d.subject}</span></td>
                          <td className="muted">{trailFor(d.trailCode)?.name}</td>
                          <td className="num-col"><span className="age age-warn">{daysAtCurrentStep(d)}d</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'overview' && (
          <>
            <div className="strip">
              <div><div className="s-l">In flight</div><div className="s-v">{open.length}</div></div>
              <div className="hl"><div className="s-l">On my table</div><div className="s-v">{desk.length}</div></div>
              <div><div className="s-l">In the office</div><div className="s-v">{inOffice}</div></div>
              <div><div className="s-l">Out with liaisons</div><div className="s-v">{inField}</div></div>
              <div className={breached.length ? 'bad' : ''}><div className="s-l">Past expected</div><div className="s-v">{breached.length}</div></div>
            </div>

            <div className="split">
              <Card title="Every document in flight" subtitle="Full trail visibility across the office" flush>
                {open.length === 0 ? <Empty>Nothing in flight.</Empty> : (
                  <div className="tw">
                    <table>
                      <thead>
                        <tr><th>Control no.</th><th>Description</th><th>Progress</th><th>Current step</th><th>Who moves it next</th><th>Status</th><th className="num-col">Age</th></tr>
                      </thead>
                      <tbody>
                        {open.map((d) => {
                          const s = currentStep(d)
                          return (
                            <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                              <td className="mono">{d.controlNo}{isUnseen(d) && <span className="new-tag">new</span>}</td>
                              <td><span className="link trunc" style={{ maxWidth: 200 }}>{d.subject}</span></td>
                              <td><Waffle doc={d} small /></td>
                              <td>
                                <span className="trunc" style={{ maxWidth: 190 }}>{s?.requirement ?? '—'}</span>
                                <div className="sub">{s ? TRAIL_OFFICES[s.officeCode] ?? s.officeCode : ''}</div>
                              </td>
                              <td className="muted"><span className="trunc" style={{ maxWidth: 160 }}>{nextMover(d, db.users)}</span></td>
                              <td><StatusPill doc={d} /></td>
                              <td className="num-col"><span className={`age age-${slaState(d)}`}>{ageInWorkingDays(d)}d</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Where documents are sitting" flush>
                <div className="tw">
                  <table>
                    <thead><tr><th>Office</th><th className="right">Held</th><th className="num-col">Oldest</th></tr></thead>
                    <tbody>
                      {byOffice.map((h) => (
                        <tr key={h.id}>
                          <td><span className="trunc" style={{ maxWidth: 180 }}>{h.name}</span></td>
                          <td className="right mono">{h.count}</td>
                          <td className="num-col">
                            <span className={`age `}>{h.oldest}d</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === 'attention' && (
          <>
            <Card title="Past their typical duration" subtitle="Against the office's own figures in the process map" flush>
              {overdue.length === 0 ? <Empty>Every open step is within its expected time.</Empty> : (
                <div className="tw">
                  <table>
                    <thead><tr><th>Control no.</th><th>Description</th><th>Stuck at</th><th>Office</th><th className="num-col">Typical</th><th className="num-col">Actual</th></tr></thead>
                    <tbody>
                      {overdue.map((d) => {
                        const s = currentStep(d)
                        return (
                          <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                            <td className="mono">{d.controlNo}{isUnseen(d) && <span className="new-tag">new</span>}</td>
                            <td><span className="link trunc" style={{ maxWidth: 190 }}>{d.subject}</span></td>
                            <td><span className="trunc" style={{ maxWidth: 200 }}>{s?.requirement}</span></td>
                            <td className="muted">{officeName(d.currentOfficeId)}</td>
                            <td className="num-col mono">{s?.days ?? "—"}d</td>
                            <td className="num-col"><span className="age age-breach">{daysAtCurrentStep(d)}d</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Returned for deficiency" flush>
              {returned.length === 0 ? <Empty>Nothing returned.</Empty> : (
                <div className="tw">
                  <table>
                    <thead><tr><th>Control no.</th><th>Description</th><th>Reason</th><th>Status</th></tr></thead>
                    <tbody>
                      {returned.map((d) => (
                        <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                          <td className="mono">{d.controlNo}{isUnseen(d) && <span className="new-tag">new</span>}</td>
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
          </>
        )}
      </div>
    </>
  )
}

function HeroStat({ icon, label, value, note, alert }: {
  icon: React.ReactNode; label: string; value: number; note: string; alert?: boolean
}) {
  return (
    <div className={`hs${alert ? ' alert' : ''}`}>
      <div className="ic">{icon}</div>
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      <div className="d">{note}</div>
    </div>
  )
}
