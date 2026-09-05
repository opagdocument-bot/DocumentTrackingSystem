import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DB, Doc, DocEvent, Role, Status, StepLog, Transmittal } from './types'
import { liaisonFor, makeDB, officeIdFor } from './data/seed'
import type { SeedMode } from './data/seed'
import { TRAIL_OFFICES, trailFor } from './data/trail'
import { TODAY, currentStep, issuesOwnRefNumber, makeTrackingCode, nextControlNo, paperNumber, statusForStep, stepsOf } from './lib/workflow'
import { clearViewState } from './lib/viewstate'
import { departed, receiptRecorded, stepDone } from './lib/transition'
import type { Actor } from './lib/transition'

// v7 / .v2: bumped together so every browser that already had this open lands
// on the new empty-by-default state instead of its old accumulated sample
// documents and seed-mode choice — see the SeedMode note in data/seed.ts.
const KEY = 'subaybay.prototype.v7'
const LANG_KEY = 'subaybay.lang'
const SEED_KEY = 'subaybay.seed.v2'
const SEEN_KEY = 'subaybay.seen'
const TOUCH_KEY = 'subaybay.touched'

/**
 * Which documents this person has already opened, and at which step.
 *
 * Keyed by step rather than by document alone: a Purchase Request that comes
 * back to the Provincial Agriculturist for a second signature is new again, and
 * should say so. Kept per user and in storage, or everything would look new
 * after every sign-in.
 */
function readSeen(userId: string): Record<string, number> {
  if (!userId) return {}
  try { return JSON.parse(localStorage.getItem(`${SEEN_KEY}.${userId}`) ?? '{}') } catch { return {} }
}

function readSeedMode(): SeedMode {
  try {
    const stored = localStorage.getItem(SEED_KEY)
    return stored === 'full' || stored === 'walkthrough' ? stored : 'empty'
  } catch { return 'empty' }
}

/**
 * Reference data — people, offices, programs, document types — always comes
 * from code, never from storage. Only the things a user changes (documents and
 * transmittals) are restored. Without this, editing a name or adding an office
 * would need the tester to wipe their session to see it.
 */
function load(): DB {
  const fresh = makeDB(readSeedMode())
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<DB>
      return {
        ...fresh,
        docs: stored.docs?.length ? stored.docs : fresh.docs,
        transmittals: stored.transmittals ?? fresh.transmittals,
      }
    }
  } catch {
    /* fall through to a fresh seed */
  }
  return fresh
}

/**
 * Documents this person has actually done something to.
 *
 * A liaison's "new" is not the Provincial Agriculturist's. His clears when he
 * opens the paper; hers clears when she *acts* on it — leaves with it, records
 * a receipt, records a signature. Until then it is a new assignment, however
 * many times she has glanced at the list.
 */
function readTouched(userId: string): Record<string, true> {
  if (!userId) return {}
  try { return JSON.parse(localStorage.getItem(`${TOUCH_KEY}.${userId}`) ?? '{}') } catch { return {} }
}

