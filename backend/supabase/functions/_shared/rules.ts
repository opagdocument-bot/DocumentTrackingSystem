// The office's rule engine, ported for the server.
//
// This is NOT a reimplementation from scratch — every function here is a
// direct port of app/src/lib/workflow.ts, kept as close to the original as
// Deno's stricter module rules allow. Two real differences from the source,
// both deliberate:
//
//  1. trails-data.json is the *pre-computed output* of TRAILS_WITH_CHECKPOINTS
//     (app/src/data/trail.ts), dumped once rather than re-implemented here.
//     The checkpoint-insertion algorithm (withPaCheckpoints,
//     withReceiptCheckpoints) is the one part of the process map with real
//     branching logic; turning it into a static data file removes the only
//     place a hand-port could silently diverge from the app's own routing.
//     If the office's process map ever changes, re-run the dump script noted
//     in backend/README.md and redeploy — don't hand-edit the JSON.
//
//  2. TODAY is the real clock, not the frozen prototype date. The frontend
//     freezes "today" at 2026-08-26 so demo data reads consistently; a real
//     backend obviously can't do that.
//
// Everything else below should read as workflow.ts would, function for
// function, because that is exactly what it is.

import trailsData from './trails-data.json' with { type: 'json' }

export type Role = 'encoder' | 'liaison' | 'pa' | 'viewer'
export type Status =
  | 'DRAFT' | 'FOR_REVIEW' | 'RETURNED' | 'FOR_RELEASE' | 'IN_TRANSIT' | 'AT_OFFICE'
  | 'AT_PA' | 'FOR_PICKUP' | 'RETURNED_EXT' | 'ON_HOLD' | 'DISAPPROVED'
  | 'COMPLETED' | 'FILED' | 'LOST' | 'CANCELLED'

export interface TrailStep {
  seq: number
  requirement: string
  officeCode: string
  days: number | null
  outcome: 'next' | 'approved' | 'release'
  signatory: string
  kind: 'action' | 'record_in' | 'record_out' | 'record_receipt'
  isCheckpoint: boolean
}

export interface Trail {
  code: string
  name: string
  variant?: string
  category: string
  prerequisites: string[]
  prerequisiteCodes: string[]
  originOffice: string
  refNumberOrigin: string | null
  finalProduct: string | null
  steps: TrailStep[]
}

/** The row shape this module needs from `documents` — a subset of the table,
 *  not the full schema, so a caller can pass a partial select result. */
export interface DocRow {
  id: string
  control_no: string
  ref_number: string | null
  trail_code: string
  status: Status
  current_step_seq: number
  assigned_liaison_id: string | null
  prereq_doc_ids: string[]
  prereq_manual: string[]
}

const TRAILS = trailsData.trails as Trail[]
export const TRAIL_OFFICES = trailsData.officeNames as Record<string, string>
export const OFFICE_SHORT = trailsData.officeShort as Record<string, string>
export const NO_PROGRAM_TRAIL_CODES = new Set(trailsData.noProgramTrailCodes as string[])
export const INTERNAL_PROGRAM_IDS = new Set(trailsData.internalProgramIds as string[])

