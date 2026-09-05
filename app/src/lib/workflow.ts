import type { Directive, Doc, Role, Status } from '../types'
import { OFFICE_SHORT, SIGNATORY_LABEL, TRAIL_OFFICES, trailDays, trailFor } from '../data/trail'
import type { Trail, TrailStep } from '../data/trail'

export type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'accent'

export const STATUS_LABEL: Record<Status, { en: string; fil: string; tone: Tone }> = {
  DRAFT:        { en: 'Draft',              fil: 'Burador',              tone: 'neutral' },
  FOR_REVIEW:   { en: 'For review',         fil: 'Sinusuri',             tone: 'warn' },
  RETURNED:     { en: 'Returned',           fil: 'Ibinalik',             tone: 'crit' },
  FOR_RELEASE:  { en: 'For release',        fil: 'Handa nang Ilabas',    tone: 'accent' },
  IN_TRANSIT:   { en: 'In transit',         fil: 'Nasa Biyahe',          tone: 'info' },
  AT_OFFICE:    { en: 'At office',          fil: 'Nasa Tanggapan',       tone: 'info' },
  AT_PA:        { en: 'With the PA',        fil: 'Nasa Provincial Agriculturist', tone: 'accent' },
  FOR_PICKUP:   { en: 'For pickup',         fil: 'Handa nang Kunin',     tone: 'accent' },
  RETURNED_EXT: { en: 'Returned to Office',    fil: 'Ibinalik sa Tanggapan',   tone: 'crit' },
  ON_HOLD:      { en: 'On hold',            fil: 'Nakabinbin',           tone: 'crit' },
  DISAPPROVED:  { en: 'Disapproved',        fil: 'Hindi Inaprubahan',    tone: 'crit' },
  COMPLETED:    { en: 'Completed',          fil: 'Tapos na',             tone: 'ok' },
  FILED:        { en: 'Filed',              fil: 'Nakaimbak',            tone: 'ok' },
  LOST:         { en: 'Missing',            fil: 'Nawawala',             tone: 'crit' },
  CANCELLED:    { en: 'Cancelled',          fil: 'Kanselado',            tone: 'neutral' },
}

export const DIRECTIVE_LABEL: Record<Directive, string> = {
  appropriate_action: 'For Appropriate Action',
  information: 'For your information',
  review_comments: 'For review / comments',
  evaluate_recommend: 'Please evaluate & recommend',
  dissemination: 'For dissemination',
  file_reference: 'For file / reference',
  schedule: 'For schedule',
  attend_send_rep: 'Please attend / send representatives',
  represent_office: 'Please represent the office',
  as_stated: 'As stated',
  other: 'Other/s',
}

export const ACTIONABLE_DIRECTIVES: Directive[] = [
  'appropriate_action', 'evaluate_recommend', 'review_comments', 'attend_send_rep', 'represent_office',
]

export const ROLE_LABEL: Record<Role, string> = {
  encoder: 'Encoder and Reviewer',
  liaison: 'Liaison Officer',
  pa: 'Provincial Agriculturist',
  viewer: 'Viewer',
}

/**
 * The custody rule.
 *
 * While a document is inside OPAg, the Encoder updates it — including
 * recording that the Provincial Agriculturist has signed. Once it leaves the
 * office, the liaison assigned to that document type updates it.
 *
 * The PA never updates anything; that is deliberate, not an omission.
 */
export function custodyOf(doc: Doc): 'office' | 'field' {
  // RETURNED_EXT is the same fact as RETURNED — a bounced document back in the
  // encoder's hands — just named for a rejection that came from outside the
  // office. Both need the same early return, or the encoder branch below
  // (gated on custody === 'office') never sees it and the document is stuck
  // with no available action at all, for either role.
  if (doc.status === 'DRAFT' || doc.status === 'FOR_REVIEW' || doc.status === 'RETURNED' || doc.status === 'RETURNED_EXT') return 'office'
  const step = currentStep(doc)
  if (!step) return 'office'
  return step.officeCode === 'OPAG' ? 'office' : 'field'
}

export function updaterFor(doc: Doc): Role {
  return custodyOf(doc) === 'office' ? 'encoder' : 'liaison'
}

export { OFFICE_SHORT, SIGNATORY_LABEL, TRAIL_OFFICES, trailDays, trailFor }
export type { Trail, TrailStep }

