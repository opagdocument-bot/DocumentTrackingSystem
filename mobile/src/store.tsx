import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { TODAY, TRAIL_OFFICES, currentStep, liaisonLoad, makeDB, officeIdFor, users } from './shared'
import type { Doc, User } from './shared'
import { departed, makeEvent, receiptRecorded, stepDone } from '../../app/src/lib/transition'
import type { Actor, Proof } from '../../app/src/lib/transition'

// v2: bumped so a phone that already has this app open lands on the new
// empty-by-default state instead of the old sample documents — see the
// SeedMode note in app/src/data/seed.ts, which this mirrors.
const DOCS_KEY = 'subaybay.mobile.docs.v2'
const TOUCH_KEY = 'subaybay.mobile.touched.v2'
const SEEN_KEY = 'subaybay.mobile.seen.v2'

interface Ctx {
  ready: boolean
  me: User | null
  docs: Doc[]
  signIn: (username: string, password: string) => string | null
  signOut: () => void
  reset: () => void
  /** newly assigned and not yet acted on — drives My load's own NEW tag,
   *  which stays lit until the liaison actually does something, however many
   *  times she has glanced at the list. */
  isUntouched: (doc: Doc) => boolean
  /** not yet opened at its current step — drives the Notifications list,
   *  which a mere look at the document should clear. Keyed by step rather
   *  than by document alone, so a document that comes back for a second look
   *  is new again. */
  isUnseen: (doc: Doc) => boolean
  markSeen: (docId: string) => void
  depart: (docId: string) => void
  receive: (docId: string, receivedBy: string, proof: Proof) => void
  recordSigned: (docId: string, proof: Proof) => void
  addExternalRef: (docId: string, ref: { officeCode: string; label: string; number: string }) => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [docs, setDocs] = useState<Doc[]>([])
  const [userId, setUserId] = useState('')
  const [touched, setTouched] = useState<Record<string, true>>({})
  const [seen, setSeen] = useState<Record<string, number>>({})

  // AsyncStorage is a promise, so the app shows nothing until it has answered.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const fresh = makeDB('empty').docs
      try {
        // Documents are restored; the session deliberately is not. Every
        // launch starts at the login screen, so whoever picks up the phone
        // chooses the liaison they are testing as.
        const rawDocs = await AsyncStorage.getItem(DOCS_KEY)
        if (!alive) return
        const stored = rawDocs ? (JSON.parse(rawDocs) as Doc[]) : null
        setDocs(stored?.length ? stored : fresh)
      } catch {
        if (alive) setDocs(fresh)
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!ready) return
    AsyncStorage.setItem(DOCS_KEY, JSON.stringify(docs)).catch(() => {})
  }, [docs, ready])

  const me = useMemo(() => users.find((u) => u.id === userId) ?? null, [userId])

  const signIn = useCallback((username: string, password: string) => {
    const u = users.find(
      (x) => x.username === username.trim().toLowerCase() && x.password === password,
    )
    if (!u) return 'That username and password do not match an account.'
    // This app is the liaison's. Everyone else works from the web.
    if (u.roles[0] !== 'liaison') return `${u.name} is not a Liaison Officer. This app is for liaisons only.`
    setUserId(u.id)
    AsyncStorage.getItem(`${TOUCH_KEY}.${u.id}`)
      .then((t) => setTouched(t ? JSON.parse(t) : {}))
      .catch(() => {})
    AsyncStorage.getItem(`${SEEN_KEY}.${u.id}`)
      .then((s) => setSeen(s ? JSON.parse(s) : {}))
      .catch(() => {})
    return null
  }, [])

  const signOut = useCallback(() => {
    setUserId('')
    setTouched({})
    setSeen({})
  }, [])

  const reset = useCallback(() => {
    setDocs(makeDB('empty').docs)
    setTouched({})
    setSeen({})
    AsyncStorage.multiRemove([DOCS_KEY, `${TOUCH_KEY}.${userId}`, `${SEEN_KEY}.${userId}`]).catch(() => {})
  }, [userId])

  const isUntouched = useCallback((doc: Doc) => !touched[doc.id], [touched])

  const markTouched = useCallback((docId: string) => {
    setTouched((prev) => {
      if (prev[docId]) return prev
      const next = { ...prev, [docId]: true as const }
      AsyncStorage.setItem(`${TOUCH_KEY}.${userId}`, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [userId])

  const isUnseen = useCallback((doc: Doc) => seen[doc.id] !== doc.currentStepSeq, [seen])

  const markSeen = useCallback((docId: string) => {
    setSeen((prev) => {
      const doc = docs.find((d) => d.id === docId)
      if (!doc || prev[docId] === doc.currentStepSeq) return prev
      const next = { ...prev, [docId]: doc.currentStepSeq }
      AsyncStorage.setItem(`${SEEN_KEY}.${userId}`, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [docs, userId])

  /** Every update from this app is a liaison update, made on a phone. */
  const actor = useMemo<Actor>(() => ({ name: me?.name ?? 'Unknown', source: 'mobile' }), [me])

  const patch = useCallback((docId: string, fn: (d: Doc) => Doc) => {
    markTouched(docId)
    setDocs((prev) => prev.map((d) => (d.id === docId ? fn(d) : d)))
  }, [markTouched])

  const depart = useCallback((docId: string) => {
    patch(docId, (d) => {
      const step = currentStep(d)
      const where = step ? TRAIL_OFFICES[step.officeCode] ?? step.officeCode : 'the next office'
      return departed(d, actor, where)
    })
  }, [patch, actor])

  const receive = useCallback((docId: string, receivedBy: string, proof: Proof) => {
    patch(docId, (d) => receiptRecorded(d, actor, receivedBy, proof))
  }, [patch, actor])

  const recordSigned = useCallback((docId: string, proof: Proof) => {
    patch(docId, (d) => stepDone(d, actor, { proof }))
  }, [patch, actor])

  /**
   * A reference number issued by an outside office — a PR number from the
   * BAC, a Travel Order number from the Governor — recorded the moment the
   * liaison has it in hand, same as the web app's own addExternalRef.
   */
  const addExternalRef = useCallback((docId: string, ref: { officeCode: string; label: string; number: string }) => {
    patch(docId, (d) => ({
      ...d,
      externalRefs: [...(d.externalRefs ?? []), {
        id: `${d.id}-r${(d.externalRefs?.length ?? 0) + 1}`,
        officeCode: ref.officeCode, label: ref.label, number: ref.number,
        issuedAt: TODAY, recordedBy: actor.name,
      }],
      refNumber: d.refNumber ?? ref.number,
      events: [...d.events, makeEvent(d, actor, 'REFERENCE_RECORDED', { note: `${ref.label}: ${ref.number} (${ref.officeCode})` })],
    }))
  }, [patch, actor])

  const value: Ctx = {
    ready, me, docs, signIn, signOut, reset, isUntouched, isUnseen, markSeen, depart, receive, recordSigned, addExternalRef,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}

/** This liaison's load, straight from the shared rule. */
export function useMyLoad() {
  const { docs, me } = useStore()
  return useMemo(() => (me ? liaisonLoad(docs, me.id) : []), [docs, me])
}

export { officeIdFor }
