/* ---------------------------------------------------------------------------
   Document trails — transcribed from the office's own process map
   ("List of Documents Processed by OPAg / Document Trail", Google Sheets).

   This file is the single source of truth for routing. Nothing here is
   inferred: every step, office and duration comes from the sheet.
   --------------------------------------------------------------------------- */

/** Who performs a step. Drives the PA checkpoint rule and the signatory queue. */
export type Signatory =
  | 'personnel'
  | 'fod'
  | 'supply_officer'
  | 'records_officer'
  | 'planning_officer'
  | 'supervising_agriculturist'
  | 'admin_officer'
  | 'provincial_administrator'
  | 'provincial_agriculturist'
  | 'governor'
  | 'budget_officer'
  | 'accounting_officer'
  | 'treasurer'
  | 'hrmo'
  | 'gso'
  | 'bac'
  | 'twg'
  | 'internal_audit'
  | 'bank'
  | 'system'

export type StepKind = 'action' | 'record_in' | 'record_out' | 'record_receipt'

export type Outcome = 'next' | 'approved' | 'release' | 'end'

export interface TrailStep {
  seq: number
  /** Verbatim from the sheet's "Requirement" column. */
  requirement: string
  officeCode: string
  /** Typical working days. null where the sheet left it blank. */
  days: number | null
  outcome: Outcome
  kind: StepKind
  signatory: Signatory
  /** True for steps the office added purely to record custody. */
  isCheckpoint?: boolean
}

export interface Trail {
  code: string
  name: string
  /** A second disambiguating line under the name, where a type still needs one. */
  variant?: string
  category: string
  /** Verbatim "Pre-requisite Document (Attachments Required)". */
  prerequisites: string[]
  /** Codes of other tracked documents that must exist first. */
  prerequisiteCodes: string[]
  originOffice: string
  /** False when the document is handled entirely by another office and OPAg
   *  can only record that it started and finished — e.g. the Canvass, which
   *  is internal to the BAC. */
  ownedByOpag?: boolean
  /** Which office issues the control/reference number — often NOT OPAg. */
  refNumberOrigin: string | null
  finalProduct: string | null
  steps: TrailStep[]
}

const A = (
  seq: number, requirement: string, officeCode: string, days: number | null,
  outcome: Outcome, signatory: Signatory, kind: StepKind = 'action',
): TrailStep => ({ seq, requirement, officeCode, days, outcome, signatory, kind, isCheckpoint: kind !== 'action' })