// --- trail position ---------------------------------------------------------

export function stepsOf(doc: Doc): TrailStep[] {
  return trailFor(doc.trailCode)?.steps ?? []
}

export function currentStep(doc: Doc): TrailStep | undefined {
  return stepsOf(doc).find((s) => s.seq === doc.currentStepSeq)
}

export function stepState(doc: Doc, step: TrailStep): 'done' | 'current' | 'pending' | 'returned' {
  const log = doc.stepLog.find((l) => l.seq === step.seq)
  if (log?.outcome === 'returned') return 'returned'
  if (log) return 'done'
  if (step.seq === doc.currentStepSeq && isOpen(doc)) return 'current'
  return 'pending'
}

export function progressOf(doc: Doc): { done: number; total: number; pct: number } {
  const total = stepsOf(doc).length || 1
  const done = doc.stepLog.filter((l) => l.outcome === 'done').length
  return { done, total, pct: Math.round((done / total) * 100) }
}

/** Is this document sitting on the Provincial Agriculturist's desk? */
export function isWithPa(doc: Doc): boolean {
  const s = currentStep(doc)
  if (!s) return false
  return s.signatory === 'provincial_agriculturist' || s.kind === 'record_in'
}

// --- actions ----------------------------------------------------------------

export interface Action {
  id: string
  label: string
  tone?: 'primary' | 'danger'
  needsPrereqs?: boolean
  /** blocked until the outside reference number is on record */
  needsRef?: boolean
  /** the liaison must photograph the paper before this is accepted */
  needsProof?: boolean
  needsNote?: boolean
  noteLabel?: string
  kind: 'submit' | 'advance' | 'return' | 'release' | 'receive' | 'hold' | 'resume' | 'cancel' | 'handover' | 'depart'
}

/**
 * Must the outside reference number be on record before this step can be
 * completed?
 *
 * A number issued elsewhere can only be written down once the document has
 * actually been to the office that issues it — never before, or demanding it
 * would only teach people to invent one. Three shapes, all handled here so a
 * document can never slip through uncaptured:
 *
 *  - The route names a distinct numbering step at the issuing office — "PO
 *    Number at BAC", "Return to BAC for PR Number" — and whoever is recording
 *    that exact step, liaison included, is asked for it right there.
 *  - The issuing office is simply where the trail ends — a Travel Order's
 *    Governor's signature, an Obligation Request's Budget Officer approval, a
 *    Disbursement Voucher's release — with no separate step naming the
 *    number. It is asked for at that last step instead, or the document would
 *    reach COMPLETED having never been asked at all.
 *  - The route puts the issuing office first and later brings the document
 *    back into OPAg — the number must be captured the moment the office
 *    receives it back, before it goes up for signature.
 */
export function needsRefNumberNow(doc: Doc): boolean {
  if (doc.refNumber) return false
  const trail = trailFor(doc.trailCode)
  const origin = trail?.refNumberOrigin
  if (!origin || origin === 'OPAG') return false

  const step = currentStep(doc)
  if (!step) return false

  if (step.officeCode === origin) {
    const isLastStep = trail!.steps[trail!.steps.length - 1].seq === step.seq
    return isLastStep || /number/i.test(step.requirement)
  }

  if (step.kind !== 'record_receipt' && step.kind !== 'record_in') return false
  const issuedAt = trail!.steps.find((s) => s.officeCode === origin)
  return Boolean(issuedAt && issuedAt.seq < step.seq)
}

/**
 * What one line of the audit trail says.
 *
 * "In transit → At office" tells a viewer nothing: the whole point of the trail
 * is *where the paper is*. Each entry is named by the office recorded against
 * that step, so the history reads "At the Budget Office", "In transit to
 * Governor's Office" — the liaison's own updates, in plain words.
 */
