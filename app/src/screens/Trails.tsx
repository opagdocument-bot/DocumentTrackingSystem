import { useState } from 'react'
import { Card, Empty, Note } from '../components'
import { TRAILS_WITH_CHECKPOINTS, TRAIL_OFFICES, trailDays } from '../data/trail'
import { SIGNATORY_LABEL } from '../lib/workflow'
import { IconLayers } from '../icons'

/**
 * The office's process map, rendered as the system reads it. Exists so staff
 * can check the transcription against their own spreadsheet.
 */
export function Trails() {
  const [open, setOpen] = useState<string | null>('PR')
  const [cat, setCat] = useState<string>('All')

  const cats = ['All', ...Array.from(new Set(TRAILS_WITH_CHECKPOINTS.map((t) => t.category)))]
  const list = TRAILS_WITH_CHECKPOINTS.filter((t) => cat === 'All' || t.category === cat)

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Document trails</h1>
            <div className="head-sub">Transcribed from the office's process map — {TRAILS_WITH_CHECKPOINTS.length} documents</div>
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Documents mapped</div><div className="m-v">{TRAILS_WITH_CHECKPOINTS.length}</div></div>
          <div className="metric">
            <div className="m-l">Total steps</div>
            <div className="m-v">{TRAILS_WITH_CHECKPOINTS.reduce((n, t) => n + t.steps.length, 0)}</div>
          </div>
          <div className="metric">
            <div className="m-l">Longest trail</div>
            <div className="m-v">{Math.max(...TRAILS_WITH_CHECKPOINTS.map((t) => t.steps.length))} <small>steps</small></div>
          </div>
        </div>
      </div>

      <div className="body">
        <Note tone="quiet">
          Steps highlighted in <b>indigo</b> are the Provincial Agriculturist checkpoints. Where the office already
          wrote them into the process map they are kept verbatim; elsewhere the system inserts them so the behaviour
          is the same for every document.
        </Note>

        <div className="filter-row">
          <label htmlFor="cat">Category</label>
          <select id="cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c === 'All'
                  ? `All — ${TRAILS_WITH_CHECKPOINTS.length} documents`
                  : `${c} — ${TRAILS_WITH_CHECKPOINTS.filter((t) => t.category === c).length}`}
              </option>
            ))}
          </select>
          <span className="sub">{list.length} shown</span>
        </div>

        {list.map((t) => {
          const isOpenNow = open === t.code
          return (
            <Card
              key={t.code}
              title={`${t.name}${t.variant ? ` — ${t.variant}` : ''}`}
              subtitle={`${t.steps.length} steps · ${trailDays(t)} working days · reference number from ${t.refNumberOrigin ? TRAIL_OFFICES[t.refNumberOrigin] ?? t.refNumberOrigin : 'not issued'}`}
              action={
                <button className="btn sm" onClick={() => setOpen(isOpenNow ? null : t.code)}>
                  {isOpenNow ? 'Hide' : 'Show'} trail
                </button>
              }
            >
              <div className="facts" style={{ marginBottom: isOpenNow ? 14 : 0 }}>
                <div className="fact">
                  <div className="fact-l">Prerequisites</div>
                  <div className="fact-v">
                    {t.prerequisites.length ? t.prerequisites.join(' · ') : <span className="muted">None</span>}
                  </div>
                </div>
                <div className="fact">
                  <div className="fact-l">Final product</div>
                  <div className="fact-v">{t.finalProduct ?? <span className="muted">—</span>}</div>
                </div>
              </div>

              {t.ownedByOpag === false && (
                <div className="pill pill-neutral" style={{ marginBottom: 10 }}>
                  Handled entirely by {TRAIL_OFFICES[t.originOffice] ?? t.originOffice} — OPAg records start and finish only
                </div>
              )}
              {isOpenNow && (
                <ul className="trail">
                  {t.steps.map((s) => (
                    <li key={s.seq} className={s.isCheckpoint ? 'pending checkpoint' : 'pending'}>
                      <span className="n">{s.seq}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="what" style={{ color: 'var(--ink)' }}>{s.requirement}</div>
                        <div className="meta">
                          <span>{TRAIL_OFFICES[s.officeCode] ?? s.officeCode}</span>
                          <span>·</span>
                          <span>{SIGNATORY_LABEL[s.signatory]}</span>
                          {s.isCheckpoint && <span className="pill pill-accent">PA checkpoint</span>}
                        </div>
                      </div>
                      <div className="rt">
                        <div className="mono">{s.days != null ? `${s.days}d` : '—'}</div>
                        {s.outcome !== 'next' && (
                          <span className="pill pill-ok" style={{ marginTop: 4 }}>
                            {s.outcome === 'approved' ? 'Approved' : 'For release'}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
        {list.length === 0 && <Empty>No trails in this category.</Empty>}
      </div>
    </>
  )
}
