import { useMemo } from 'react'
import { Card, Empty } from '../components'
import { useStore } from '../store'
import { currentStep, daysAtCurrentStep, isOpen, TRAIL_OFFICES } from '../lib/workflow'

/**
 * Where the office's time actually goes — computed from the same documents
 * every other screen reads, never from separate report data. "Aging" is where
 * open documents are sitting right now; "bottleneck" is which specific step is
 * holding them longest, averaged across every document currently stuck there.
 */
export function Reports() {
  const { db, officeName } = useStore()
  const open = db.docs.filter(isOpen)

  const aging = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of open) {
      m.set(d.currentOfficeId, Math.max(m.get(d.currentOfficeId) ?? 0, daysAtCurrentStep(d)))
    }
    return [...m.entries()]
      .map(([id, days]) => ({ id, name: officeName(id), days }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 8)
  }, [open, officeName])
  const maxAging = Math.max(1, ...aging.map((a) => a.days))

  const bottleneck = useMemo(() => {
    const m = new Map<string, { label: string; total: number; count: number }>()
    for (const d of open) {
      const step = currentStep(d)
      if (!step) continue
      const key = `${step.officeCode}::${step.requirement}`
      const office = TRAIL_OFFICES[step.officeCode] ?? step.officeCode
      const e = m.get(key) ?? { label: `${step.requirement} — ${office}`, total: 0, count: 0 }
      e.total += daysAtCurrentStep(d)
      e.count += 1
      m.set(key, e)
    }
    return [...m.values()]
      .map((e) => ({ label: e.label, avg: Math.round((e.total / e.count) * 10) / 10, count: e.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8)
  }, [open])
  const maxBottleneck = Math.max(1, ...bottleneck.map((b) => b.avg))

  const liaisonActivity = useMemo(() => {
    const liaisons = db.users.filter((u) => u.roles.includes('liaison'))
    return liaisons
      .map((l) => {
        let stops = 0
        let proofs = 0
        for (const d of db.docs) {
          for (const e of d.events) {
            if (e.actorName !== l.name) continue
            if (e.source === 'mobile' && (e.type === 'RECEIVED' || e.type === 'RELEASED' || e.type === 'STEP_DONE')) stops += 1
            if (e.fileId) proofs += 1
          }
        }
        return { id: l.id, name: l.name, stops, proofs }
      })
      .sort((a, b) => b.stops - a.stops)
  }, [db.docs, db.users])

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Reports</h1>
            <div className="head-sub">Aging, bottlenecks and liaison activity — computed live from every open document</div>
          </div>
        </div>
      </div>

      <div className="body">
        <div className="grid-2">
          <Card title="Aging" subtitle="Oldest open document by office">
            {aging.length === 0 ? <Empty>Nothing open.</Empty> : aging.map((a) => (
              <div key={a.id} style={{ marginBottom: 9 }}>
                <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                  <span className="trunc" style={{ maxWidth: 220, fontSize: 12.5 }}>{a.name}</span>
                  <span className="spacer" />
                  <span className="mono">{a.days}d</span>
                </div>
                <div style={{ height: 6, background: 'var(--sub-2)', borderRadius: 999 }}>
                  <div style={{ width: `${(a.days / maxAging) * 100}%`, height: '100%', background: 'var(--brand)', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </Card>

          <Card title="Where documents get stuck" subtitle="Average days at the current step, among open documents">
            {bottleneck.length === 0 ? <Empty>Nothing open.</Empty> : bottleneck.map((b) => (
              <div key={b.label} style={{ marginBottom: 9 }}>
                <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                  <span className="trunc" style={{ maxWidth: 220, fontSize: 12.5 }}>{b.label}</span>
                  <span className="spacer" />
                  <span className="mono">{b.avg}d <span className="muted">· {b.count}</span></span>
                </div>
                <div style={{ height: 6, background: 'var(--sub-2)', borderRadius: 999 }}>
                  <div style={{ width: `${(b.avg / maxBottleneck) * 100}%`, height: '100%', background: 'var(--ok)', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Card title="Liaison activity" subtitle="Custody events recorded from the field, all time" flush>
          {liaisonActivity.length === 0 ? <Empty>No liaisons on record.</Empty> : (
            <div className="tw">
              <table>
                <thead><tr><th>Liaison</th><th className="num-col">Stops recorded</th><th className="num-col">Proofs filed</th></tr></thead>
                <tbody>
                  {liaisonActivity.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td className="num-col mono">{l.stops}</td>
                      <td className="num-col mono">{l.proofs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