export function eventPhrase(doc: Doc, e: { to?: Status; stepSeq?: number; type: string }): string {
  if (!e.to) return e.type.replace(/_/g, ' ').toLowerCase()

  const step = stepsOf(doc).find((s) => s.seq === e.stepSeq)
  const external = step && step.officeCode !== 'OPAG'
  const office = step ? OFFICE_SHORT[step.officeCode] ?? step.officeCode : ''

  switch (e.to) {
    case 'IN_TRANSIT':
      return external ? `In transit to ${office}` : 'In transit'
    case 'AT_OFFICE':
      return external ? `At the ${office}` : 'At OPAg'
    case 'FOR_RELEASE':
      return external ? `For release to ${office}` : 'For release'
    case 'FOR_PICKUP':
      return external ? `For pickup at ${office}` : 'For pickup'
    case 'AT_PA':
      return 'With the Provincial Agriculturist'
    case 'COMPLETED': {
      const last = stepsOf(doc)[stepsOf(doc).length - 1]
      return last?.outcome === 'approved' ? 'Approved' : 'Completed'
    }
    default:
      return STATUS_LABEL[e.to].en
  }
}

export function availableActions(doc: Doc, role: Role, userId?: string): Action[] {
  const step = currentStep(doc)

  // The Provincial Agriculturist and viewers never change anything.
  if (role === 'pa' || role === 'viewer') return []

  if (doc.status === 'COMPLETED' || doc.status === 'FILED' || doc.status === 'CANCELLED' || doc.status === 'DISAPPROVED') return []
  if (doc.status === 'ON_HOLD') {
    return role === 'encoder' ? [{ id: 'resume', label: 'Resume processing', kind: 'resume' }] : []
  }

  const custody = custodyOf(doc)

  if (role === 'encoder') {
    // The encoder owns everything while the document is inside the office.
    if (custody !== 'office') return []

    if (doc.status === 'DRAFT') return [{ id: 'submit', label: 'Submit for review', kind: 'submit', tone: 'primary', needsPrereqs: true }]
    if (doc.status === 'RETURNED' || doc.status === 'RETURNED_EXT')
      return [{ id: 'resubmit', label: 'Correct and resubmit', kind: 'submit', tone: 'primary', needsPrereqs: true }]
    if (doc.status === 'FOR_REVIEW')
      return [
        { id: 'verify', label: 'Verify — start the trail', kind: 'advance', tone: 'primary', needsPrereqs: true },
        { id: 'return', label: 'Return for revision', kind: 'return', tone: 'danger', needsNote: true, noteLabel: 'What is missing?' },
      ]
    if (doc.status === 'AT_PA' && step)
      return [
        // The PA signs on paper; the encoder records it.
        {
          id: 'record_pa',
          label: step.kind === 'record_in' ? 'Record received by the PA' : 'Record that PA has signed',
          kind: 'advance', tone: 'primary', needsRef: true,
        },
        { id: 'return', label: 'PA returned it', kind: 'return', tone: 'danger', needsNote: true, noteLabel: 'Reason the PA gave' },
        { id: 'hold', label: 'Put on hold', kind: 'hold', needsNote: true, noteLabel: 'Reason for hold' },
      ]
    // Releasing means naming the liaison who will carry it.
    if (doc.status === 'FOR_RELEASE') return [{ id: 'ready', label: 'Hand to a liaison…', kind: 'handover', tone: 'primary' }]
    if (doc.status === 'AT_OFFICE' && step)
      return [{
        id: 'done',
        // A receipt step is already phrased as the thing being recorded.
        label: step.kind === 'record_receipt' ? step.requirement : `Record done — ${step.requirement}`,
        kind: 'advance', tone: 'primary', needsRef: true,
      }]
    return []
  }

  if (role === 'liaison') {
    // A liaison only touches documents assigned to them, once out of the office.
    if (userId && doc.assignedLiaisonId && doc.assignedLiaisonId !== userId) return []
    if (custody !== 'field' && doc.status !== 'FOR_RELEASE') return []

    // Out of the office the liaison logs two things at every stop: that the
    // office received the paper, and that its signatory signed it. Both need a
    // photograph of the document — the office's rule, so custody is never a
    // matter of somebody's word.
    const office = step ? OFFICE_SHORT[step.officeCode] ?? step.officeCode : 'the next office'

    if (doc.status === 'FOR_RELEASE')
      return [{ id: 'depart', label: `Leaving for ${office}`, kind: 'depart', tone: 'primary' }]
    if (doc.status === 'IN_TRANSIT')
      return [{
        id: 'receive', label: `Received by ${office}`, kind: 'receive', tone: 'primary',
        needsProof: true, needsNote: true, noteLabel: 'Received by (name)',
      }]
    if (doc.status === 'AT_OFFICE' && step)
      return [{
        id: 'done', label: `Signed — ${step.requirement}`, kind: 'advance', tone: 'primary',
        needsProof: true, needsRef: true,
      }]
    if (doc.status === 'FOR_PICKUP')
      return [{ id: 'collect', label: 'Collected — back at OPAg', kind: 'advance', tone: 'primary', needsProof: true }]
    return []
  }

  return []
}

