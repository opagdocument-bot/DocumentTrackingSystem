import { useEffect, useMemo } from 'react'
import { AgeCell, Card, Empty, ProgramTag, StatusPill, Waffle } from '../components'
import { useStore } from '../store'
import { SIGNATORY_LABEL, currentStep, isOpen, isWithPa, stepOverdue, travelsMissingReport, trailFor } from '../lib/workflow'
import { IconSearch } from '../icons'
import { useViewState } from '../lib/viewstate'

type Filter = 'all' | 'open' | 'pa' | 'overdue' | 'returned' | 'done' | 'gap'

export function Registry({ onOpen, initialQuery = '' }: { onOpen: (id: string) => void; initialQuery?: string }) {
  const { db, officeName } = useStore()
  const [q, setQ] = useViewState('registry.q', initialQuery)
  const [type, setType] = useViewState('registry.type', '')
  const [program, setProgram] = useViewState('registry.program', '')
  const [filter, setFilter] = useViewState<Filter>('registry.filter', 'all')

  useEffect(() => { if (initialQuery) setQ(initialQuery) }, [initialQuery])

  const gapIds = useMemo(() => new Set(travelsMissingReport(db.docs).map((d) => d.id)), [db.docs])

  const counts = useMemo(() => ({
    all: db.docs.length,
    open: db.docs.filter(isOpen).length,
    pa: db.docs.filter((d) => isOpen(d) && isWithPa(d)).length,
    overdue: db.docs.filter((d) => isOpen(d) && stepOverdue(d)).length,
    returned: db.docs.filter((d) => d.status === 'RETURNED' || d.status === 'RETURNED_EXT').length,
    done: db.docs.filter((d) => !isOpen(d)).length,
    gap: gapIds.size,
  }), [db.docs, gapIds])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return db.docs.filter((d) => {
      if (type && d.trailCode !== type) return false
      if (program && d.programId !== program) return false
      if (filter === 'open' && !isOpen(d)) return false
      if (filter === 'done' && isOpen(d)) return false
      if (filter === 'pa' && !(isOpen(d) && isWithPa(d))) return false
      if (filter === 'overdue' && !(isOpen(d) && stepOverdue(d))) return false
      if (filter === 'returned' && d.status !== 'RETURNED' && d.status !== 'RETURNED_EXT') return false
      if (filter === 'gap' && !gapIds.has(d.id)) return false
      if (!needle) return true
      return [d.controlNo, d.refNumber ?? '', d.drsNo ?? '', d.subject, ...Object.values(d.fields)]
        .join(' ').toLowerCase().includes(needle)
    })
  }, [db.docs, q, type, program, filter, gapIds])

  /** Group rows by category, like the vendor-directory reference. */
  const grouped = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const d of rows) {
      const cat = trailFor(d.trailCode)?.category ?? 'Other'
      ;(m.get(cat) ?? m.set(cat, []).get(cat)!).push(d)
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [rows])

  const F: { k: Filter; label: string }[] = [
    { k: 'all', label: 'All' }, { k: 'open', label: 'Open' }, { k: 'pa', label: "With the PA" },
    { k: 'overdue', label: 'Step overdue' }, { k: 'returned', label: 'Returned' },
    { k: 'done', label: 'Closed' }, { k: 'gap', label: 'Missing PTR' },
  ]

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Registry</h1>
            <div className="head-sub">{rows.length} of {db.docs.length} documents</div>
          </div>
        </div>
      </div>

      <div className="body">
        <div className="filter-bar">
          {F.map((f) => (
            <button key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>
              {f.label} <span className="n">{counts[f.k]}</span>
            </button>
          ))}
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <div className="search" style={{ flex: '2 1 260px' }}>
            <IconSearch size={14} />
            <input placeholder="Search control no., subject, destination…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" style={{ flex: '1 1 160px', width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All document types</option>
            {db.types.map((t) => <option key={t.code} value={t.code}>{t.name}{t.variant ? ` — ${t.variant}` : ''}</option>)}
          </select>
          <select className="input" style={{ flex: '1 1 150px', width: 'auto' }} value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">All programs</option>
            {db.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <Card flush>
          {rows.length === 0 ? <Empty>No documents match.</Empty> : (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Control no.</th><th>Description</th><th>Program</th>
                    <th>Progress</th><th>Current step</th><th>Held by</th><th>Status</th><th className="num-col">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([cat, docs]) => (
                    <>
                      <tr className="group" key={cat}>
                        <td colSpan={8}>{cat}<span className="n">{docs.length}</span></td>
                      </tr>
                      {docs.map((d) => {
                        const s = currentStep(d)
                        return (
                          <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                            <td className="mono">{d.controlNo}</td>
                            <td>
                              <span className="link trunc">{d.subject}</span>
                              <div className="sub">{trailFor(d.trailCode)?.name}</div>
                            </td>
                            <td><ProgramTag doc={d} /></td>
                            <td><Waffle doc={d} small /></td>
                            <td>
                              <span className="trunc" style={{ maxWidth: 190 }}>{s?.requirement ?? '—'}</span>
                              {s && <div className="sub">{SIGNATORY_LABEL[s.signatory]}</div>}
                            </td>
                            <td className="muted"><span className="trunc" style={{ maxWidth: 150 }}>{d.currentHolderName ?? officeName(d.currentOfficeId)}</span></td>
                            <td><StatusPill doc={d} /></td>
                            <td className="num-col"><AgeCell doc={d} /></td>
                          </tr>
                        )
                      })}
                    </>
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
