// Mirrors the schema in the whitepaper (§12), trimmed to what the prototype needs.
// Routing now comes from the office's own document trail — see data/trail.ts.

import type { Signatory, StepKind } from './data/trail'

/** Four roles, from the office's user matrix.
 *  encoder = 'Encoder and Reviewer' — one role, not two.
 *  pa      = read-only oversight; the PA never updates the system.
 *  viewer  = OPAg employees; read-only, but may poke a handler. */
export type Role = 'encoder' | 'liaison' | 'pa' | 'viewer'

export type Status =
  | 'DRAFT'
  | 'FOR_REVIEW'
  | 'RETURNED'
  | 'FOR_RELEASE'
  | 'IN_TRANSIT'
  | 'AT_OFFICE'
  | 'AT_PA'
  | 'FOR_PICKUP'
  | 'RETURNED_EXT'
  | 'ON_HOLD'
  | 'DISAPPROVED'
  | 'COMPLETED'
  | 'FILED'
  | 'LOST'
  | 'CANCELLED'

/** The 11 directives from the office's paper Documents Routing Slip (§10.5). */
export type Directive =
  | 'appropriate_action'
  | 'information'
  | 'review_comments'
  | 'evaluate_recommend'
  | 'dissemination'
  | 'file_reference'
  | 'schedule'
  | 'attend_send_rep'
  | 'represent_office'
  | 'as_stated'
  | 'other'

export type CaptureProfile = 'signatory' | 'receiving' | 'none'

export interface Office {
  id: string
  code: string
  name: string
  type: 'opa_division' | 'opa_facility' | 'pg_office' | 'national_agency' | 'lgu' | 'external'
  isRoutable: boolean
}

export interface Program {
  id: string
  code: string
  name: string
  color: string
}

export interface User {
  id: string
  /** demo credentials only — see the note in Login.tsx */
  username: string
  password: string
  name: string
  position: string
  officeId: string
  roles: Role[]
  /** null = all programs */
  scopeProgramId: string | null
  /** what this person signs as, when they sign */
  signatory?: Signatory
  /** Liaisons are assigned specific document types, and for Purchase Requests
   *  a specific class of goods. From the office's user matrix. */
  assignment?: { trailCodes: string[]; prCategories?: string[]; catchAll?: boolean }
  device?: 'web' | 'phone'
}

/** A viewer nudging whoever is holding a document. */
export interface Poke {
  id: string
  at: string
  by: string
  toHandler: string
  note?: string
}

export interface TypeField {
  key: string
  labelEn: string
  labelFil: string
  /** 'combo' offers the options as suggestions but accepts anything typed. */
  type: 'text' | 'textarea' | 'date' | 'number' | 'money' | 'select' | 'combo' | 'people'
  required?: boolean
  options?: string[]
  /** descriptive text shown beside each option, keyed by the option value */
  optionLabels?: Record<string, string>
}

export interface DocumentType {
  id: string
  /** matches Trail.code */
  code: string
  name: string
  variant?: string
  category: string
  captureProfile: CaptureProfile
  sensitivity: 'internal' | 'confidential' | 'sensitive_pi'
  fields: TypeField[]
}

/** One completed (or returned) step of the trail. */
export interface StepLog {
  seq: number
  at: string
  actorName: string
  outcome: 'done' | 'returned'
  note?: string
  /** how it was acknowledged, when a hand-off was involved */
  receiptMethod?: 'qr_scan' | 'signature' | 'photo' | 'manual_entry'
  receivedByName?: string
}

export interface DocEvent {
  id: string
  at: string
  actorName: string
  type: string
  from?: Status
  to?: Status
  stepSeq?: number
  /** DocFile.id of the photograph captured with this event */
  fileId?: string
  note?: string
  source: 'web' | 'mobile' | 'system'
}

export interface DocFile {
  id: string
  name: string
  pageRole: 'front' | 'last' | 'receiving_stamp' | 'supporting' | 'cancelled'
  sizeKb: number
  capturedAt: string
  /** downscaled preview of the captured page, so the trail can show it */
  thumb?: string
}

/** A number issued by an office other than OPAg — a PR number from the BAC,
 *  an OBR number from Budget. Recorded as it is assigned. */
export interface ExternalRef {
  id: string
  officeCode: string
  label: string
  number: string
  issuedAt: string
  recordedBy: string
}

export interface Doc {
  id: string
  controlNo: string
  /** number issued by whichever office owns the series — often not OPAg */
  refNumber?: string
  drsNo?: string
  trackingCode: string
  /** numbers assigned outside OPAg, recorded as additional details */
  externalRefs: ExternalRef[]
  /** Trail.code — the document type and its routing */
  trailCode: string
  programId: string
  subject: string
  particulars?: string
  amount?: number
  directive?: Directive

  /** where the encoder sent it at registration: the PA's table, or out of the office */
  disposition?: 'pa' | 'release'
  status: Status
  /** 1-based position in the trail; 0 while still a draft */
  currentStepSeq: number
  stepLog: StepLog[]

  currentOfficeId: string
  currentHolderName?: string
  createdBy: string
  createdAt: string
  completedAt?: string

  /** per-type values, keyed by TypeField.key */
  fields: Record<string, string>
  /** documents attached as prerequisites */
  prereqDocIds: string[]
  /** free-text prerequisites ticked off without a linked document */
  prereqManual: string[]

  events: DocEvent[]
  files: DocFile[]
  /** liaison responsible once the document leaves the office */
  assignedLiaisonId?: string
  /** follow-ups raised by viewers */
  pokes: Poke[]
  /** id of the parent doc this one follows (e.g. PTR follows TO) */
  followsId?: string
  deficiency?: string
  /** why the document was cancelled — required, with a photo of the stamped paper */
  cancelReason?: string
}

export interface Transmittal {
  id: string
  no: string
  liaisonId: string
  toOfficeId: string
  docIds: string[]
  releasedAt?: string
  receivedAt?: string
  receivedByName?: string
  status: 'OPEN' | 'RELEASED' | 'RECEIVED'
}

export interface DB {
  offices: Office[]
  programs: Program[]
  users: User[]
  types: DocumentType[]
  docs: Doc[]
  transmittals: Transmittal[]
}

export type { Signatory, StepKind }