/** Status a document should take when it arrives at a given step. */
export function statusForStep(step: TrailStep | undefined, prevOfficeCode?: string): Status {
  if (!step) return 'COMPLETED'
  if (step.kind === 'record_in') return 'AT_PA'
  if (step.signatory === 'provincial_agriculturist') return 'AT_PA'
  if (step.kind === 'record_out') return 'FOR_RELEASE'
  if (step.officeCode === 'OPAG') return 'AT_OFFICE'
  // Another signatory at the same office: the paper has not moved.
  if (prevOfficeCode === step.officeCode) return 'AT_OFFICE'
  // Leaving OPAg needs a hand-over, so it waits as "for release". Already
  // outside, the liaison simply walks it to the next office — no hand-over,
  // straight into transit.
  return !prevOfficeCode || prevOfficeCode === 'OPAG' ? 'FOR_RELEASE' : 'IN_TRANSIT'
}

/**
 * What the status says, given where the document actually is.
 *
 * A liaison carrying a Leave Application needs to read "In transit to HRMO",
 * then "In HRMO for signature" — not a bare "In transit" that could mean
 * anywhere. Falls back to the plain label whenever there is no office to name.
 */
export function statusPhrase(doc: Doc): { en: string; fil: string; tone: Tone } {
  const base = STATUS_LABEL[doc.status]
  const step = currentStep(doc)

  if (!step) {
    // A trail whose last step is an approval ends approved, not merely done.
    const last = stepsOf(doc)[stepsOf(doc).length - 1]
    if (doc.status === 'COMPLETED' && last?.outcome === 'approved') {
      return { en: 'Approved', fil: 'Aprubado', tone: 'ok' }
    }
    return base
  }

  if (step.officeCode === 'OPAG') return base
  const office = OFFICE_SHORT[step.officeCode] ?? step.officeCode

  switch (doc.status) {
    case 'IN_TRANSIT':
      return { en: `In transit to ${office}`, fil: `Papunta sa ${office}`, tone: base.tone }
    case 'AT_OFFICE':
      return { en: `In ${office} for signature`, fil: `Nasa ${office} para lagdaan`, tone: base.tone }
    case 'FOR_RELEASE':
      return { en: `For release to ${office}`, fil: `Ilalabas papuntang ${office}`, tone: base.tone }
    case 'FOR_PICKUP':
      return { en: `For pickup at ${office}`, fil: `Kukunin sa ${office}`, tone: base.tone }
    default:
      return base
  }
}

// --- prerequisites ----------------------------------------------------------

/**
 * Everything that must be in hand before a document can be registered.
 *
 * Two sources. The attachments the process map lists as prerequisites, and the
 * in-office counter-signatures — the paper already carries those by the time it
 * reaches the encoder's desk, so they are confirmed at the door rather than
 * discovered missing three offices later.
 *
 * One function, used by the register form and by every prerequisite count, so
 * the two can never disagree about what is required.
 */
export function allPrerequisites(trailCode: string): string[] {
  const trail = trailFor(trailCode)
  if (!trail) return []
  const counterSigned = trail.steps
    .filter((s) => /^counter-?signed by/i.test(s.requirement))
    .map((s) => s.requirement)
  return [...trail.prerequisites, ...counterSigned]
}

export function prereqStatus(doc: Doc): { met: number; total: number; missing: string[] } {
  const req = allPrerequisites(doc.trailCode)
  const satisfied = doc.prereqDocIds.length + doc.prereqManual.length
  const missing = req.filter((r) => !doc.prereqManual.includes(r)).slice(Math.max(0, doc.prereqDocIds.length))
  return { met: Math.min(satisfied, req.length), total: req.length, missing }
}

export function prereqsMet(doc: Doc): boolean {
  const { met, total } = prereqStatus(doc)
  return met >= total
}

// --- working days -----------------------------------------------------------

/** 2026 Philippine + Aurora provincial non-working days (whitepaper §9.3). */
const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-02-19', '2026-04-09', '2026-05-01',
  '2026-06-12', '2026-06-30', '2026-11-01', '2026-11-30',
  '2026-12-08', '2026-12-25', '2026-12-30',
])

