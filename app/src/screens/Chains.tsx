import { useMemo } from 'react'
import { Card, Empty, Note, StatusPill, Waffle } from '../components'
import { useStore } from '../store'
import { CHAINS, chainDays, chainSteps } from '../data/trail'
import type { Chain } from '../data/trail'
import { SIGNATORY_LABEL, TRAIL_OFFICES, currentStep, daysAtCurrentStep, isOpen, trailDays, trailFor } from '../lib/workflow'
import { IconArrowRight, IconCheck, IconClock } from '../icons'
import type { Doc } from '../types'
import { useViewState } from '../lib/viewstate'

/**
 * Chains view. Procurement is one continuous transaction spanning several
 * documents; this is the screen that answers "where is my purchase?" with a
 * single answer rather than seven.
 */
export function Chains({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, programOf } = useStore()
  const [sel, setSel] = useViewState<string>('chains.sel', 'PROCUREMENT')
  const chain = CHAINS.find((c) => c.code === sel)!

  /** Group documents in this chain by program + activity, as a rough case key. */
  const cases = useMemo(() => {
    const inChain = db.docs.filter((d) => chain.sequence.includes(d.trailCode))
    const m = new Map<string, Doc[]>()
    for (const d of inChain) {
      const key = `${d.programId}::${d.fields.activity_name || d.subject.slice(0, 28)}`
      ;(m.get(key) ?? m.set(key, []).get(key)!).push(d)
    }
    return [...m.entries()]
      .map(([key, docs]) => ({
        key,
        docs: docs.sort((a, b) => chain.sequence.indexOf(a.trailCode) - chain.sequence.indexOf(b.trailCode)),
        label: docs[0].fields.activity_name || docs[0].subject,
        program: programOf(docs[0]),
        open: docs.some(isOpen),
      }))
      .sort((a, b) => Number(b.open) - Number(a.open) || b.docs.length - a.docs.length)
  }, [db.docs, chain, programOf])

  return (
    <>
      <div className="head">
        <div className="head-top">
          <div>
            <h1>Document chains</h1>
            <div className="head-sub">Transactions that span several documents</div>
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Documents in chain</div><div className="m-v">{chain.sequence.length}</div></div>
          <div className="metric"><div className="m-l">Total steps</div><div className="m-v">{chainSteps(chain)}</div></div>
          <div className="metric"><div className="m-l">Budgeted duration</div><div className="m-v">{chainDays(chain)} <small>working days</small></div></div>
          <div className="metric"><div className="m-l">Cases seen</div><div className="m-v">{cases.length}</div></div>
        </div>
      </div>

      <div className="tabs">
        {CHAINS.map((c) => (
          <button key={c.code} className={sel === c.code ? 'on' : ''} onClick={() => setSel(c.code)}>
            {c.name} <span className="n">{c.sequence.length}</span>
          </button>
        ))}
      </div>

      <div className="body">
        <Note tone="info">{chain.description}</Note>

        <Card title="The chain" subtitle="Each document depends on the ones before it">
          <div className="chain-flow">
            {chain.sequence.map((code, i) => {
              const t = trailFor(code)
              if (!t) return null
              return (
                <div className="chain-node" key={code}>
                  <div className="cn-box">
                    <div className="cn-code mono">{code}</div>
                    <div className="cn-name">{t.name}</div>
                    <div className="cn-meta">{t.steps.length} steps · {trailDays(t)}d</div>
                    {t.refNumberOrigin && (
                      <div className="cn-ref">no. from {t.refNumberOrigin}</div>
                    )}
                  </div>
                  {i < chain.sequence.length - 1 && <IconArrowRight size={15} className="cn-arrow" />}
                </div>
              )
            })}
          </div>
        </Card>

        <Card title="Cases in progress" subtitle="Documents grouped by program and activity" flush>
          {cases.length === 0 ? <Empty>No documents in this chain yet.</Empty> : (
            <div style={{ padding: '4px 15px 15px' }}>
              {cases.map((c) => {
                const present = new Set(c.docs.map((d) => d.trailCode))
                const done = c.docs.filter((d) => !isOpen(d)).length
                return (
                  <div key={c.key} className="case">
                    <div className="case-h">
                      <span className="ptag"><i style={{ background: c.program.color }} />{c.program.code}</span>
                      <b>{c.label}</b>
                      <span className="spacer" />
                      <span className={`pill ${c.open ? 'pill-accent' : 'pill-ok'}`}>
                        {c.open ? 'In progress' : 'Complete'}
                      </span>
                      <span className="mono muted">{done}/{c.docs.length} closed</span>
                    </div>

                    <div className="case-track">
                      {chain.sequence.map((code) => {
                        const d = c.docs.find((x) => x.trailCode === code)
                        const state = !d ? 'missing' : isOpen(d) ? 'active' : 'done'
                        return (
                          <button
                            key={code}
                            className={`case-step ${state}`}
                            disabled={!d}
                            onClick={() => d && onOpen(d.id)}
                            title={d ? `${d.controlNo} — ${currentStep(d)?.requirement ?? 'complete'}` : `${code} not yet created`}
                          >
                            <span className="mono">{code}</span>
                            {d && <Waffle doc={d} small />}
                          </button>
                        )
                      })}
                    </div>

                    {c.docs.filter(isOpen).map((d) => {
                      const s = currentStep(d)
                      return (
                        <div className="case-now" key={d.id} onClick={() => onOpen(d.id)}>
                          <IconClock size={13} className="cn-ico" />
                          <span className="mono cn-no">{d.controlNo}</span>
                          <span className="cn-what">{s?.requirement ?? '—'}</span>
                          <span className="muted cn-office">{s ? TRAIL_OFFICES[s.officeCode] ?? s.officeCode : ''}</span>
                          <span className="spacer" />
                          <StatusPill doc={d} />
                          <span className={`age ${daysAtCurrentStep(d) > 5 ? 'age-breach' : 'age-ok'}`}>{daysAtCurrentStep(d)}d</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
