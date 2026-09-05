import { useMemo, useState } from 'react'
import { AgeCell, Card, Empty, Note, ProgramTag, StatusPill, Waffle, WaffleLegend } from '../components'
import { useStore } from '../store'
import {
  ACTIONABLE_DIRECTIVES, DIRECTIVE_LABEL, STATUS_LABEL, TODAY, SIGNATORY_LABEL,
  ageInWorkingDays, currentStep, daysAtCurrentStep, isOpen, onPaDesk, slaState,
  stepOverdue, travelsMissingReport, trailFor,
} from '../lib/workflow'
import { IconAlert, IconChevronRight, IconClock, IconFilePlus, IconGrid, IconLayers, IconUser } from '../icons'
import type { View } from '../App'
import { useViewState } from '../lib/viewstate'

const LONG_DATE = new Date(TODAY + 'T00:00:00').toLocaleDateString('en-PH', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

type Tab = 'overview' | 'padesk' | 'bottlenecks' | 'gaps'

export function Dashboard({ onOpen, onGo, onRegister }: {
  onOpen: (id: string) => void; onGo: (v: View) => void; onRegister: () => void
}) {
  const { db, role, currentUser, officeName } = useStore()
  const [tab, setTab] = useViewState<Tab>('dashboard.tab', 'overview')
  const me = currentUser()

  const visible = db.docs

  const open = visible.filter(isOpen)
  const breached = open.filter((d) => slaState(d) === 'breach')
  const returned = visible.filter((d) => d.status === 'RETURNED' || d.status === 'RETURNED_EXT')
  const completed = visible.filter((d) => d.status === 'COMPLETED')
  const paDesk = onPaDesk(visible)
  const missing = travelsMissingReport(db.docs)
  const overdueSteps = open.filter(stepOverdue)

  /** Where open documents are sitting, busiest first. */
  const holders = useMemo(() => {
    const m = new Map<string, { count: number; oldest: number }>()
    for (const d of open) {
      const e = m.get(d.currentOfficeId) ?? { count: 0, oldest: 0 }
      e.count += 1
      e.oldest = Math.max(e.oldest, daysAtCurrentStep(d))
      m.set(d.currentOfficeId, e)
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, name: officeName(id), ...v }))
      .sort((a, b) => b.count - a.count)
  }, [open, officeName])

  const byProgram = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of visible) m.set(d.programId, (m.get(d.programId) ?? 0) + 1)
    return [...m.entries()]
      .map(([id, count]) => ({ program: db.programs.find((p) => p.id === id)!, count }))
      .sort((a, b) => b.count - a.count).slice(0, 7)
  }, [visible, db.programs])
  const maxProgram = Math.max(1, ...byProgram.map((r) => r.count))

  const recent = useMemo(
    () => visible.flatMap((d) => d.events.map((e) => ({ e, d })))
      .sort((a, b) => (a.e.at < b.e.at ? 1 : -1)).slice(0, 6),
    [visible],
  )

  const scope = 'All programs'

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Dashboard</h1>
            <div className="head-sub">{scope} · {LONG_DATE}</div>
          </div>
          <span className="spacer" />
          {role === 'encoder' && (
            <button className="btn primary" onClick={onRegister}>
              <IconFilePlus size={14} /> Register a document
            </button>
          )}
        </div>
        <div className="metrics">
          <div className="metric">
            <div className="m-l">Open documents</div>
            <div className="m-v">{open.length} <small>of {visible.length}</small></div>
          </div>
          <div className="metric">
            <div className="m-l">On the PA's desk</div>
            <div className="m-v" style={{ color: paDesk.length ? 'var(--accent)' : undefined }}>
              {paDesk.length} <small>awaiting signature</small>
            </div>
          </div>
          <div className="metric">
            <div className="m-l">Step overdue</div>
            <div className="m-v" style={{ color: overdueSteps.length ? 'var(--crit)' : undefined }}>
              {overdueSteps.length} <small>past typical days</small>
            </div>
          </div>
          <div className="metric">
            <div className="m-l">Returned</div>
            <div className="m-v" style={{ color: returned.length ? 'var(--warn)' : undefined }}>
              {returned.length} <small>needs rework</small>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>
          <IconGrid size={14} /> Overview
        </button>
        <button className={tab === 'padesk' ? 'on' : ''} onClick={() => setTab('padesk')}>
          <IconUser size={14} /> PA checkpoint <span className="n">{paDesk.length}</span>
        </button>
        <button className={tab === 'bottlenecks' ? 'on' : ''} onClick={() => setTab('bottlenecks')}>
          <IconClock size={14} /> Bottlenecks <span className="n">{overdueSteps.length}</span>
        </button>
        <button className={tab === 'gaps' ? 'on' : ''} onClick={() => setTab('gaps')}>
          <IconAlert size={14} /> Gaps <span className="n">{missing.length}</span>
        </button>
      </div>

      <div className="body">
        {tab === 'overview' && (
          <>
            <div className="strip">
              <div><div className="s-l">In flight</div><div className="s-v">{open.length}</div></div>
              <div className="hl"><div className="s-l">With the PA</div><div className="s-v">{paDesk.length}</div></div>
              <div><div className="s-l">Completed</div><div className="s-v">{completed.length}</div></div>
              <div className={breached.length ? 'bad' : ''}><div className="s-l">Past expected days</div><div className="s-v">{breached.length}</div></div>
            </div>

            <div className="split">
              <Card title="Documents in flight" subtitle="Trail progress — one square per step" flush>
                {open.length === 0 ? <Empty>Nothing in flight.</Empty> : (
                  <div className="tw">
                    <table>
                      <thead>
                        <tr>
                          <th>Control no.</th><th>Program</th><th>Description</th>
                          <th>Progress</th><th>Current step</th><th>Status</th><th className="num-col">Age</th>
                        </tr>
                      </thead>
                      <tbody>
                        {open.map((d) => {
                          const s = currentStep(d)
                          return (
                            <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                              <td className="mono">{d.controlNo}</td>
                              <td><ProgramTag doc={d} /></td>
                              <td><span className="trunc">{d.subject}</span></td>
                              <td><Waffle doc={d} small /></td>
                              <td>
                                <span className="trunc" style={{ maxWidth: 200 }}>{s?.requirement ?? '—'}</span>
                                <div className="sub">{s ? SIGNATORY_LABEL[s.signatory] : ''}</div>
                              </td>
                              <td><StatusPill doc={d} /></td>
                              <td className="num-col"><AgeCell doc={d} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ padding: '12px 15px' }}><WaffleLegend /></div>
              </Card>

              <div>
                <Card title="Where documents are sitting" subtitle="Open documents by current office" flush>
                  {holders.length === 0 ? <Empty>Nothing in flight.</Empty> : (
                    <div className="tw">
                      <table>
                        <thead><tr><th>Office</th><th className="right">Held</th><th className="num-col">Oldest</th></tr></thead>
                        <tbody>
                          {holders.map((h) => (
                            <tr key={h.id}>
                              <td><span className="trunc" style={{ maxWidth: 190 }}>{h.name}</span></td>
                              <td className="right mono">{h.count}</td>
                              <td className="right">
                                <span className={`age ${h.oldest > 5 ? 'age-breach' : h.oldest > 2 ? 'age-warn' : 'age-ok'}`}>{h.oldest}d</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card title="Program activity" subtitle="Volume by program">
                  {byProgram.map((r) => (
                    <div key={r.program.id} style={{ marginBottom: 9 }}>
                      <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                        <span className="ptag"><i style={{ background: r.program.color }} />{r.program.code}</span>
                        <span className="spacer" />
                        <span className="mono">{r.count}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--sub-2)', borderRadius: 999 }}>
                        <div style={{ width: `${(r.count / maxProgram) * 100}%`, height: '100%', background: r.program.color, borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </Card>

                <Card title="Recent activity" subtitle="From the audit trail" flush>
                  <div className="tw">
                    <table>
                      <tbody>
                        {recent.map(({ e, d }) => (
                          <tr key={e.id} className="clickable" onClick={() => onOpen(d.id)}>
                            <td>
                              <div style={{ fontSize: 12.5 }}>
                                <b>{e.actorName}</b>{' '}
                                {e.to ? <>→ {STATUS_LABEL[e.to].en}</> : e.type.replace(/_/g, ' ').toLowerCase()}
                              </div>
                              <div className="sub mono">{d.controlNo} · {e.at}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {tab === 'padesk' && (
          <>
            <Note tone="info">
              Every step immediately before and after the Provincial Agriculturist signs is recorded, so the time a
              document spends on that desk is visible rather than inferred. Circles in the trail mark those checkpoints.
            </Note>
            <Card title="Awaiting the Provincial Agriculturist" subtitle="Oldest first" flush>
              {paDesk.length === 0 ? <Empty>Nothing on the desk.</Empty> : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr><th>Control no.</th><th>Description</th><th>Step</th><th>Program</th><th className="num-col">Days on desk</th></tr>
                    </thead>
                    <tbody>
                      {paDesk.map((d) => {
                        const s = currentStep(d)
                        const days = daysAtCurrentStep(d)
                        return (
                          <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                            <td className="mono">{d.controlNo}</td>
                            <td><span className="trunc">{d.subject}</span></td>
                            <td>
                              <span className={`pill ${s?.kind === 'record_in' ? 'pill-neutral' : 'pill-accent'}`}>
                                {s?.kind === 'record_in' ? 'Inbound' : 'For signature'}
                              </span>
                            </td>
                            <td><ProgramTag doc={d} /></td>
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
          </>
        )}

        {tab === 'bottlenecks' && (
          <>
            <Note tone={overdueSteps.length ? 'warn' : 'quiet'}>
              A step is flagged when it has been sitting longer than the <b>typical working days</b> the office
              recorded for it in the process map — not against a generic target.
            </Note>
            <Card title="Steps past their typical duration" flush>
              {overdueSteps.length === 0 ? <Empty>Every open step is within its expected time.</Empty> : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr><th>Control no.</th><th>Description</th><th>Stuck at</th><th>Office</th><th className="num-col">Typical</th><th className="num-col">Actual</th></tr>
                    </thead>
                    <tbody>
                      {overdueSteps.map((d) => {
                        const s = currentStep(d)
                        return (
                          <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                            <td className="mono">{d.controlNo}</td>
                            <td><span className="trunc" style={{ maxWidth: 220 }}>{d.subject}</span></td>
                            <td><span className="trunc" style={{ maxWidth: 220 }}>{s?.requirement}</span></td>
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
          </>
        )}

        {tab === 'gaps' && (
          <>
            <Note tone="crit">
              <b>{missing.length} completed travels</b> have no Post-Travel Report on file. A report is required for
              every travel; this list is invisible in the logbook because it needs two sheets joined.
            </Note>
            <Card title="Travel completed, no Post-Travel Report" flush>
              {missing.length === 0 ? <Empty>Every completed travel has a report.</Empty> : (
                <div className="tw">
                  <table>
                    <thead><tr><th>Control no.</th><th>Travel</th><th>Destination</th><th>Completed</th><th className="num-col">Days since</th></tr></thead>
                    <tbody>
                      {missing.map((d) => (
                        <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                          <td className="mono">{d.controlNo}</td>
                          <td><span className="trunc">{d.subject}</span></td>
                          <td className="muted">{d.fields.destination}</td>
                          <td className="mono muted">{d.completedAt}</td>
                          <td className="num-col mono">{ageInWorkingDays({ ...d, completedAt: undefined })}</td>
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
