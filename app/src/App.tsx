import { useEffect, useRef, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { ROLE_LABEL, TODAY, currentStep, custodyOf, isOpen, liaisonLoad, onPaDesk } from './lib/workflow'
import { Dashboard } from './screens/Dashboard'
import { Registry } from './screens/Registry'
import { Review } from './screens/Review'
import { Liaison } from './screens/Liaison'
import { PaDesk } from './screens/PaDesk'
import { DocumentDetail } from './screens/DocumentDetail'
import { Trails } from './screens/Trails'
import { Chains } from './screens/Chains'
import { Login } from './screens/Login'
import { Notifications } from './components'
import { Intake } from './screens/Intake'
import { ReceiveRelease } from './screens/ReceiveRelease'
import { Reports } from './screens/Reports'
import { Track } from './screens/Track'
import {
  IconAlert, IconBarChart, IconCheckSquare, IconFilePlus, IconFolder, IconGrid,
  IconInbox, IconLayers, IconLogOut, IconSearch, IconTruck, IconUser,
} from './icons'
import type { Role } from './types'

export type View =
  | 'dashboard' | 'registry' | 'intake' | 'review' | 'liaison' | 'padesk'
  | 'trails' | 'chains' | 'receive_release' | 'reports' | 'track' | 'doc'

/**
 * Per-role navigation, transcribed from the SUBAYBAY UI Design canvas
 * (Supporting Files/UI design for applications). Chains and Trails predate
 * that canvas and aren't in it, but nothing there asked for them to be
 * removed, so they stay on as a Reference group beneath the roles that
 * already had them.
 */
const NAV: Record<Role, { group: string; items: View[] }[]> = {
  encoder: [
    { group: 'My work', items: ['dashboard', 'review', 'receive_release'] },
    { group: 'Documents', items: ['registry', 'reports', 'chains'] },
    { group: 'Reference', items: ['trails'] },
  ],
  liaison: [
    { group: 'Field', items: ['liaison'] },
    { group: 'Documents', items: ['registry'] },
    { group: 'Reference', items: ['trails'] },
  ],
  pa: [
    { group: 'Oversight', items: ['padesk'] },
    { group: 'Documents', items: ['registry', 'reports', 'chains'] },
    { group: 'Reference', items: ['trails'] },
  ],
  viewer: [
    { group: 'Track', items: ['track'] },
    { group: 'Documents', items: ['registry', 'reports', 'chains'] },
    { group: 'Reference', items: ['trails'] },
  ],
}

export const META: Record<View, { label: string; title: string; sub: string; icon: typeof IconGrid }> = {
  dashboard: { label: 'Dashboard', title: 'Dashboard', sub: 'Where every document stands today', icon: IconGrid },
  intake:    { label: 'Register', title: 'Register a document', sub: 'Control number is issued on save', icon: IconFilePlus },
  review:    { label: 'Review queue', title: 'Review queue', sub: 'Check prerequisites before the trail starts', icon: IconCheckSquare },
  liaison:   { label: 'My load', title: 'My load', sub: 'Documents in your custody', icon: IconTruck },
  padesk:    { label: 'My table', title: 'Provincial Agriculturist', sub: 'Oversight of every document', icon: IconUser },
  registry:  { label: 'Registry', title: 'Registry', sub: 'Every document the office has logged', icon: IconFolder },
  chains:    { label: 'Chains', title: 'Document chains', sub: 'Transactions that span several documents', icon: IconLayers },
  trails:    { label: 'Document trails', title: 'Document trails', sub: "The office's process map, as the system reads it", icon: IconLayers },
  receive_release: { label: 'Receive & release', title: 'Receive & release', sub: 'Documents crossing the office threshold, either direction', icon: IconInbox },
  reports:   { label: 'Reports', title: 'Reports', sub: 'Aging, bottlenecks and liaison activity', icon: IconBarChart },
  track:     { label: 'Track', title: 'Track a document', sub: 'Look a document up by its tracking code', icon: IconSearch },
  doc:       { label: 'Document', title: 'Document', sub: '', icon: IconFolder },
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

/** Where the user is: a screen, and the document open on it, if any. */
type Loc = { view: View; docId: string | null }

function Shell() {
  const { db, role, userId, isAuthed, lang, signOut, setLang, reset, seedMode, setSeedMode, currentUser } = useStore()
  const [loc, setLoc] = useState<Loc>({ view: 'dashboard', docId: null })
  const [q, setQ] = useState('')

  /**
   * How the user got here.
   *
   * Opening a document pushes the screen it was opened from, so Back returns
   * there — including document to document, which unwinds one step at a time.
   * Choosing a screen from the sidebar starts a fresh path: you asked for that
   * screen, not for a step backwards.
   */
  const [stack, setStack] = useState<Loc[]>([])
  const [registering, setRegistering] = useState(false)

  /** Light or dark, remembered. The tokens in styles.css do the rest. */
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('subaybay.theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('subaybay.theme', theme) } catch { /* ignore */ }
  }, [theme])
  const setTheme = (t: 'light' | 'dark') => setThemeState(t)

  /** The "/" hint in the search box has to actually do something. */
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { view, docId } = loc
  const groups = NAV[role]
  const flat = groups.flatMap((g) => g.items)
  const active = flat.includes(view) ? view : flat[0]
  const me = currentUser()
  const today = new Date(TODAY + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  function go(v: View) { setStack([]); setLoc({ view: v, docId: null }) }
  function open(id: string) { setStack((s) => [...s, loc]); setLoc({ view: 'doc', docId: id }) }

  function back() {
    const prev = stack[stack.length - 1]
    setStack((s) => s.slice(0, -1))
    setLoc(prev ?? { view: flat[0], docId: null })
  }

  // While a document is open, keep the screen it came from lit in the sidebar,
  // so it is visible where Back will land.
  const lit = docId ? (stack[0]?.view ?? active) : active

  const counts: Partial<Record<View, number>> = {
    review: db.docs.filter((d) => d.status === 'FOR_REVIEW' || d.status === 'AT_PA').length,
    liaison: liaisonLoad(db.docs, userId).length,
    padesk: onPaDesk(db.docs).length,
    registry: db.docs.length,
    trails: db.types.length,
    receive_release: db.docs.filter((d) => d.status === 'FOR_RELEASE'
      || (isOpen(d) && custodyOf(d) === 'office' && (d.status === 'RETURNED_EXT'
        || (d.status === 'AT_OFFICE' && currentStep(d)?.kind === 'record_receipt')))).length,
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="side-brand">
          <div className="mark">SB</div>
          <div className="side-brand-copy">
            <b>Provincial Agriculturist</b>
            <span>Document Tracking</span>
          </div>
        </div>

        <nav className="side-nav">
          {groups.map((g) => (
            <div key={g.group}>
              <h4>{g.group}</h4>
              {g.items.map((v) => {
                const Icon = META[v].icon
                return (
                  <button key={v} className={lit === v ? 'on' : ''} onClick={() => go(v)}>
                    <Icon size={15} />
                    <span>{META[v].label}</span>
                    {counts[v] != null && <span className="count">{counts[v]}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <div className="seed-switch">
            <span>Demo data</span>
            <div className="seg">
              <button className={seedMode === 'empty' ? 'on' : ''}
                title="No documents — the real starting point for the office"
                onClick={() => { setSeedMode('empty'); go('dashboard') }}>Empty</button>
              <button className={seedMode === 'walkthrough' ? 'on' : ''}
                title="One document per role — enough to follow a document end to end"
                onClick={() => { setSeedMode('walkthrough'); go('dashboard') }}>1 per role</button>
              <button className={seedMode === 'full' ? 'on' : ''}
                title="The full office sample — 35 documents across every type"
                onClick={() => { setSeedMode('full'); go('dashboard') }}>Full set</button>
            </div>
          </div>
          <button onClick={() => { if (confirm('Clear every document and start over?')) { reset(); go('dashboard') } }}>
            <IconAlert size={14} /> Reset demo data
          </button>
          <button onClick={() => { signOut(); setStack([]); setLoc({ view: 'dashboard', docId: null }) }}>
            <IconLogOut size={14} /> Sign out
          </button>
          <div className="side-user">
            <div className="av">{initials(me.name)}</div>
            <div style={{ minWidth: 0 }}>
              <b>{me.name}</b>
              <span>{me.position}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="crumb">
            <span className="muted">Province of Aurora</span>
            <span className="sep">›</span>
            <span>OPAg</span>
          </div>
          <span className="spacer" />
          <div className="search">
            <IconSearch size={14} />
            <input
              ref={searchRef}
              placeholder="Search tracking code, subject, or office" value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go('registry') }}
            />
            <span className="slash">/</span>
          </div>
          <time className="top-date">{today}</time>
          <div className="seg">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button>
          </div>
          <div className="seg">
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'fil' ? 'on' : ''} onClick={() => setLang('fil')}>FIL</button>
          </div>
          {role === 'liaison' && <Notifications onOpen={open} />}
          <div className="signed-in">
            <div className="av">{initials(me.name)}</div>
            <div className="who">
              <b>{me.name}</b>
              <span>{ROLE_LABEL[role]}</span>
            </div>
          </div>
          {/* Dashboard carries its own "Register a document" button in its
              head-top; showing this one there too was a plain duplicate.
              Every other screen still needs it — it's the only way in. */}
          {role === 'encoder' && active !== 'dashboard' && (
            <button className="btn primary" onClick={() => setRegistering(true)}>
              <IconFilePlus size={14} /> Encode document
            </button>
          )}
        </div>

        <div className="view" key={docId ?? active}>
        {docId ? (
          <DocumentDetail id={docId} onBack={back} onOpen={open} />
        ) : active === 'dashboard' ? (
          <Dashboard onOpen={open} onGo={go} onRegister={() => setRegistering(true)} />
        ) : active === 'registry' ? (
          <Registry onOpen={open} initialQuery={q} />
        ) : active === 'review' ? (
          <Review onOpen={open} />
        ) : active === 'padesk' ? (
          <PaDesk onOpen={open} />
        ) : active === 'trails' ? (
          <Trails />
        ) : active === 'chains' ? (
          <Chains onOpen={open} />
        ) : active === 'receive_release' ? (
          <ReceiveRelease onOpen={open} />
        ) : active === 'reports' ? (
          <Reports />
        ) : active === 'track' ? (
          <Track onOpen={open} />
        ) : (
          <Liaison onOpen={open} />
        )}
        </div>
      </div>

      {registering && (
        <Intake
          onClose={() => setRegistering(false)}
          onCreated={(id) => { setRegistering(false); open(id) }}
        />
      )}
    </div>
  )
}

function Gate() {
  const { isAuthed } = useStore()
  return isAuthed ? <Shell /> : <Login />
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  )
}
