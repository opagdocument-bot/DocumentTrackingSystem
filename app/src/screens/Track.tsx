import { useState } from 'react'
import { Card, Empty } from '../components'
import { useStore } from '../store'
import { statusPhrase, trailFor } from '../lib/workflow'
import { IconMapPin, IconSearch } from '../icons'
import { useViewState } from '../lib/viewstate'

/**
 * Look a document up by the tracking code printed on it, rather than by
 * searching subjects and control numbers in the Registry. The code is the one
 * thing a caller on the phone, or a sticky note on someone's desk, is likely
 * to actually have.
 */
export function Track({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, lang } = useStore()
  const [code, setCode] = useViewState('track.code', '')
  const [searched, setSearched] = useState(false)

  const doc = db.docs.find((d) => d.trackingCode.toUpperCase() === code.trim().toUpperCase())

  function run() {
    setSearched(true)
  }

  return (
    <div className="body" style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 6 }}>Track a document</h1>
      <p className="muted" style={{ marginBottom: 22, fontSize: 13 }}>
        Enter the tracking code printed on the document.
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 22, justifyContent: 'center' }}>
        <input
          className="input mono" style={{ maxWidth: 220, textAlign: 'center', letterSpacing: '.04em' }}
          placeholder="TRK-XXXX-XXXX" value={code}
          onChange={(e) => { setCode(e.target.value); setSearched(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) run() }}
        />
        <button className="btn primary" disabled={!code.trim()} onClick={run}>
          <IconSearch size={14} /> Track
        </button>
      </div>

      {searched && (
        doc ? (
          <Card>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="ptag" style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                {trailFor(doc.trailCode)?.name}
              </span>
              <span className={`pill pill-${statusPhrase(doc).tone}`}>
                <span className="dot" />{lang === 'fil' ? statusPhrase(doc).fil : statusPhrase(doc).en}
              </span>
            </div>
            <h2 style={{ fontSize: 16, marginTop: 10, textAlign: 'left' }}>{doc.subject}</h2>
            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => onOpen(doc.id)}>Open full detail</button>
            </div>
          </Card>
        ) : (
          <Empty><IconMapPin size={16} /> No document found for that code.</Empty>
        )
      )}
    </div>
  )
}