interface Ctx {
  db: DB
  role: Role
  userId: string
  isAuthed: boolean
  lang: 'en' | 'fil'
  signIn: (username: string, password: string) => boolean
  signOut: () => void
  setLang: (l: 'en' | 'fil') => void
  reset: () => void
  seedMode: SeedMode
  setSeedMode: (m: SeedMode) => void
  /** has this person not yet opened the document at the step it is on now? */
  isUnseen: (doc: Doc) => boolean
  markSeen: (docId: string) => void
  /** newly assigned to this person and not yet acted on */
  isUntouched: (doc: Doc) => boolean
  currentUser: () => DB['users'][number]
  typeOf: (doc: Doc) => DB['types'][number]
  programOf: (doc: Doc) => DB['programs'][number]
  officeName: (id: string) => string
  /** advance to the next step of the trail */
  advance: (docId: string, note?: string, proofFileName?: string, thumb?: string) => void
  returnDoc: (docId: string, note: string) => void
  hold: (docId: string, note: string) => void
  resume: (docId: string) => void
  submit: (docId: string) => void
  receive: (docId: string, receivedByName: string, proofFileName: string, thumb?: string) => void
  /** the liaison has left OPAg with it, en route to the next office */
  depart: (docId: string) => void
  setPrereqs: (docId: string, docIds: string[], manual: string[]) => void
  addExternalRef: (docId: string, ref: { officeCode: string; label: string; number: string }) => void
  poke: (docId: string, note: string) => void
  assignLiaison: (docId: string, liaisonId: string) => void
  removeExternalRef: (docId: string, refId: string) => void
  addDoc: (input: {
    trailCode: string
    programId: string
    subject: string
    fields: Record<string, string>
    directive?: Doc['directive']
    disposition: 'pa' | 'release'
    liaisonId?: string
    amount?: number
    followsId?: string
    prereqDocIds?: string[]
    prereqManual?: string[]
  }) => string
  addFile: (docId: string, pageRole: Doc['files'][number]['pageRole']) => void
  cancelDoc: (docId: string, reason: string, fileName: string, thumb?: string) => void
  createTransmittal: (toOfficeId: string, docIds: string[]) => string
  receiveTransmittal: (id: string, receivedByName: string, proofFileName: string, thumb?: string) => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  // Every visit starts at the login page. The session is deliberately not
  // restored: this is a demonstration people hand around, and whoever opens it
  // should choose the role they are testing rather than inherit the last one.
  const [userId, setUserId] = useState<string>('')
  const [lang, setLangState] = useState<'en' | 'fil'>(() => {
    try { return (localStorage.getItem(LANG_KEY) as 'en' | 'fil') ?? 'en' } catch { return 'en' }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage unavailable */ }
  }, [db])

  const setLang = useCallback((l: 'en' | 'fil') => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ }
  }, [])

  const me = db.users.find((u) => u.id === userId)
  const role: Role = me?.roles[0] ?? 'viewer'
  const isAuthed = Boolean(me)

  const signIn = useCallback((username: string, password: string) => {
    const u = db.users.find(
      (x) => x.username === username.trim().toLowerCase() && x.password === password,
    )
    if (!u) return false
    setUserId(u.id)
    return true
  }, [db.users])

  const signOut = useCallback(() => {
    setUserId('')
    clearViewState()
  }, [])

  const [seedMode, setSeedModeState] = useState<SeedMode>(readSeedMode)

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    setDb(makeDB(seedMode))
  }, [seedMode])

  /**
   * Switch between the one-document-per-role walkthrough and the full demo set.
   * Swapping the documents underneath means dropping whatever was stored, so
   * this reloads the chosen set from code rather than merging the two.
   */
  const setSeedMode = useCallback((m: SeedMode) => {
    setSeedModeState(m)
    try {
      localStorage.setItem(SEED_KEY, m)
      localStorage.removeItem(KEY)
    } catch { /* ignore */ }
    setDb(makeDB(m))
  }, [])

  const [seen, setSeen] = useState<Record<string, number>>(() => readSeen(userId))

  // Someone else signs in, someone else's history.
  useEffect(() => { setSeen(readSeen(userId)) }, [userId])

  const isUnseen = useCallback((doc: Doc) => seen[doc.id] !== doc.currentStepSeq, [seen])

  const markSeen = useCallback((docId: string) => {
    setSeen((prev) => {
      const doc = db.docs.find((d) => d.id === docId)
      if (!doc || prev[docId] === doc.currentStepSeq) return prev
      const next = { ...prev, [docId]: doc.currentStepSeq }
      try { localStorage.setItem(`${SEEN_KEY}.${userId}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [db.docs, userId])

  const [touched, setTouched] = useState<Record<string, true>>(() => readTouched(userId))
  useEffect(() => { setTouched(readTouched(userId)) }, [userId])

  const isUntouched = useCallback((doc: Doc) => !touched[doc.id], [touched])

  const markTouched = useCallback((docId: string) => {
    setTouched((prev) => {
      if (prev[docId]) return prev
      const next = { ...prev, [docId]: true as const }
      try { localStorage.setItem(`${TOUCH_KEY}.${userId}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [userId])

  const patchDoc = useCallback((docId: string, fn: (d: Doc) => Doc) => {
    // Whoever is signed in has now handled this document.
    markTouched(docId)
    setDb((prev) => ({ ...prev, docs: prev.docs.map((d) => (d.id === docId ? fn(d) : d)) }))
  }, [markTouched])

  const actorName = useCallback(
    () => db.users.find((u) => u.id === userId)?.name ?? 'Unknown',
    [db.users, userId],
  )

  /** Who is recording, and from what — liaison updates come from the phone. */
  const whoAmI = useCallback((): Actor => ({
    name: actorName(),
    source: role === 'liaison' ? 'mobile' : 'web',
  }), [actorName, role])

  const ev = (d: Doc, who: string, type: string, to?: Status, note?: string, stepSeq?: number): DocEvent => ({
    id: `${d.id}-e${d.events.length + 1}`,
    at: TODAY, actorName: who, type, from: d.status, to, note, stepSeq,
    source: role === 'liaison' ? 'mobile' : 'web',
  })

  const submit = useCallback((docId: string) => {
    const who = actorName()
    patchDoc(docId, (d) => ({
      ...d, status: 'FOR_REVIEW', deficiency: undefined,
      events: [...d.events, ev(d, who, 'SUBMITTED', 'FOR_REVIEW')],
    }))
  }, [actorName, patchDoc, role])

  /**
   * A photograph of the paper, filed against the document.
   *
   * Every liaison update outside the office carries one: the office's rule is
   * that custody is never a matter of somebody's word. Built here so the file
   * and the status change land in the same update and cannot come apart.
   */
  const proofFile = (d: Doc, name: string, thumb?: string): Doc['files'][number] => ({
    id: `${d.id}-f${d.files.length + 1}`,
    name,
    pageRole: 'receiving_stamp' as const,
    sizeKb: 180 + Math.floor(Math.random() * 140),
    capturedAt: TODAY,
    thumb,
  })

  /**
   * Advance one step along the trail. Records the step, then computes the
   * status of the step it lands on — which is what puts documents on the PA's
   * desk automatically at every record_in / PA-signature step.
   */
  const advance = useCallback((docId: string, note?: string, proofFileName?: string, thumb?: string) => {
    const actor = whoAmI()
    patchDoc(docId, (d) => stepDone(d, actor, {
      note,
      proof: proofFileName ? { name: proofFileName, thumb } : undefined,
    }))
  }, [whoAmI, patchDoc])

  const returnDoc = useCallback((docId: string, note: string) => {
    const who = actorName()
    patchDoc(docId, (d) => {
      const step = currentStep(d)
      const external = step && step.officeCode !== 'OPAG'
      const log: StepLog | null = step ? { seq: step.seq, at: TODAY, actorName: who, outcome: 'returned', note } : null
      return {
        ...d,
        status: external ? 'RETURNED_EXT' : 'RETURNED',
        deficiency: note,
        currentOfficeId: officeIdFor('OPAG'),
        currentHolderName: undefined,
        stepLog: log ? [...d.stepLog, log] : d.stepLog,
        events: [...d.events, ev(d, who, 'RETURNED', external ? 'RETURNED_EXT' : 'RETURNED', note, step?.seq)],
      }
    })
  }, [actorName, patchDoc, role])

  const hold = useCallback((docId: string, note: string) => {
    const who = actorName()
    patchDoc(docId, (d) => ({ ...d, status: 'ON_HOLD', events: [...d.events, ev(d, who, 'HELD', 'ON_HOLD', note)] }))
  }, [actorName, patchDoc, role])

  const resume = useCallback((docId: string) => {
    const who = actorName()
    patchDoc(docId, (d) => {
      const status = statusForStep(currentStep(d))
      return { ...d, status, events: [...d.events, ev(d, who, 'RESUMED', status)] }
    })
  }, [actorName, patchDoc, role])

  const receive = useCallback((docId: string, receivedByName: string, proofFileName: string, thumb?: string) => {
    const actor = whoAmI()
    patchDoc(docId, (d) => receiptRecorded(d, actor, receivedByName, { name: proofFileName, thumb }))
  }, [whoAmI, patchDoc])

  const setPrereqs = useCallback((docId: string, docIds: string[], manual: string[]) => {
    patchDoc(docId, (d) => ({ ...d, prereqDocIds: docIds, prereqManual: manual }))
  }, [patchDoc])

  const addExternalRef = useCallback<Ctx['addExternalRef']>((docId, ref) => {
    const who = actorName()
    patchDoc(docId, (d) => ({
      ...d,
      externalRefs: [...(d.externalRefs ?? []), {
        id: `${d.id}-r${(d.externalRefs?.length ?? 0) + 1}`,
        officeCode: ref.officeCode, label: ref.label, number: ref.number,
        issuedAt: TODAY, recordedBy: who,
      }],
      refNumber: d.refNumber ?? ref.number,
      events: [...d.events, ev(d, who, 'REFERENCE_RECORDED', undefined, `${ref.label}: ${ref.number} (${ref.officeCode})`)],
    }))
  }, [actorName, patchDoc, role])

  const removeExternalRef = useCallback<Ctx['removeExternalRef']>((docId, refId) => {
    patchDoc(docId, (d) => ({ ...d, externalRefs: (d.externalRefs ?? []).filter((r) => r.id !== refId) }))
  }, [patchDoc])

  const poke = useCallback((docId: string, note: string) => {
    const who = actorName()
    patchDoc(docId, (d) => ({
      ...d,
      pokes: [...(d.pokes ?? []), {
        id: 'p' + ((d.pokes?.length ?? 0) + 1), at: TODAY, by: who,
        toHandler: d.currentHolderName ?? 'the current handler', note,
      }],
      events: [...d.events, ev(d, who, 'FOLLOW_UP', undefined, note)],
    }))
  }, [actorName, patchDoc, role])

  const assignLiaison = useCallback((docId: string, liaisonId: string) => {
    const who = actorName()
    patchDoc(docId, (d) => ({ ...d, assignedLiaisonId: liaisonId, events: [...d.events, ev(d, who, 'ASSIGNED', undefined, 'Assigned to a liaison')] }))
  }, [actorName, patchDoc, role])

  const addDoc = useCallback<Ctx['addDoc']>((input) => {
    const id = `d-new-${Date.now()}`
    setDb((prev) => {
      const trail = trailFor(input.trailCode)!
      // Every document gets the office's own number. For the types this office
      // numbers itself, the paper carries the tail of that same number — derived
      // from it rather than counted separately, so the two cannot drift apart.
      const controlNo = nextControlNo(prev.docs, trail.code, TODAY)

      /**
       * The encoder's disposition decides where the document goes the moment it
       * is registered — onto the PA's table, or out of the office — so the trail
       * is entered at the first step that matches that choice rather than always
       * at step one. Steps before it are left unrecorded rather than marked
       * done: the system will not claim a signature it did not see.
       */
      const steps = trail.steps
      const landing = input.disposition === 'release'
        ? steps.find((s) => s.officeCode !== 'OPAG')
        : steps.find((s) => s.kind === 'record_in' || s.signatory === 'provincial_agriculturist')
      const step = landing ?? steps[0]
      const status: Status = landing
        ? (input.disposition === 'release' ? 'FOR_RELEASE' : 'AT_PA')
        : statusForStep(step)

      const doc: Doc = {
        id,
        controlNo,
        refNumber: issuesOwnRefNumber(trail.code) ? paperNumber(controlNo) : undefined,
        trackingCode: makeTrackingCode(),
        trailCode: trail.code,
        programId: input.programId,
        subject: input.subject,
        amount: input.amount,
        directive: input.directive,
        disposition: input.disposition,
        status,
        currentStepSeq: step?.seq ?? 1,
        stepLog: [],
        currentOfficeId: officeIdFor(step?.officeCode ?? 'OPAG'),
        currentHolderName: status === 'AT_PA' ? 'Provincial Agriculturist' : undefined,
        createdBy: userId,
        createdAt: TODAY,
        fields: input.fields,
        prereqDocIds: input.prereqDocIds ?? [],
        prereqManual: input.prereqManual ?? [],
        externalRefs: [],
        pokes: [],
        // The encoder may name the carrier; the assignment matrix is the default.
        assignedLiaisonId: input.liaisonId ?? liaisonFor(trail.code, input.fields.supply_category)?.id,
        followsId: input.followsId,
        files: [],
        events: [{
          id: `${id}-e1`, at: TODAY, actorName: actorName(), type: 'REGISTERED', to: status, source: 'web',
          note: input.disposition === 'release'
            ? 'Registered for release'
            : 'Registered for signature of the Provincial Agriculturist',
        }],
      }
      return { ...prev, docs: [doc, ...prev.docs] }
    })
    return id
  }, [actorName, userId])

  const addFile = useCallback((docId: string, pageRole: Doc['files'][number]['pageRole']) => {
    const who = actorName()
    patchDoc(docId, (d) => ({
      ...d,
      files: [...d.files, {
        id: `${d.id}-f${d.files.length + 1}`,
        name: `${d.controlNo}-${pageRole}.jpg`,
        pageRole, sizeKb: 180 + Math.floor(Math.random() * 140), capturedAt: TODAY,
      }],
      events: [...d.events, { id: `${d.id}-e${d.events.length + 1}`, at: TODAY, actorName: who, type: 'SCANNED', note: `${pageRole} page captured`, source: 'mobile' }],
    }))
  }, [actorName, patchDoc])

  /**
   * Cancel a document that was disapproved.
   *
   * The reason and the photo of the stamped paper are written in the same
   * update as the status, so a cancelled document can never exist in the
   * registry without the evidence that justifies it.
   */
  const cancelDoc = useCallback<Ctx['cancelDoc']>((docId, reason, fileName, thumb) => {
    const who = actorName()
    patchDoc(docId, (d) => ({
      ...d,
      status: 'CANCELLED' as Status,
      cancelReason: reason,
      completedAt: TODAY,
      currentHolderName: undefined,
      files: [...d.files, {
        id: `${d.id}-f${d.files.length + 1}`,
        name: fileName,
        pageRole: 'cancelled' as const,
        sizeKb: 180 + Math.floor(Math.random() * 140),
        capturedAt: TODAY,
        thumb,
      }],
      events: [...d.events, { ...ev(d, who, 'CANCELLED', 'CANCELLED' as Status, reason), fileId: `${d.id}-f${d.files.length + 1}` }],
    }))
  }, [actorName, patchDoc])

  const depart = useCallback<Ctx['depart']>((docId) => {
    const actor = whoAmI()
    patchDoc(docId, (d) => {
      const step = currentStep(d)
      const where = step ? TRAIL_OFFICES[step.officeCode] ?? step.officeCode : 'the next office'
      return departed(d, actor, where)
    })
  }, [whoAmI, patchDoc])

  const createTransmittal = useCallback<Ctx['createTransmittal']>((toOfficeId, docIds) => {
    const id = `tr-${Date.now()}`
    const who = actorName()
    setDb((prev) => {
      const no = `OPA-TRN-2026-${String(200 + prev.transmittals.length + 1)}`
      const t: Transmittal = { id, no, liaisonId: userId, toOfficeId, docIds, releasedAt: TODAY, status: 'RELEASED' }
      docIds.forEach(markTouched)
      return {
        ...prev,
        transmittals: [t, ...prev.transmittals],
        docs: prev.docs.map((d) => docIds.includes(d.id) ? {
          ...d,
          status: 'IN_TRANSIT' as Status,
          currentOfficeId: toOfficeId,
          currentHolderName: `Liaison — ${who}`,
          events: [...d.events, {
            id: `${d.id}-e${d.events.length + 1}`, at: TODAY, actorName: who,
            type: 'RELEASED', to: 'IN_TRANSIT' as Status, note: `Transmittal ${no}`, source: 'mobile' as const,
          }],
        } : d),
      }
    })
    return id
  }, [actorName, userId, markTouched])

  const receiveTransmittal = useCallback((id: string, receivedByName: string, proofFileName: string, thumb?: string) => {
    setDb((prev) => {
      const t = prev.transmittals.find((x) => x.id === id)
      if (!t) return prev
      t.docIds.forEach(markTouched)
      return {
        ...prev,
        transmittals: prev.transmittals.map((x) => x.id === id ? { ...x, status: 'RECEIVED', receivedAt: TODAY, receivedByName } : x),
        docs: prev.docs.map((d) => t.docIds.includes(d.id) ? {
          ...d,
          status: 'AT_OFFICE' as Status,
          currentHolderName: receivedByName,
          files: [...d.files, proofFile(d, proofFileName, thumb)],
          events: [...d.events, {
            id: `${d.id}-e${d.events.length + 1}`, at: TODAY, actorName: receivedByName,
            type: 'RECEIVED', to: 'AT_OFFICE' as Status, note: `QR scan · transmittal ${t.no}`, source: 'mobile' as const,
          }],
        } : d),
      }
    })
  }, [])

  const value: Ctx = {
    db, role, userId, isAuthed, lang, signIn, signOut, setLang, reset, seedMode, setSeedMode, depart, isUnseen, markSeen, isUntouched,
    cancelDoc,
    currentUser: () => me ?? db.users[0],
    typeOf: (doc) => db.types.find((t) => t.code === doc.trailCode)!,
    programOf: (doc) => db.programs.find((p) => p.id === doc.programId)!,
    officeName: (id) => db.offices.find((o) => o.id === id)?.name ?? '—',
    advance, returnDoc, hold, resume, submit, receive, setPrereqs,
    addExternalRef, removeExternalRef, poke, assignLiaison,
    addDoc, addFile, createTransmittal, receiveTransmittal,
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