export function trailFor(code: string): Trail | undefined {
  return TRAILS.find((t) => t.code === code)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function stepsOf(doc: Pick<DocRow, 'trail_code'>): TrailStep[] {
  return trailFor(doc.trail_code)?.steps ?? []
}

export function currentStep(doc: Pick<DocRow, 'trail_code' | 'current_step_seq'>): TrailStep | undefined {
  return stepsOf(doc).find((s) => s.seq === doc.current_step_seq)
}

/**
 * The custody rule. While a document is inside OPAg, the Encoder updates it
 * — including recording that the Provincial Agriculturist has signed. Once
 * it leaves the office, the liaison assigned to that document type updates
 * it. The PA never updates anything; that is deliberate, not an omission.
 */
export function custodyOf(doc: Pick<DocRow, 'trail_code' | 'current_step_seq' | 'status'>): 'office' | 'field' {
  if (doc.status === 'DRAFT' || doc.status === 'FOR_REVIEW' || doc.status === 'RETURNED' || doc.status === 'RETURNED_EXT') return 'office'
  const step = currentStep(doc)
  if (!step) return 'office'
  return step.officeCode === 'OPAG' ? 'office' : 'field'
}

const OPEN_STATUSES: Status[] = [
  'FOR_REVIEW', 'RETURNED', 'FOR_RELEASE', 'IN_TRANSIT', 'AT_OFFICE', 'AT_PA', 'FOR_PICKUP', 'RETURNED_EXT', 'ON_HOLD',
]

export function isOpen(doc: Pick<DocRow, 'status'>): boolean {
  return OPEN_STATUSES.includes(doc.status)
}

/** Status a document should take when it arrives at a given step. */
export function statusForStep(step: TrailStep | undefined, prevOfficeCode?: string): Status {
  if (!step) return 'COMPLETED'
  if (step.kind === 'record_in') return 'AT_PA'
  if (step.signatory === 'provincial_agriculturist') return 'AT_PA'
  if (step.kind === 'record_out') return 'FOR_RELEASE'
  if (step.officeCode === 'OPAG') return 'AT_OFFICE'
  if (prevOfficeCode === step.officeCode) return 'AT_OFFICE'
  return !prevOfficeCode || prevOfficeCode === 'OPAG' ? 'FOR_RELEASE' : 'IN_TRANSIT'
}

/** Must the outside reference number be on record before this step can be
 *  completed? See workflow.ts for the full three-shape explanation. */
export function needsRefNumberNow(doc: DocRow): boolean {
  if (doc.ref_number) return false
  const trail = trailFor(doc.trail_code)
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

export function allPrerequisites(trailCode: string): string[] {
  const trail = trailFor(trailCode)
  if (!trail) return []
  const counterSigned = trail.steps
    .filter((s) => /^counter-?signed by/i.test(s.requirement))
    .map((s) => s.requirement)
  return [...trail.prerequisites, ...counterSigned]
}

export function prereqsMet(doc: Pick<DocRow, 'trail_code' | 'prereq_doc_ids' | 'prereq_manual'>): boolean {
  const total = allPrerequisites(doc.trail_code).length
  const satisfied = doc.prereq_doc_ids.length + doc.prereq_manual.length
  return Math.min(satisfied, total) >= total
}

export function issuesOwnRefNumber(trailCode: string): boolean {
  return trailFor(trailCode)?.refNumberOrigin === 'OPAG'
}

export function paperNumber(controlNo: string): string {
  const m = controlNo.match(/(\d{4}-\d{2}-\d{4})$/)
  return m ? m[1] : controlNo
}

/** One series per document type, restarting each month, taken from the
 *  highest already used so a gap is never back-filled. */
export function nextControlNo(existingControlNos: string[], typeCode: string, dateISO: string): string {
  const prefix = `OPA-${typeCode}-${dateISO.slice(0, 4)}-${dateISO.slice(5, 7)}-`
  const used = existingControlNos
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  return prefix + String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')
}

export function makeTrackingCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32
  const pick = () => alphabet[Math.floor(Math.random() * alphabet.length)]
  return Array.from({ length: 4 }, pick).join('') + '-' + Array.from({ length: 4 }, pick).join('')
}

export interface Action {
  id: string
  kind: 'submit' | 'advance' | 'return' | 'release' | 'receive' | 'hold' | 'resume' | 'cancel' | 'handover' | 'depart'
  needsPrereqs?: boolean
  needsRef?: boolean
  needsProof?: boolean
  needsNote?: boolean
}

/**
 * The same gate the frontend uses to decide what a role may do next — ported
 * without the label text, since the server only needs to know whether a
 * requested action is legal, not how to word its button.
 */
export function availableActions(doc: DocRow, role: Role, userId?: string): Action[] {
  const step = currentStep(doc)

  if (role === 'pa' || role === 'viewer') return []
  if (doc.status === 'COMPLETED' || doc.status === 'FILED' || doc.status === 'CANCELLED' || doc.status === 'DISAPPROVED') return []
  if (doc.status === 'ON_HOLD') return role === 'encoder' ? [{ id: 'resume', kind: 'resume' }] : []

  const custody = custodyOf(doc)

  if (role === 'encoder') {
    if (custody !== 'office') return []
    if (doc.status === 'DRAFT') return [{ id: 'submit', kind: 'submit', needsPrereqs: true }]
    if (doc.status === 'RETURNED' || doc.status === 'RETURNED_EXT') return [{ id: 'resubmit', kind: 'submit', needsPrereqs: true }]
    if (doc.status === 'FOR_REVIEW') return [
      { id: 'verify', kind: 'advance', needsPrereqs: true },
      { id: 'return', kind: 'return', needsNote: true },
    ]
    if (doc.status === 'AT_PA' && step) return [
      { id: 'record_pa', kind: 'advance', needsRef: true },
      { id: 'return', kind: 'return', needsNote: true },
      { id: 'hold', kind: 'hold', needsNote: true },
    ]
    if (doc.status === 'FOR_RELEASE') return [{ id: 'ready', kind: 'handover' }]
    if (doc.status === 'AT_OFFICE' && step) return [{ id: 'done', kind: 'advance', needsRef: true }]
    return []
  }

  if (role === 'liaison') {
    if (userId && doc.assigned_liaison_id && doc.assigned_liaison_id !== userId) return []
    if (custody !== 'field' && doc.status !== 'FOR_RELEASE') return []
    if (doc.status === 'FOR_RELEASE') return [{ id: 'depart', kind: 'depart' }]
    if (doc.status === 'IN_TRANSIT') return [{ id: 'receive', kind: 'receive', needsProof: true, needsNote: true }]
    if (doc.status === 'AT_OFFICE' && step) return [{ id: 'done', kind: 'advance', needsProof: true, needsRef: true }]
    if (doc.status === 'FOR_PICKUP') return [{ id: 'collect', kind: 'advance', needsProof: true }]
    return []
  }

  return []
}

export type Capability = 'edit_refs' | 'edit_prereqs' | 'capture' | 'poke' | 'assign' | 'cancel'

export function can(role: Role, cap: Capability, doc: DocRow, userId?: string): boolean {
  if (role === 'pa') return false
  if (role === 'viewer') return cap === 'poke' && isOpen(doc)

  if (role === 'encoder') {
    if (cap === 'poke') return false
    if (cap === 'edit_refs' || cap === 'assign') return isOpen(doc)
    if (cap === 'cancel') return isOpen(doc)
    return custodyOf(doc) === 'office' && isOpen(doc)
  }

  if (role === 'liaison') {
    if (cap !== 'capture') return false
    if (userId && doc.assigned_liaison_id !== userId) return false
    return isOpen(doc) && (custodyOf(doc) === 'field' || doc.status === 'FOR_RELEASE')
  }

  return false
}