export const TRAILS: Trail[] = [
  {
    code: 'TO', name: 'Travel Order', category: 'Travel',
    prerequisites: ['Received Letter with Approval'], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: 'GOV', finalProduct: 'Approved Travel Order',
    steps: [
      A(1, 'Counter-signed by FOD', 'OPAG', 1, 'next', 'fod'),
      A(2, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'approved', 'provincial_agriculturist'),
      A(3, 'Signed and Approved by the Governor', 'GOV', 3, 'approved', 'governor'),
    ],
  },
  {
    code: 'DTT', name: "Driver's Trip Ticket", category: 'Transport',
    prerequisites: ['Approved Travel Order'], prerequisiteCodes: ['TO'],
    originOffice: 'OPAG', refNumberOrigin: 'GOV', finalProduct: null,
    steps: [
      A(1, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(2, 'Signed and Approved by the Governor', 'GOV', null, 'approved', 'governor'),
    ],
  },
  {
    code: 'FCS', name: 'Fuel Charge Slip (Provincial)', category: 'Transport',
    prerequisites: ['Approved Travel Order'], prerequisiteCodes: ['TO'],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: null,
    steps: [
      A(1, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(2, 'Initial Signature of Admin Office', 'ADMINOFF', null, 'next', 'provincial_administrator'),
      A(3, 'Signed and Approved by the Governor', 'GOV', null, 'approved', 'governor'),
    ],
  },
  {
    code: 'FCS-U', name: 'Fuel Charge Slip (Outside)', category: 'Transport',
    prerequisites: ['Utilization Proposal'], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: 'OPAG', finalProduct: 'Approved Fuel Charge Slip (Outside)',
    steps: [
      A(1, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(2, 'Initial Signature of Admin Office', 'ADMINOFF', null, 'next', 'provincial_administrator'),
      A(3, 'Signed and Approved by the Governor', 'GOV', null, 'approved', 'governor'),
    ],
  },
  {
    code: 'LEAVE', name: 'Application for Leave', category: 'Personnel',
    prerequisites: [], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: 'Approved Leave',
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', 1, 'next', 'personnel'),
      A(2, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(3, 'Signed by HRMO', 'HRMO', 2, 'next', 'hrmo'),
      A(4, 'Signed and Approved by the Governor', 'GOV', 2, 'approved', 'governor'),
    ],
  },
  {
    code: 'PPMP', name: 'Project Procurement and Management Plan', category: 'Procurement',
    prerequisites: ['Market Scoping'], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: 'Approved PPMP',
    steps: [
      A(1, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 2, 'next', 'provincial_agriculturist'),
      A(2, 'Signed and Approved by Budget Officer', 'BUDGET', 2, 'next', 'budget_officer'),
    ],
  },
  {
    code: 'TEV', name: 'Travel Expense Voucher', category: 'Travel',
    prerequisites: ['Post-travel Report', 'Certificate of Travel Completed', 'Itinerary of Travel', 'Obligation Request'],
    prerequisiteCodes: ['PTR', 'CTC', 'ITR', 'OBR'],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: null,
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', 1, 'next', 'personnel'),
      A(2, 'Counter-signed by Records Officer', 'OPAG', 1, 'next', 'records_officer'),
      A(3, 'Counter-signed by Supply Officer', 'OPAG', 1, 'next', 'supply_officer'),
      A(4, 'For Signature of Provincial Agriculturist', 'OPAG', 1, 'next', 'records_officer', 'record_in'),
      // The sheet stops at the checkpoint above, which left the document
      // finished the moment it reached the PA's table. Steps 5 and 6 were added:
      // the signature itself, then the release — a TEV does not stay here once
      // signed. The release is written out rather than left to
      // `withPaCheckpoints`, which only adds one where a further step follows.
      A(5, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(6, 'Record Releasing from OPAg', 'OPAG', null, 'next', 'records_officer', 'record_out'),
    ],
  },
  {
    code: 'PR', name: 'Purchase Request', category: 'Procurement',
    prerequisites: ['Project Proposal', 'Approved PPMP'], prerequisiteCodes: ['PROP', 'PPMP'],
    originOffice: 'OPAG', refNumberOrigin: 'BAC', finalProduct: 'Approved PR',
    steps: [
      A(1, 'Counter-signed by Supply Officer', 'OPAG', 2, 'next', 'supply_officer'),
      A(2, 'Counter-signed by Planning Officer', 'OPAG', 1, 'next', 'planning_officer'),
      A(3, 'For Signature of Provincial Agriculturist', 'OPAG', 1, 'next', 'records_officer', 'record_in'),
      A(4, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(5, 'Record Releasing from OPAg', 'OPAG', null, 'next', 'records_officer', 'record_out'),
      A(6, 'For Checking and Countersign Evaluation of BAC', 'BAC', 1, 'next', 'bac'),
      A(7, 'For signature Evaluator (TWG)', 'BAC', 1, 'next', 'twg'),
      A(8, 'Return to BAC for PR Number', 'BAC', 1, 'next', 'bac'),
      A(9, 'For Earmark of Budget', 'BUDGET', 1, 'next', 'budget_officer'),
      A(10, 'Initial Signature of Admin Office', 'ADMINOFF', 7, 'next', 'provincial_administrator'),
      A(11, 'Signed and Approved by the Governor', 'GOV', 7, 'approved', 'governor'),
    ],
  },
  {
    // Split into two named variants: an obligation follows either a Purchase
    // Request (procurement) or a Travel Expense Voucher (travel reimbursement)
    // and the two are unrelated cases, so they read as two document types
    // rather than one generic "Obligation Request" that only sometimes applies.
    code: 'OBR', name: 'Obligation Request (PR)', category: 'Finance',
    prerequisites: ['Approved PR', 'Canvass', 'Approved Abstract'], prerequisiteCodes: ['PR'],
    originOffice: 'OPAG', refNumberOrigin: 'BUDGET', finalProduct: 'Approved OBR',
    steps: [
      A(1, 'Counter-signed by Supply Officer', 'OPAG', 1, 'next', 'supply_officer'),
      A(2, 'Counter-signed by Records Officer', 'OPAG', 1, 'next', 'records_officer'),
      A(3, 'Counter-signed by Planning Officer', 'OPAG', 1, 'next', 'planning_officer'),
      A(4, 'For Signature of Provincial Agriculturist', 'OPAG', null, 'next', 'records_officer', 'record_in'),
      A(5, 'Signed and Approved by Provincial Agriculturist', 'OPAG', null, 'next', 'provincial_agriculturist'),
      A(6, 'Signed and Approved by Budget Officer', 'BUDGET', null, 'approved', 'budget_officer'),
    ],
  },
  {
    code: 'OBR-TEV', name: 'Obligation Request (TEV)', category: 'Finance',
    prerequisites: ['Travel Expense Voucher'], prerequisiteCodes: ['TEV'],
    originOffice: 'OPAG', refNumberOrigin: 'BUDGET', finalProduct: 'Approved OBR (TEV)',
    steps: [
      A(1, 'Counter-signed by Supply Officer', 'OPAG', 1, 'next', 'supply_officer'),
      A(2, 'Counter-signed by Records Officer', 'OPAG', 1, 'next', 'records_officer'),
      A(3, 'Counter-signed by Planning Officer', 'OPAG', 1, 'next', 'planning_officer'),
      A(4, 'For Signature of Provincial Agriculturist', 'OPAG', null, 'next', 'records_officer', 'record_in'),
      A(5, 'Signed and Approved by Provincial Agriculturist', 'OPAG', null, 'next', 'provincial_agriculturist'),
      A(6, 'Signed and Approved by Budget Officer', 'BUDGET', null, 'approved', 'budget_officer'),
    ],
  },
  {
    code: 'PO', name: 'Purchase Order', category: 'Procurement',
    prerequisites: ['Approved PR', 'Canvass', 'Approved Abstract', 'Approved Obligation Request'],
    prerequisiteCodes: ['PR', 'OBR'],
    originOffice: 'BAC', refNumberOrigin: 'BAC', finalProduct: 'Approved Purchase Order',
    steps: [
      A(1, 'PO Number at BAC', 'BAC', 1, 'next', 'bac'),
      A(2, 'Counter-signed by Planning Officer', 'OPAG', 1, 'next', 'planning_officer'),
      A(3, 'Counter-signed by Records Officer', 'OPAG', 1, 'next', 'records_officer'),
      A(4, 'For Signature of Provincial Agriculturist', 'OPAG', null, 'next', 'records_officer', 'record_in'),
      A(5, 'Signed and Approved by Provincial Agriculturist', 'OPAG', null, 'next', 'provincial_agriculturist'),
      A(6, 'Signed and Approved by Accounting Officer', 'ACCT', null, 'next', 'accounting_officer'),
      A(7, 'Initial Signature of Admin Office', 'ADMINOFF', null, 'next', 'provincial_administrator'),
      A(8, 'Signed and Approved by the Governor', 'GOV', null, 'approved', 'governor'),
    ],
  },
  {
    code: 'DV', name: 'Disbursement Voucher', category: 'Finance',
    // The map lists PR, Canvass, Abstract, OBR and RIS. The office has since
    // confirmed that *every* document from PR through PO is attached, so the
    // Purchase Order is added here. See Q-D28.
    prerequisites: ['Approved PR', 'Canvass', 'Approved Abstract', 'Approved Obligation Request', 'Approved Purchase Order', 'Approved RIS / Acceptance'],
    prerequisiteCodes: ['PR', 'OBR', 'PO'],
    // The DV's own number is issued where the trail ends — the Governor's
    // release — the same shape as a Travel Order or an Obligation Request:
    // no separate step names the numbering, so it must be captured at
    // completion rather than at a step written out for it. See needsRefNumberNow.
    originOffice: 'OPAG', refNumberOrigin: 'GOV', finalProduct: 'Approved Cheque for Supplier',
    steps: [
      A(1, 'Signed and Approved by Accounting Officer', 'ACCT', 2, 'next', 'accounting_officer'),
      A(2, 'Signed and Approved by Treasurer', 'TREAS', 2, 'next', 'treasurer'),
      A(3, 'Checking of Internal Audit Service', 'ADMINOFF', 3, 'next', 'internal_audit'),
      A(4, 'Cheque Approval', 'TREAS', null, 'next', 'treasurer'),
      A(5, 'Signed and Approved by the Governor', 'GOV', null, 'release', 'governor'),
    ],
  },
  {
    code: 'OBS', name: 'Official Business Slip', category: 'Personnel',
    prerequisites: [], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: null,
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', 1, 'next', 'personnel'),
      A(2, 'Counter-signed by Supervising Agriculturist', 'OPAG', 1, 'next', 'supervising_agriculturist'),
      A(3, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'approved', 'provincial_agriculturist'),
    ],
  },
  {
    code: 'PAY-P', name: 'Payroll', variant: 'Permanent', category: 'Finance',
    prerequisites: ['Daily Time Record'], prerequisiteCodes: ['DTR'],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: null,
    steps: [
      A(1, 'Countersigned by AO', 'OPAG', 1, 'next', 'admin_officer'),
      A(2, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(3, 'Signed and Approved by Budget Officer', 'BUDGET', 1, 'next', 'budget_officer'),
      A(4, 'Signed and Approved by Accounting Officer', 'ACCT', 1, 'next', 'accounting_officer'),
      A(5, 'Signed and Approved by Treasurer', 'TREAS', 1, 'next', 'treasurer'),
      A(6, 'Initial Signature of Admin Office', 'ADMINOFF', 1, 'next', 'provincial_administrator'),
      A(7, 'Signed and Approved by the Governor', 'GOV', 1, 'next', 'governor'),
      A(8, 'Authority to Debit Account', 'TREAS', 1, 'next', 'treasurer'),
      A(9, 'For Bank Processing', 'BANK', null, 'release', 'bank'),
    ],
  },
  {
    code: 'PAY-C', name: 'Payroll', variant: 'Casual', category: 'Finance',
    prerequisites: ['Daily Time Record'], prerequisiteCodes: ['DTR'],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: null,
    steps: [
      A(1, 'Countersigned by AO', 'OPAG', 1, 'next', 'admin_officer'),
      A(2, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(3, 'Signed and Approved by Budget Officer', 'BUDGET', 1, 'next', 'budget_officer'),
      A(4, 'Signed and Approved by Accounting Officer', 'ACCT', 1, 'next', 'accounting_officer'),
      A(5, 'Signed and Approved by Treasurer', 'TREAS', 1, 'next', 'treasurer'),
      A(6, 'Initial Signature of Admin Office', 'ADMINOFF', 1, 'next', 'provincial_administrator'),
      A(7, 'Signed and Approved by the Governor', 'GOV', 1, 'next', 'governor'),
      A(8, 'Authority to Debit Account', 'TREAS', 1, 'next', 'treasurer'),
      A(9, 'For Bank Processing', 'BANK', null, 'release', 'bank'),
    ],
  },
  {
    code: 'PAY-JO', name: 'Payroll', variant: 'Job Order', category: 'Finance',
    prerequisites: ['Daily Time Record'], prerequisiteCodes: ['DTR'],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: null,
    steps: [
      A(1, 'Countersigned by AO', 'OPAG', 1, 'next', 'admin_officer'),
      A(2, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(3, 'Signed and Approved by Budget Officer', 'BUDGET', 1, 'next', 'budget_officer'),
      A(4, 'Audit of Accounting', 'ACCT', 1, 'next', 'accounting_officer'),
      A(5, 'Signed and Approved by Treasurer', 'TREAS', 1, 'next', 'treasurer'),
      A(6, 'Initial Signature of Admin Office', 'ADMINOFF', 2, 'next', 'provincial_administrator'),
      A(7, 'Signed and Approved by Accounting Officer', 'ACCT', 2, 'next', 'accounting_officer'),
      A(8, 'Cheque Approval', 'GOV', 1, 'next', 'governor'),
      A(9, 'Withdrawal for Release', 'TREAS', null, 'release', 'treasurer'),
    ],
  },
  {
    code: 'PROP', name: 'Project Proposal', category: 'Planning',
    prerequisites: [], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: 'Approved Project Proposal',
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', 1, 'next', 'personnel'),
      A(2, 'Counter-signed by FOD', 'OPAG', 1, 'next', 'fod'),
      A(3, 'Counter-signed by Supply Officer', 'OPAG', 1, 'next', 'supply_officer'),
      A(4, 'Counter-signed by Planning Officer', 'OPAG', 1, 'next', 'planning_officer'),
      A(5, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'next', 'provincial_agriculturist'),
      A(6, 'Signed and Approved by Budget Officer', 'BUDGET', 1, 'next', 'budget_officer'),
      A(7, 'Signed and Approved by the Governor', 'GOV', 1, 'approved', 'governor'),
    ],
  },
  {
    code: 'ENDO', name: 'Endorsement Letter', category: 'Communications',
    prerequisites: ['Endorsement Letter from MAO'], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: null, finalProduct: 'Signed Endorsement Letter',
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', 1, 'next', 'personnel'),
      A(2, 'Signed and Approved by Provincial Agriculturist', 'OPAG', 1, 'approved', 'provincial_agriculturist'),
    ],
  },
  {
    code: 'COMM-OUT', name: 'Communication Letter (Outgoing)', category: 'Communications',
    prerequisites: [], prerequisiteCodes: [],
    originOffice: 'OPAG', refNumberOrigin: 'OPAG', finalProduct: 'Signed Letter',
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', null, 'next', 'personnel'),
      A(2, 'Counter-signed by FOD', 'OPAG', null, 'next', 'fod'),
      A(3, 'Signed and Approved by Provincial Agriculturist', 'OPAG', null, 'release', 'provincial_agriculturist'),
    ],
  },
  {
    code: 'COMM-IN', name: 'Communication Letter (Incoming)', category: 'Communications',
    prerequisites: [], prerequisiteCodes: [],
    originOffice: 'EXTERNAL', refNumberOrigin: null, finalProduct: 'With Routing Slip',
    steps: [
      A(1, 'Signed by Personnel', 'OPAG', null, 'next', 'personnel'),
    ],
  },
]

/* ---------------------------------------------------------------------------
   The Provincial Agriculturist checkpoint rule.

   Requirement: every step immediately before and after the PA signs must be
   recorded, so the office can see how long a document sits on that desk.

   The sheet already does this explicitly for PR, OBR and PO. This function
   applies the same pattern to every other trail, so the behaviour is uniform
   without editing the transcription above.
   --------------------------------------------------------------------------- */
export function withPaCheckpoints(trail: Trail): Trail {
  const out: TrailStep[] = []
  let seq = 0

  for (let i = 0; i < trail.steps.length; i++) {
    const step = trail.steps[i]
    const isPaSig = step.signatory === 'provincial_agriculturist' && step.kind === 'action'
    const prev = out[out.length - 1]
    const next = trail.steps[i + 1]

    if (isPaSig && !(prev && prev.kind === 'record_in')) {
      out.push({
        seq: ++seq,
        requirement: 'For Signature of Provincial Agriculturist',
        officeCode: 'OPAG', days: null, outcome: 'next',
        kind: 'record_in', signatory: 'records_officer', isCheckpoint: true,
      })
    }

    out.push({ ...step, seq: ++seq })

    // Whether the sheet marked the signature "next" or "approved" says nothing
    // about whether the paper then leaves the office — only whether a step
    // follows does. Gating on the outcome meant a Travel Order jumped from the
    // PA's desk straight to the Governor with no release recorded, and no-one
    // asked which liaison was carrying it.
    if (isPaSig && next && next.kind !== 'record_out') {
      out.push({
        seq: ++seq,
        requirement: 'Record Releasing from OPAg',
        officeCode: 'OPAG', days: null, outcome: 'next',
        kind: 'record_out', signatory: 'records_officer', isCheckpoint: true,
      })
    }
  }

  return { ...trail, steps: out }
}

/* ---------------------------------------------------------------------------
   Receiving the document back.

   A document that leaves OPAg and comes back was, until now, simply picked up
   again at its next in-office step — nothing recorded that it had returned, and
   nothing captured the number the outside office had written on it in the
   meantime. This inserts a recording step at every point the route crosses back
   into OPAg, so the office logs the arrival before the document goes any
   further, and above all before it reaches the Provincial Agriculturist.
   --------------------------------------------------------------------------- */
export function withReceiptCheckpoints(trail: Trail): Trail {
  const out: TrailStep[] = []
  let seq = 0

  for (const step of trail.steps) {
    const prev = trail.steps[trail.steps.indexOf(step) - 1]
    const comingBack = prev && prev.officeCode !== 'OPAG' && step.officeCode === 'OPAG'

    if (comingBack && step.kind === 'action') {
      out.push({
        seq: ++seq,
        requirement: `Record receipt at OPAg from ${TRAIL_OFFICES[prev.officeCode] ?? prev.officeCode}`,
        officeCode: 'OPAG', days: null, outcome: 'next',
        kind: 'record_receipt', signatory: 'records_officer', isCheckpoint: true,
      })
    }

    out.push({ ...step, seq: ++seq })
  }

  return { ...trail, steps: out }
}

/** Offices named in the trail, with display names. */
export const TRAIL_OFFICES: Record<string, string> = {
  OPAG: 'Office of the Provincial Agriculturist',
  GOV: "Governor's Office",
  BUDGET: 'Provincial Budget Office',
  ACCT: 'Provincial Accounting Office',
  TREAS: 'Provincial Treasurer’s Office',
  HRMO: 'Human Resource Management Office',
  GSO: 'General Services Office',
  BAC: 'BAC Office',
  ADMINOFF: 'Office of the Provincial Administrator',
  BANK: 'Land Bank / servicing bank',
  EXTERNAL: 'External sender',
}

// Built after TRAIL_OFFICES, whose display names the receipt steps read as the
// trails are assembled.
/**
 * Short forms of the same offices, for status text that has to fit in a pill —
 * "In transit to Governor's Office" reads; the full legal name does not.
 */
export const OFFICE_SHORT: Record<string, string> = {
  OPAG: 'OPAg',
  GOV: "Governor's Office",
  BUDGET: 'Budget Office',
  ACCT: 'Accounting Office',
  TREAS: "Treasurer's Office",
  HRMO: 'HRMO',
  GSO: 'GSO',
  BAC: 'BAC',
  ADMINOFF: "Administrator's Office",
  BANK: 'the bank',
  EXTERNAL: 'external sender',
}

export const TRAILS_WITH_CHECKPOINTS: Trail[] = TRAILS
  .map(withPaCheckpoints)
  .map(withReceiptCheckpoints)

export function trailFor(code: string): Trail | undefined {
  return TRAILS_WITH_CHECKPOINTS.find((t) => t.code === code)
}

export const SIGNATORY_LABEL: Record<Signatory, string> = {
  personnel: 'Personnel',
  fod: 'Field Operations Division',
  supply_officer: 'Supply Officer',
  records_officer: 'Records Officer',
  planning_officer: 'Planning Officer',
  supervising_agriculturist: 'Supervising Agriculturist',
  admin_officer: 'Administrative Officer (OPAg)',
  provincial_administrator: 'Provincial Administrator',
  provincial_agriculturist: 'Provincial Agriculturist',
  governor: 'Governor',
  budget_officer: 'Budget Officer',
  accounting_officer: 'Accounting Officer',
  treasurer: 'Treasurer',
  hrmo: 'HRMO',
  gso: 'GSO',
  bac: 'BAC',
  twg: 'Technical Working Group',
  internal_audit: 'Internal Audit Service',
  bank: 'Bank',
  system: 'System',
}

/** Total working days a trail is expected to take, ignoring blanks. */
export function trailDays(trail: Trail): number {
  return trail.steps.reduce((n, s) => n + (s.days ?? 0), 0)
}

/* ---------------------------------------------------------------------------
   Document chains.

   Procurement is not seven independent documents — it is one continuous
   transaction that spans them. The items on a Purchase Request are not
   actually procured until the Purchase Order is approved, and paying the
   supplier requires every document from PR through PO attached to the
   Disbursement Voucher.

   A chain groups those documents so a coordinator asking "where is my
   purchase?" gets one answer instead of seven.
   --------------------------------------------------------------------------- */

export interface Chain {
  code: string
  name: string
  description: string
  /** ordered document codes; each depends on the ones before it */
  sequence: string[]
}

export const CHAINS: Chain[] = [
  {
    code: 'PROCUREMENT',
    name: 'Procurement and payment',
    description:
      'One continuous transaction. Items requested on the PR are only procured once the PO is approved, ' +
      'and every document from PR through PO is attached to the Disbursement Voucher to pay the supplier.',
    sequence: ['PROP', 'PPMP', 'PR', 'OBR', 'PO', 'DV'],
  },
  {
    code: 'TRAVEL',
    name: 'Travel and reimbursement',
    description:
      'Two linked transactions. The Travel Order is approved before travel; the TEV is prepared after it, ' +
      'and carries the post-travel documents.',
    sequence: ['TO', 'DTT', 'FCS', 'TEV'],
  },
]

export function chainFor(code: string): Chain | undefined {
  return CHAINS.find((c) => c.sequence.includes(code))
}

/** Position of a document type within its chain, 1-based. */
export function chainPosition(code: string): { chain: Chain; index: number } | undefined {
  const chain = chainFor(code)
  if (!chain) return undefined
  return { chain, index: chain.sequence.indexOf(code) + 1 }
}

/** Total working days budgeted across a whole chain. */
export function chainDays(chain: Chain): number {
  return chain.sequence.reduce((n, code) => {
    const t = TRAILS_WITH_CHECKPOINTS.find((x) => x.code === code)
    return n + (t ? trailDays(t) : 0)
  }, 0)
}

/** Total steps across a whole chain. */
export function chainSteps(chain: Chain): number {
  return chain.sequence.reduce((n, code) => {
    const t = TRAILS_WITH_CHECKPOINTS.find((x) => x.code === code)
    return n + (t ? t.steps.length : 0)
  }, 0)
}