export function workingDaysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISO + 'T00:00:00')
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) return 0
  let days = 0
  const cur = new Date(from)
  while (cur < to) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6 && !HOLIDAYS_2026.has(cur.toISOString().slice(0, 10))) days += 1
  }
  return days
}

export const TODAY = '2026-08-26'

const OPEN_STATUSES: Status[] = [
  'FOR_REVIEW', 'RETURNED', 'FOR_RELEASE', 'IN_TRANSIT', 'AT_OFFICE', 'AT_PA', 'FOR_PICKUP', 'RETURNED_EXT', 'ON_HOLD',
]

export function isOpen(doc: Doc): boolean {
  return OPEN_STATUSES.includes(doc.status)
}

export function ageInWorkingDays(doc: Doc): number {
  return workingDaysBetween(doc.createdAt, doc.completedAt ?? TODAY)
}

/** Working days the document has been sitting at its current step. */
export function daysAtCurrentStep(doc: Doc): number {
  const last = doc.stepLog[doc.stepLog.length - 1]
  return workingDaysBetween(last?.at ?? doc.createdAt, TODAY)
}

export type SlaState = 'ok' | 'warn' | 'breach'

/** Expected duration for the whole trail, from the office's own figures. */
export function expectedDays(doc: Doc): number {
  const t = trailFor(doc.trailCode)
  return t ? Math.max(1, trailDays(t)) : 7
}

export function slaState(doc: Doc): SlaState {
  if (!isOpen(doc)) return 'ok'
  const budget = expectedDays(doc)
  const age = ageInWorkingDays(doc)
  if (age >= budget) return 'breach'
  if (age >= budget * 0.7) return 'warn'
  return 'ok'
}

/** Is this step overdue against the office's own "typical working days"? */
export function stepOverdue(doc: Doc): boolean {
  const s = currentStep(doc)
  if (!s?.days) return false
  return daysAtCurrentStep(doc) > s.days
}

// --- reports ----------------------------------------------------------------

export function travelsMissingReport(docs: Doc[]) {
  const reported = new Set(docs.filter((d) => d.trailCode === 'PTR' && d.followsId).map((d) => d.followsId))
  return docs.filter((d) => d.trailCode === 'TO' && d.status === 'COMPLETED' && !reported.has(d.id))
}

/** Everything currently sitting on the PA's desk, oldest first. */
export function onPaDesk(docs: Doc[]) {
  return docs
    .filter((d) => isOpen(d) && isWithPa(d))
    .sort((a, b) => daysAtCurrentStep(b) - daysAtCurrentStep(a))
}

/**
 * The office's own number for a document: `OPA-<TYPE>-yyyy-mm-nnnn`.
 *
 * One series per document type, restarting each month. This is what the system
 * records against, for every document — including the ones whose reference
 * number is issued somewhere else and may not arrive for weeks.
 *
 * The sequence comes from the highest already used rather than from a count, so
 * a gap in the middle is never back-filled: a cancelled document keeps its
 * number and the gap stays visible, which is what an audit of a numbered series
 * expects.
 */
export function nextControlNo(docs: Doc[], typeCode: string, dateISO: string): string {
  const prefix = `OPA-${typeCode}-${dateISO.slice(0, 4)}-${dateISO.slice(5, 7)}-`
  const used = docs
    .filter((d) => d.controlNo.startsWith(prefix))
    .map((d) => parseInt(d.controlNo.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  return prefix + String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')
}

/**
 * The part of a control number that gets written on the paper: `yyyy-mm-nnnn`.
 *
 * The office prefix and the type code are the system's business. The clerk
 * writing on the document only needs the number itself.
 */
export function paperNumber(controlNo: string): string {
  const m = controlNo.match(/(\d{4}-\d{2}-\d{4})$/)
  return m ? m[1] : controlNo
}

/**
 * Does this office issue the document's reference number itself?
 *
 * Most reference numbers come from outside — PR numbers from the BAC, Travel
 * Orders from the Governor's Office — and can only be typed in when the paper
 * comes back carrying them. The few the office numbers itself, it can generate.
 */
export function issuesOwnRefNumber(trailCode: string): boolean {
  return trailFor(trailCode)?.refNumberOrigin === 'OPAG'
}

export function makeTrackingCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32
  const pick = () => alphabet[Math.floor(Math.random() * alphabet.length)]
  return Array.from({ length: 4 }, pick).join('') + '-' + Array.from({ length: 4 }, pick).join('')
}

/**
 * Everything still on this liaison's plate.
 *
 * A document stays here until it is closed — never until it merely lands in a
 * status some screen forgot to list. Custody decides who may *act* on it; it
 * does not decide whether the liaison can still see it. Handing a batch to a
 * receiving clerk does not end the liaison's responsibility, so releasing must
 * not make a document vanish from this list.
 */
export function liaisonLoad(docs: Doc[], userId: string) {
  return docs.filter((d) => d.assignedLiaisonId === userId && isOpen(d))
}

/**
 * Which section of My load a document belongs in. Every open document lands in
 * exactly one, so nothing can fall between the sections.
 *
 *  - `carry`  — waiting for this liaison to build a transmittal and take it out
 *  - `field`  — out of the office: in transit, sitting at another office,
 *               awaiting pickup, on hold, or bounced back by the receiver
 *  - `office` — back under the Encoder's control (with the PA, being reviewed,
 *               or returned for correction). Visible, but not theirs to update.
 */
export type LoadBucket = 'carry' | 'field' | 'office'

export function loadBucket(doc: Doc): LoadBucket {
  if (doc.status === 'FOR_RELEASE') return 'carry'
  return custodyOf(doc) === 'field' ? 'field' : 'office'
}

/** Who is expected to move this document next, in plain words. */
export function nextMover(doc: Doc, users: { id: string; name: string; roles: Role[] }[]): string {
  if (!isOpen(doc)) return '—'
  if (doc.status === 'AT_PA') return 'Encoder, once the PA signs'
  if (custodyOf(doc) === 'office') return 'Encoder'
  const l = users.find((u) => u.id === doc.assignedLiaisonId)
  return l ? `Liaison — ${l.name}` : 'Liaison (unassigned)'
}

/* ---------------------------------------------------------------------------
   Permissions.

   One place, so a control can never be shown to a role that must not use it.
   From the office's user matrix:
     encoder — updates documents in the office, assigns reference numbers
     liaison — updates and photographs the documents assigned to them, in field
     pa      — oversight only; changes nothing
     viewer  — views, and pokes whoever is holding the document
   --------------------------------------------------------------------------- */

export type Capability = 'edit_refs' | 'edit_prereqs' | 'capture' | 'poke' | 'assign' | 'cancel'

export function can(role: Role, cap: Capability, doc: Doc, userId?: string): boolean {
  // The Provincial Agriculturist changes nothing, ever.
  if (role === 'pa') return false

  if (role === 'viewer') return cap === 'poke' && isOpen(doc)

  if (role === 'encoder') {
    if (cap === 'poke') return false
    // Reference numbers may arrive while the document is away, so recording
    // them is not gated on custody — it is the encoder's listed duty.
    if (cap === 'edit_refs' || cap === 'assign') return isOpen(doc)
    // A disapproved paper can be stamped and cancelled wherever it currently is:
    // the liaison carries it back, but the decision and the record are the
    // encoder's alone, so this is not gated on custody either.
    if (cap === 'cancel') return isOpen(doc)
    return custodyOf(doc) === 'office' && isOpen(doc)
  }

  if (role === 'liaison') {
    if (cap !== 'capture') return false
    if (userId && doc.assignedLiaisonId !== userId) return false
    return isOpen(doc) && (custodyOf(doc) === 'field' || doc.status === 'FOR_RELEASE')
  }

  return false
}

/** Why a particular liaison holds a document, in plain words. */
export function assignmentReason(
  u: { assignment?: { trailCodes: string[]; prCategories?: string[]; catchAll?: boolean } },
  doc: Doc,
): string {
  const a = u.assignment
  if (!a) return ''
  const cat = doc.fields.supply_category
  if (doc.trailCode === 'PR' && cat && a.prCategories?.includes(cat)) {
    return `handles Purchase Requests for ${cat}`
  }
  if (a.trailCodes.includes(doc.trailCode)) {
    return `handles ${trailFor(doc.trailCode)?.name ?? doc.trailCode}`
  }
  if (a.catchAll) return 'general assignment — no one is named for this document type'
  return ''
}
