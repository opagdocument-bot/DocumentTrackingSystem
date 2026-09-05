import type { DB, Doc, DocumentType, Office, Program, StepLog, User } from '../types'
import { TRAILS_WITH_CHECKPOINTS, TRAIL_OFFICES } from './trail'
import { paperNumber } from '../lib/workflow'

// ---------------------------------------------------------------------------
// Offices, programs and people. Offices come from the org chart plus every
// office named in the document trail.
// ---------------------------------------------------------------------------

export const offices: Office[] = [
  { id: 'o-opag', code: 'OPAG', name: TRAIL_OFFICES.OPAG, type: 'opa_division', isRoutable: true },
  { id: 'o-admin', code: 'ADMIN', name: 'Administrative Division', type: 'opa_division', isRoutable: true },
  { id: 'o-fod', code: 'FOD', name: 'Field Operations Division', type: 'opa_division', isRoutable: true },
  { id: 'o-plan', code: 'PLANNING', name: 'Planning Unit', type: 'opa_division', isRoutable: true },
  { id: 'o-fish', code: 'FISHERIES', name: 'Fisheries & Aquatic Resources Division', type: 'opa_division', isRoutable: true },
  { id: 'o-fmsd', code: 'FMSD', name: 'Farm Management Services Division', type: 'opa_division', isRoutable: true },
  { id: 'o-apadtc', code: 'APADTC', name: 'Aurora Provincial Agricultural Devt & Training Center', type: 'opa_facility', isRoutable: false },
  { id: 'o-aftc', code: 'AFTC', name: 'Aurora Fisheries Technology Center', type: 'opa_facility', isRoutable: false },

  { id: 'o-gov', code: 'GOV', name: TRAIL_OFFICES.GOV, type: 'pg_office', isRoutable: true },
  { id: 'o-budget', code: 'BUDGET', name: TRAIL_OFFICES.BUDGET, type: 'pg_office', isRoutable: true },
  { id: 'o-acct', code: 'ACCT', name: TRAIL_OFFICES.ACCT, type: 'pg_office', isRoutable: true },
  { id: 'o-treas', code: 'TREAS', name: TRAIL_OFFICES.TREAS, type: 'pg_office', isRoutable: true },
  { id: 'o-hrmo', code: 'HRMO', name: TRAIL_OFFICES.HRMO, type: 'pg_office', isRoutable: true },
  { id: 'o-gso', code: 'GSO', name: TRAIL_OFFICES.GSO, type: 'pg_office', isRoutable: true },
  { id: 'o-bac', code: 'BAC', name: TRAIL_OFFICES.BAC, type: 'pg_office', isRoutable: true },
  { id: 'o-adminoff', code: 'ADMINOFF', name: TRAIL_OFFICES.ADMINOFF, type: 'pg_office', isRoutable: true },
  { id: 'o-bank', code: 'BANK', name: TRAIL_OFFICES.BANK, type: 'external', isRoutable: true },
  { id: 'o-external', code: 'EXTERNAL', name: TRAIL_OFFICES.EXTERNAL, type: 'external', isRoutable: false },
]

export function officeIdFor(code: string): string {
  return offices.find((o) => o.code === code)?.id ?? 'o-opag'
}

/**
 * The office's programs, per the corrected list (2026-09-05) — codes and full
 * names both matter, since the code is what shows in the tag and the name is
 * what shows in the picker.
 *
 * `p-admin` is not one of them. It stays only as the internal bucket for
 * document types that carry no program at all (LEAVE, payroll, PPMP — see
 * NO_PROGRAM) so those documents still have *something* to render in a
 * Program column; Intake's own picker filters it back out, since it was never
 * a real choice for an ordinary program-bearing document.
 */
export const programs: Program[] = [
  { id: 'p-agribiz', code: 'AGRIBIZ', name: 'Agribusiness & Marketing Program', color: '#F9CFA6' },
  { id: 'p-corn-cassava', code: 'CORN & CASSAVA', name: 'Corn & Cassava Program', color: '#F6E48A' },
  { id: 'p-fishery-aquatic', code: 'FISHERY & AQUATIC', name: 'Fishery & Aquatic Division', color: '#CCE7B0' },
  { id: 'p-gad', code: 'GAD', name: 'Gender & Development Program', color: '#BFD9EC' },
  { id: 'p-hvcdp', code: 'HVCDP', name: 'High Value Crops Development Program', color: '#E0CDEC' },
  { id: 'p-organic', code: 'ORGANIC', name: 'Organic Agriculture Program', color: '#C00000' },
  { id: 'p-4h', code: '4H', name: '4H Program (RBO)', color: '#E8751A' },
  { id: 'p-ric', code: 'RIC', name: 'Rural Improvement Club Program (RBO)', color: '#7B3F00' },
  { id: 'p-p4mp', code: 'P4MP', name: 'Pambansang Mannalon, Magbabaul, Mag-uuma, Magsasaka ng Pilipinas (RBO)', color: '#1B7F79' },
  { id: 'p-rice', code: 'RICE', name: 'Rice Program', color: '#4A4A2A' },
  { id: 'p-agri-tourism', code: 'AGRI TOURISM', name: 'Farm Tourism Development Program', color: '#D98880' },
  { id: 'p-apadtc', code: 'APADTC', name: 'Aurora Provincial Agricultural Development and Training Center', color: '#0563C1' },
  { id: 'p-adess', code: 'ADESs', name: 'Agricultural Development Satellite Station', color: '#8E7CC3' },
  { id: 'p-aftec', code: 'AFTEc', name: 'Aurora Fresh Water Technology Center', color: '#45B39D' },
  { id: 'p-pafes', code: 'PAFES', name: 'Province-led Agriculture and Fishery Extension System', color: '#2E8B22' },
  { id: 'p-spa', code: 'SPA', name: 'Special Program in Agriculture', color: '#B7950B' },
  { id: 'p-insti', code: 'INSTI', name: 'Institutional Development Program', color: '#5D6D7E' },
  { id: 'p-pcpc', code: 'PCPC', name: 'Support Projects to Provincial Council for the Protection of Children', color: '#F04E98' },
  { id: 'p-araw-ng-agri', code: 'ARAW NG AGRI', name: 'Araw ng Agrikultura', color: '#D68910' },
  { id: 'p-arp', code: 'ARP', name: 'Agricultural Resiliency Program', color: '#A93226' },
  { id: 'p-ldrrm', code: 'LDRRM', name: '5% LDRRM Funds', color: '#7A1F7A' },
  { id: 'p-admin', code: 'ADMIN', name: 'Administrative & Finance', color: '#F2C4C4' },
]

/** Programs that exist only for internal bookkeeping, never offered as a choice. */
export const INTERNAL_PROGRAM_IDS = new Set(['p-admin'])

/**
 * Object codes from the Revised Chart of Accounts — every MOOE line and every
 * Capital Outlay / PPE line, not a curated subset. Sourced 2026-09-05 from the
 * office's own account-codes spreadsheet (the "MOOE and Capital Outlay" sheet),
 * which is now this list's basis. The field is a combo box, not a closed list —
 * anything not here can still be typed, so a code the sheet is missing never
 * blocks a Purchase Request.
 */
export const ACCOUNT_CODES: Record<string, string> = {
  '5-02-01-010': 'Traveling Expenses - Local',
  '5-02-01-020': 'Traveling Expenses - Foreign',
  '5-02-02-010': 'Training Expenses',
  '5-02-02-020': 'Scholarship Grants/Expenses',
  '5-02-03-010': 'Office Supplies Expenses',
  '5-02-03-020': 'Accountable Forms Expenses',
  '5-02-03-030': 'Non-Accountable Forms Expenses',
  '5-02-03-040': 'Animal/Zoological Supplies Expenses',
  '5-02-03-050': 'Food Supplies Expenses',
  '5-02-03-060': 'Welfare Goods Expenses',
  '5-02-03-070': 'Drugs and Medicines Expenses',
  '5-02-03-080': 'Medical, Dental and Lab. Supplies Expenses',
  '5-02-03-090': 'Fuel, Oil and Lubricants Expenses',
  '5-02-03-100': 'Agricultural and Marine Supplies Expenses',
  '5-02-03-110': 'Textbooks and Instructional Materials Expenses',
  '5-02-03-120': 'Military, Police and Traffic Supplies Expenses',
  '5-02-03-130': 'Chemical and Filtering Supplies Expenses',
  '5-02-03-990': 'Other Supplies and Materials Expenses',
  '5-02-04-010': 'Water Expenses',
  '5-02-04-020': 'Electricity Expenses',
  '5-02-05-010': 'Postage and Courier Services',
  '5-02-05-020': 'Telephone Expenses',
  '5-02-05-030': 'Internet Subscription Expenses',
  '5-02-05-040': 'Cable, Satellite, Telegraph and Radio Expenses',
  '5-02-06-010': 'Awards/Rewards Expenses',
  '5-02-06-020': 'Prizes',
  '5-02-07-010': 'Survey Expenses',
  '5-02-07-020': 'Research, Exploration and Development Expenses',
  '5-02-08-010': 'Demolition and Relocation Expenses',
  '5-02-08-020': 'Desilting and Dredging Expenses',
  '5-02-09-010': 'Generation, Transmission and Distribution Expenses',
  '5-02-10-010': 'Confidential Expenses',
  '5-02-10-020': 'Intelligence Expenses',
  '5-02-10-030': 'Extraordinary and Miscellaneous Expenses',
  '5-02-11-010': 'Legal Services',
  '5-02-11-020': 'Auditing Services',
  '5-02-11-030': 'Consultancy Services',
  '5-02-11-990': 'Other Professional Services',
  '5-02-12-010': 'Environment/Sanitary Services',
  '5-02-12-020': 'Janitorial Services',
  '5-02-12-030': 'Security Services',
  '5-02-12-990': 'Other General Services',
  '5-02-13-010': 'Repairs and Maint. - Investment Property',
  '5-02-13-020': 'Repairs and Maint. - Land Improvements',
  '5-02-13-030': 'Repairs and Maint. - Infrastructure Assets',
  '5-02-13-040': 'Repairs and Maint. - Bldgs & Other Structures',
  '5-02-13-050': 'Repairs and Maint. - Machinery & Equipment',
  '5-02-13-060': 'Repairs and Maint. - Transportation Equipment',
  '5-02-13-070': 'Repairs and Maint. - Furniture and Fixtures',
  '5-02-13-080': 'Repairs and Maint. - Leased Assets',
  '5-02-13-090': 'Repairs and Maint. - Leased Assets Improvements',
  '5-02-13-990': 'Repairs and Maint. - Other PPE',
  '5-02-14-020': 'Subsidy to NGAs',
  '5-02-14-030': 'Subsidy to Other Local Government Units',
  '5-02-16-010': 'Taxes, Duties and Licenses',
  '5-02-16-020': 'Fidelity Bond Premiums',
  '5-02-16-030': 'Insurance Expenses',
  '5-02-99-010': 'Advertising Expenses',
  '5-02-99-020': 'Printing and Publication Expenses',
  '5-02-99-030': 'Representation Expenses',
  '5-02-99-040': 'Transportation and Delivery Expenses',
  '5-02-99-050': 'Rent Expenses',
  '5-02-99-060': 'Membership Dues and Contributions to Org.',
  '5-02-99-070': 'Subscription Expenses',
  '5-02-99-080': 'Donations',
  '5-02-99-990': 'Other Maintenance and Operating Expenses',
  '5-03-01-020': 'Interest Expenses',
  '5-03-01-030': 'Guarantee Fees',
  '5-03-01-040': 'Bank Charges',
  '1-07-01-010': 'Land',
  '1-07-02-010': 'Land Improvements, Aquaculture Structures',
  '1-07-02-990': 'Other Land Improvements',
  '1-07-03-010': 'Road Networks',
  '1-07-03-040': 'Water Supply Systems',
  '1-07-03-050': 'Power Supply Systems',
  '1-07-03-090': 'Parks, Plazas and Monuments',
  '1-07-03-990': 'Other Infrastructure Assets',
  '1-07-04-010': 'Buildings',
  '1-07-04-990': 'Other Structures',
  '1-07-05-010': 'Machinery',
  '1-07-05-020': 'Office Equipment',
  '1-07-05-030': 'Information and Communication Tech. Equipment',
  '1-07-05-040': 'Agricultural and Forestry Equipment',
  '1-07-05-050': 'Marine and Fishery Equipment',
  '1-07-05-070': 'Communication Equipment',
  '1-07-05-080': 'Construction and Heavy Equipment',
  '1-07-05-090': 'Disaster Response and Rescue Equipment',
  '1-07-05-100': 'Military, Police and Security Equipment',
  '1-07-05-110': 'Medical Equipment',
  '1-07-05-120': 'Printing Equipment',
  '1-07-05-990': 'Other Machinery and Equipment',
  '1-07-06-010': 'Motor Vehicles',
  '1-07-07-010': 'Furniture and Fixtures',
  '1-07-99-990': 'Other Property, Plant and Equipment',
  '1-09-01-020': 'Computer Software',
}

/** Purchase Request goods classes, used to route PRs to the right liaison. */
export const PR_CATEGORIES = [
  'Meals and Snacks', 'Token', 'Accommodation', 'Office Supplies',
  'Training Materials', 'Agri. Supplies', 'Spareparts', 'Other',
]

/**
 * People and their roles, from the office's user matrix. Liaisons are assigned
 * by document type — and for Purchase Requests, by class of goods.
 */
export const users: User[] = [
  // --- Encoder and Reviewer: one role, not two. Handles everything in-office.
  { id: 'u-loraine', username: 'loraine', password: 'loraine@opag', name: 'Loraine', position: 'Encoder and Reviewer', officeId: 'o-admin', roles: ['encoder'], scopeProgramId: null, signatory: 'records_officer', device: 'web' },
  { id: 'u-lai', username: 'lai', password: 'lai@opag', name: 'Lai', position: 'Encoder and Reviewer', officeId: 'o-admin', roles: ['encoder'], scopeProgramId: null, signatory: 'records_officer', device: 'web' },

  // --- Liaisons: phone app, each assigned specific documents
  {
    id: 'u-lavinia', username: 'ldulay', password: 'ldulay@opag', name: 'Lavinia Dulay', position: 'Liaison Officer', officeId: 'o-admin',
    roles: ['liaison'], scopeProgramId: null, device: 'phone',
    assignment: { trailCodes: ['PR'], prCategories: ['Meals and Snacks', 'Token', 'Accommodation', 'Office Supplies', 'Training Materials'], catchAll: true },
  },
  {
    id: 'u-alfredo', username: 'aescobar', password: 'aescobar@opag', name: 'Alfredo Escobar', position: 'Liaison Officer', officeId: 'o-admin',
    roles: ['liaison'], scopeProgramId: null, device: 'phone',
    assignment: { trailCodes: ['PR', 'TO', 'DTT', 'FCS', 'FCS-U'], prCategories: ['Agri. Supplies', 'Spareparts'], catchAll: true },
  },
  {
    id: 'u-aaron', username: 'aposerio', password: 'aposerio@opag', name: 'Aaron Poserio', position: 'Liaison Officer', officeId: 'o-admin',
    roles: ['liaison'], scopeProgramId: null, device: 'phone',
    assignment: { trailCodes: ['PAY-JO'] },
  },
  {
    id: 'u-yam', username: 'ytolentino', password: 'ytolentino@opag', name: 'Yam Tolentino', position: 'Liaison Officer', officeId: 'o-admin',
    roles: ['liaison'], scopeProgramId: null, device: 'phone',
    assignment: { trailCodes: ['PAY-C', 'PAY-P'] },
  },
  {
    id: 'u-lyka', username: 'lcrisanto', password: 'lcrisanto@opag', name: 'Lyka Crisanto', position: 'Liaison Officer', officeId: 'o-admin',
    roles: ['liaison'], scopeProgramId: null, device: 'phone',
    assignment: { trailCodes: ['TO', 'LEAVE', 'COMM-OUT', 'COMM-IN', 'ENDO'], catchAll: true },
  },

  // --- Provincial Agriculturist: oversight only, updates nothing
  { id: 'u-arnold', username: 'anovicio', password: 'anovicio@opag', name: 'Arnold B. Novicio', position: 'Provincial Agriculturist', officeId: 'o-opag', roles: ['pa'], scopeProgramId: null, signatory: 'provincial_agriculturist', device: 'web' },

  // --- Viewers: OPAg employees
  { id: 'u-lorenzo', username: 'lorenzo', password: 'lorenzo@opag', name: 'Lorenzo', position: 'Agriculturist II · Rice Program', officeId: 'o-fod', roles: ['viewer'], scopeProgramId: null, device: 'web' },
]

/** Which liaison a document belongs to, per the office's assignment matrix. */
export function liaisonFor(trailCode: string, prCategory?: string): User | undefined {
  const liaisons = users.filter((u) => u.roles.includes('liaison') && u.assignment)
  // Purchase Requests route on the class of goods first.
  if (trailCode === 'PR' && prCategory) {
    const byGoods = liaisons.find((u) => u.assignment!.prCategories?.includes(prCategory))
    if (byGoods) return byGoods
  }
  const exact = liaisons.filter((u) => u.assignment!.trailCodes.includes(trailCode))
  if (exact.length) return exact[0]
  return liaisons.find((u) => u.assignment!.catchAll)
}

// ---------------------------------------------------------------------------
// Document types — one per trail, with the intake fields each needs.
// ---------------------------------------------------------------------------

/**
 * Leave types available to government employees, from the Civil Service
 * Commission's Omnibus Rules on Leave (CSC MC 41 s. 1998, as amended).
 */
export const LEAVE_TYPES = [
  'Vacation Leave',
  'Mandatory/Forced Leave',
  'Sick Leave',
  'Special Privilege Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Parental Leave for Solo Parents',
  'Study Leave',
  'Rehabilitation Privilege',
  'Special Leave Benefits for Women',
  'Special Emergency (Calamity) Leave',
  '10-Day VAWC Leave',
  'Adoption Leave',
  'Terminal Leave',
  'Leave Without Pay',
]

const travelFields: DocumentType['fields'] = [
  { key: 'travellers', labelEn: 'Traveller(s)', labelFil: 'Manlalakbay', type: 'people', required: true },
  { key: 'date_of_travel', labelEn: 'Date of travel', labelFil: 'Petsa ng Biyahe', type: 'text', required: true },
  { key: 'destination', labelEn: 'Destination', labelFil: 'Patutunguhan', type: 'text', required: true },
  { key: 'purpose', labelEn: 'Purpose', labelFil: 'Layunin', type: 'textarea', required: true },
]

/** A TEV is collected and filed by the month, so it names no single trip. */
const tevFields: DocumentType['fields'] = [
  { key: 'travellers', labelEn: 'Traveller(s)', labelFil: 'Manlalakbay', type: 'people', required: true },
  { key: 'date_of_travel', labelEn: 'Period covered', labelFil: 'Panahong Sakop', type: 'text', required: true },
]

const leaveFields: DocumentType['fields'] = [
  { key: 'name', labelEn: 'Name', labelFil: 'Pangalan', type: 'text', required: true },
  { key: 'leave_type', labelEn: 'Type of leave', labelFil: 'Uri ng Bakasyon', type: 'select', options: LEAVE_TYPES, required: true },
  { key: 'leave_dates', labelEn: 'Date(s) of leave', labelFil: 'Petsa ng Bakasyon', type: 'text', required: true },
]

/** Official Business Slip — a person, going somewhere, for a reason. */
const obsFields: DocumentType['fields'] = [
  { key: 'name', labelEn: 'Name', labelFil: 'Pangalan', type: 'text', required: true },
  { key: 'date_time', labelEn: 'Date / time', labelFil: 'Petsa at Oras', type: 'text', required: true },
  { key: 'destination', labelEn: 'Destination', labelFil: 'Patutunguhan', type: 'text', required: true },
  { key: 'purpose', labelEn: 'Purpose', labelFil: 'Layunin', type: 'textarea', required: true },
]

const moneyFields: DocumentType['fields'] = [
  { key: 'purpose', labelEn: 'Purpose', labelFil: 'Layunin', type: 'textarea', required: true },
  {
    key: 'account_code', labelEn: 'Account code', labelFil: 'Account Code',
    type: 'combo', options: Object.keys(ACCOUNT_CODES), optionLabels: ACCOUNT_CODES, required: true,
  },
  { key: 'fund_source', labelEn: 'Fund source', labelFil: 'Pinagkunan ng Pondo', type: 'select', options: ['Trust Fund', 'General Fund', 'Special Purpose Appropriation'], required: true },
  // 'Activity or purpose' used to sit here too, asking the same question as
  // Purpose above in different words. Chains.tsx still reads fields.activity_name
  // where an older document happens to carry it, falling back to the subject
  // line for grouping otherwise — removing the input didn't need touching that.
  { key: 'supply_category', labelEn: 'Class of goods', labelFil: 'Uri ng Bibilhin', type: 'select', options: PR_CATEGORIES, required: true },
]

/** A letter comes from somebody, or goes to somebody — never both. */
const letterFields = (direction: 'From' | 'To'): DocumentType['fields'] => [
  { key: 'origin', labelEn: direction, labelFil: direction === 'From' ? 'Mula kay' : 'Para kay', type: 'text', required: true },
  { key: 'content', labelEn: 'Content / purpose', labelFil: 'Nilalaman', type: 'textarea', required: true },
  { key: 'activity_datetime', labelEn: 'Date / time of activity', labelFil: 'Petsa at Oras', type: 'text', required: true },
  { key: 'place', labelEn: 'Place', labelFil: 'Lugar', type: 'text', required: true },
]

const FIELDS_BY_CATEGORY: Record<string, DocumentType['fields']> = {
  Travel: travelFields,
  Transport: travelFields,
  Procurement: moneyFields,
  Finance: moneyFields,
  Planning: moneyFields,
  Personnel: obsFields,
  Communications: letterFields('From'),
}

/**
 * Where a document type needs its own shape rather than its category's.
 *
 * An empty list means the type carries no detail beyond its Description:
 * payroll is not charged to a program or activity, and the PPMP is the whole
 * office's procurement plan in one document.
 */
const FIELDS_BY_CODE: Record<string, DocumentType['fields']> = {
  TEV: tevFields,
  LEAVE: leaveFields,
  'COMM-IN': letterFields('From'),
  'COMM-OUT': letterFields('To'),
  PPMP: [],
  'PAY-P': [], 'PAY-C': [], 'PAY-JO': [],
}

/**
 * Values captured outside a type's own field list, so they still read as
 * something other than a raw key wherever document details are shown.
 */
export const EXTRA_FIELD_LABELS: Record<string, string> = {
  supply_category_other: 'Class of goods (specified)',
}

/** Document types that belong to no single program. */
export const NO_PROGRAM = new Set(['PAY-P', 'PAY-C', 'PAY-JO', 'PPMP', 'LEAVE'])

/**
 * Types that are never asked for a Description, because their own detail fields
 * already say what the document is. The headline shown in the registry and on
 * every dashboard is built from those fields instead — a leave application is
 * identified by whose leave it is and what kind, not by a line of prose.
 */
export const DERIVED_SUBJECT: Record<string, ((f: Record<string, string>) => string) | undefined> = {
  LEAVE: (f) => [f.leave_type, f.name].filter(Boolean).join(' — '),
}

const SENSITIVE = new Set(['PAY-P', 'PAY-C', 'PAY-JO', 'DV'])

export const types: DocumentType[] = TRAILS_WITH_CHECKPOINTS.map((t) => ({
  id: `t-${t.code.toLowerCase()}`,
  code: t.code,
  name: t.name,
  variant: t.variant,
  category: t.category,
  captureProfile: t.code === 'COMM-IN' ? 'receiving' : 'signatory',
  sensitivity: SENSITIVE.has(t.code) ? 'confidential' : 'internal',
  fields: FIELDS_BY_CODE[t.code] ?? FIELDS_BY_CATEGORY[t.category] ?? letterFields('From'),
}))

// ---------------------------------------------------------------------------
// Seeded documents, adapted from real rows in OPAG documents 2026.xlsx and
// positioned at realistic points along their trails.
// ---------------------------------------------------------------------------

let seq = 300

/**
 * Issue control numbers first-come, first-served — the same rule the running
 * system follows.
 *
 * `mk` is called in source order, which is not the order the documents were
 * created, so numbering inside `mk` produced a series that ran backwards
 * against the dates. Numbering happens here instead, in a second pass: sort by
 * creation date, then count within each document type and month. The month is
 * part of the key, so every type restarts at 0001 on the first of the month.
 *
 * This is the only place seed documents are numbered.
 */
function numberInOrder(docs: Doc[]): Doc[] {
  const runningSeq: Record<string, number> = {}
  return [...docs]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((d) => {
      const [year, month] = d.createdAt.split('-')
      const key = `${d.trailCode}-${year}-${month}`
      runningSeq[key] = (runningSeq[key] ?? 0) + 1
      const controlNo = `OPA-${d.trailCode}-${year}-${month}-${String(runningSeq[key]).padStart(4, '0')}`
      const trail = TRAILS_WITH_CHECKPOINTS.find((t) => t.code === d.trailCode)
      return {
        ...d,
        controlNo,
        // A type the office numbers itself carries the tail of its own number.
        refNumber: trail?.refNumberOrigin === 'OPAG' ? paperNumber(controlNo) : d.refNumber,
      }
    })
}

function mk(
  trailCode: string, programCode: string, subject: string, createdAt: string,
  fields: Record<string, string>, opts: Partial<Doc> & { stepsDone?: number } = {},
): Doc {
  const trail = TRAILS_WITH_CHECKPOINTS.find((t) => t.code === trailCode)!
  const program = programs.find((p) => p.code === programCode)!
  seq += 1
  const id = `d-${trailCode.toLowerCase()}-${seq}`
  const month = createdAt.slice(5, 7)
  const year = createdAt.slice(0, 4)

  const stepsDone = opts.stepsDone ?? 0
  const stepLog: StepLog[] = []
  const assignedLiaison = liaisonFor(trailCode, fields.supply_category)

  /**
   * Who *recorded* the step, which is not who performed it. Under the custody
   * rule an encoder records everything that happens inside the office —
   * including the Provincial Agriculturist's signature — and the assigned
   * liaison records what happens once the document is out.
   */
  for (let i = 0; i < stepsDone && i < trail.steps.length; i++) {
    const step = trail.steps[i]
    const d = new Date(createdAt + 'T00:00:00')
    d.setDate(d.getDate() + i + 1)
    stepLog.push({
      seq: step.seq,
      at: d.toISOString().slice(0, 10),
      actorName: step.officeCode === 'OPAG'
        ? (i % 2 === 0 ? 'Loraine' : 'Lai')
        : (assignedLiaison?.name ?? 'Loraine'),
      outcome: 'done',
    })
  }

  const nextStep = trail.steps[stepsDone]
  const doc: Doc = {
    id,
    // Both numbers are issued by `numberInOrder`, once every document exists and
    // they can be sorted by creation date. Left blank here on purpose.
    controlNo: '',
    // Numbers from outside only appear once the document has actually reached
    // the office that issues them.
    refNumber: trail.refNumberOrigin === 'OPAG'
      ? undefined
      : trail.refNumberOrigin && stepsDone > 0 ? `${trail.refNumberOrigin}-${year}-${1000 + seq}` : undefined,
    drsNo: `${year}-${month}-${seq + 40}`,
    trackingCode: Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    trailCode,
    programId: program.id,
    subject,
    status: 'DRAFT',
    currentStepSeq: nextStep ? nextStep.seq : trail.steps.length + 1,
    stepLog,
    currentOfficeId: officeIdFor(nextStep?.officeCode ?? 'OPAG'),
    createdBy: 'u-lyka',
    createdAt,
    fields,
    prereqDocIds: [],
    prereqManual: trail.prerequisites,
    externalRefs: [],
    pokes: [],
    assignedLiaisonId: liaisonFor(trailCode, fields.supply_category)?.id,
    events: [{ id: `${id}-e1`, at: createdAt, actorName: 'Lyka', type: 'REGISTERED', to: 'DRAFT', source: 'web' }],
    files: [],
    ...opts,
  }
  delete (doc as Partial<Doc> & { stepsDone?: number }).stepsDone
  return doc
}

/** Completed travel orders — most with no post-travel report, matching the real 222:44 ratio. */
const travelOrders: Doc[] = [
  mk('TO', 'RIC', 'Meeting with GSB winners for regional entry', '2026-01-13', {
    travellers: 'Lyka, Ninia, Alfred', date_of_travel: 'January 20-21, 2026',
    destination: 'Dingalan, Aurora', purpose: 'To conduct a meeting with GSB winners for regional entry',
  }, { status: 'COMPLETED', completedAt: '2026-01-19', stepsDone: 5 }),

  mk('TO', '4H', 'Pick up organic fertilizers under 4H Program', '2026-01-14', {
    travellers: 'Lyka, Alfred, Lai', date_of_travel: 'January 19-20, 2026',
    destination: 'Paraiso, Tarlac — Dingalan, Aurora',
    purpose: 'To pick up organic fertilizers, assist in distribution, conduct briefing among beneficiaries',
  }, { status: 'COMPLETED', completedAt: '2026-01-18', stepsDone: 5 }),

  mk('TO', 'CORN & CASSAVA', 'Technical briefing on corn production', '2026-01-16', {
    travellers: 'Lyka, Ninia', date_of_travel: 'January 20, 2026',
    destination: 'Calaocan, Dipaculao', purpose: 'Technical briefing on corn production with MAO Dipaculao',
  }, { status: 'COMPLETED', completedAt: '2026-01-19', stepsDone: 5 }),

  mk('TO', 'FISHERY & AQUATIC', 'Training on freshwater aquaculture technologies', '2026-01-21', {
    travellers: 'Ninia', date_of_travel: 'January 26-30, 2026',
    destination: 'BFAR-NFTC, CLSU, Science City of Muñoz', purpose: 'To attend the training on freshwater aquaculture technologies',
  }, { status: 'COMPLETED', completedAt: '2026-01-23', stepsDone: 5 }),

  mk('TO', 'RICE', 'Technical briefing on pest and nutrient management', '2026-01-22', {
    travellers: 'Lyka, Ninia, Alfred', date_of_travel: 'January 29, 2026',
    destination: 'Dingalan', purpose: 'Briefing on scaling the adoption of pest and nutrient management',
  }, { status: 'COMPLETED', completedAt: '2026-01-27', stepsDone: 5 }),

  mk('TO', 'ADMIN', 'Provincial Agriculturist meeting', '2026-02-02', {
    travellers: 'Arnold B. Novicio', date_of_travel: 'February 4-6, 2026',
    destination: 'CLSU, Muñoz', purpose: 'To attend Provincial Agriculturist meeting',
  }, { status: 'COMPLETED', completedAt: '2026-02-03', stepsDone: 5 }),

  mk('TO', 'RICE', 'Regional Rice Program coordination meeting', '2026-02-10', {
    travellers: 'Ninia, Nelita Abordo', date_of_travel: 'February 12-13, 2026',
    destination: 'Angeles City, Pampanga', purpose: 'Coordination meeting of the Regional Rice Program',
  }, { status: 'COMPLETED', completedAt: '2026-02-11', stepsDone: 5 }),

  mk('TO', 'HVCDP', 'Farm site validation, Casiguran', '2026-02-20', {
    travellers: 'Ninia, Airene', date_of_travel: 'February 24, 2026',
    destination: 'Casiguran', purpose: 'Validation of high value crops farm sites',
  }, { status: 'COMPLETED', completedAt: '2026-02-23', stepsDone: 5 }),

  mk('TO', 'PAFES', 'Extension workers assembly', '2026-03-02', {
    travellers: 'Nelita Abordo', date_of_travel: 'March 10-11, 2026',
    destination: 'Tuguegarao', purpose: 'Regional extension workers assembly',
  }, { status: 'COMPLETED', completedAt: '2026-03-05', stepsDone: 5 }),

  mk('TO', 'RICE', 'Monitoring of rice seed distribution', '2026-03-14', {
    travellers: 'Ninia, Alfred', date_of_travel: 'March 18-19, 2026',
    destination: 'Dilasag, Casiguran and Dipaculao', purpose: 'Monitoring of rice seed distribution to beneficiaries',
  }, { status: 'COMPLETED', completedAt: '2026-03-16', stepsDone: 5 }),

  mk('TO', 'CORN & CASSAVA', 'Corn cluster farm visit', '2026-05-11', {
    travellers: 'Lyka, Ninia', date_of_travel: 'May 19-20, 2026',
    destination: 'Maria Aurora', purpose: 'Farm visit and technical assistance to corn cluster',
  }, { status: 'COMPLETED', completedAt: '2026-05-14', stepsDone: 5 }),

  mk('TO', 'GAD', 'GAD focal point system training', '2026-06-08', {
    travellers: 'Airene, Zoraida Velano', date_of_travel: 'June 16-18, 2026',
    destination: 'Baguio City', purpose: 'To attend GAD focal point system training',
  }, { status: 'COMPLETED', completedAt: '2026-06-11', stepsDone: 5 }),

  // --- live documents, positioned across the trail ---
  mk('TO', 'RICE', 'Attend regional rice program review', '2026-08-18', {
    travellers: 'Ninia, Alfred', date_of_travel: 'August 26-27, 2026',
    destination: 'San Fernando, Pampanga', purpose: 'Regional rice program mid-year review',
  }, { status: 'FOR_REVIEW', stepsDone: 0 }),

  mk('TO', 'FISHERY & AQUATIC', 'Fingerling dispersal, Dinalungan', '2026-08-19', {
    travellers: 'Lai', date_of_travel: 'August 27, 2026',
    destination: 'Dinalungan', purpose: 'Transport and dispersal of tilapia fingerlings',
  }, { status: 'AT_PA', stepsDone: 1 }),

  mk('TO', 'HVCDP', 'Vegetable production training', '2026-08-14', {
    travellers: 'Lyka, Airene', date_of_travel: 'August 28-29, 2026',
    destination: 'San Luis', purpose: 'Vegetable production training for farmer beneficiaries',
  }, { status: 'IN_TRANSIT', stepsDone: 3, currentHolderName: 'Liaison — Alfred', currentOfficeId: 'o-gov' }),

  mk('TO', 'CORN & CASSAVA', 'Corn seed inspection', '2026-08-14', {
    travellers: 'Alfred', date_of_travel: 'August 21, 2026',
    destination: 'Dipaculao', purpose: 'Inspection of corn seed deliveries',
  }, { status: 'RETURNED', stepsDone: 0, deficiency: 'Received Letter with Approval not attached. Purpose must state the charging program.' }),

  mk('TO', 'GAD', "Women's month planning meeting", '2026-08-25', {
    travellers: 'Airene', date_of_travel: 'September 2, 2026', destination: 'Baler', purpose: '',
  }, { status: 'DRAFT', stepsDone: 0, prereqManual: [] }),
]

const postTravelReports: Doc[] = [
  mk('ENDO', '4H', 'Post-travel report — Paraiso Tarlac / Dingalan', '2026-01-27', {
    origin: 'Lyka, Alfred, Lai', content: 'Post-travel report for the 4H fertilizer pick-up',
  }, { status: 'COMPLETED', completedAt: '2026-01-29', stepsDone: 3, followsId: travelOrders[1].id, trailCode: 'ENDO' }),
]

const procurement: Doc[] = [
  mk('PROP', 'RICE', 'Integrated Nutrient Management Project', '2026-06-02', {
    activity_name: 'Integrated Nutrient Management Project', fund_source: 'General Fund',
  }, { status: 'COMPLETED', completedAt: '2026-06-15', stepsDone: 9, amount: 1000000 }),

  // The PPMP covers every program, so it is filed under Administrative &
  // Finance and its description stands in as the subject.
  mk('PPMP', 'ADMIN', 'Annual procurement plan, all programs — 2026', '2026-06-18', {
  }, { status: 'COMPLETED', completedAt: '2026-06-25', stepsDone: 4, amount: 1000000 }),

  mk('PR', 'RICE', 'Integrated Nutrient Management Project inputs', '2026-07-14', {
    purpose: 'To be used for Integrated Nutrient Management Project',
    account_code: '5-02-03-100', fund_source: 'General Fund',
    activity_name: 'Integrated Nutrient Management Project',
  }, { status: 'AT_OFFICE', stepsDone: 8, amount: 1000000, currentOfficeId: 'o-budget', currentHolderName: 'Budget Office' }),

  mk('PR', 'RIC', 'Assistance to PAFC activities', '2026-08-04', {
    purpose: 'Assistance to PAFC activities (August 26, 2026)',
    account_code: '5-02-03-010', fund_source: 'General Fund',
    activity_name: 'Strengthening of Rural Based Organization',
  }, { status: 'AT_PA', stepsDone: 3, amount: 15000 }),

  mk('PR', 'ADMIN', 'Preventive maintenance of service vehicles', '2026-08-01', {
    purpose: 'Preventive maintenance of OPAg service vehicles',
    account_code: '5-02-13-060', fund_source: 'General Fund', activity_name: 'General Administration',
  }, {
    status: 'RETURNED_EXT', stepsDone: 5, amount: 78500, currentOfficeId: 'o-opag',
    deficiency: 'Returned by BAC — Approved PPMP not attached.',
  }),

  // A second, older procurement case that has run further down the chain, so
  // the Chains screen shows a transaction mid-flight rather than only a stub.
  mk('OBR', 'ADMIN', 'Obligation request — vehicle preventive maintenance', '2026-07-13', {
    account_code: '5-02-13-060', fund_source: 'General Fund', activity_name: 'General Administration',
  }, { status: 'COMPLETED', completedAt: '2026-07-22', stepsDone: 8, amount: 78500 }),

  mk('PO', 'ADMIN', 'Purchase order — vehicle preventive maintenance', '2026-07-24', {
    activity_name: 'General Administration',
  }, { status: 'AT_OFFICE', stepsDone: 6, amount: 78500, currentOfficeId: 'o-adminoff', currentHolderName: "Provincial Administrator's Office" }),

  mk('OBR', 'RICE', 'Obligation request — INM Project inputs', '2026-08-11', {
    account_code: '5-02-03-100', fund_source: 'General Fund',
    activity_name: 'Integrated Nutrient Management Project',
  }, { status: 'AT_PA', stepsDone: 4, amount: 1000000 }),

  mk('DV', 'ADMIN', 'Payment — fuel and lubricants, July 2026', '2026-08-06', {
    account_code: '5-02-03-090', fund_source: 'General Fund',
  }, { status: 'AT_OFFICE', stepsDone: 2, amount: 62400, currentOfficeId: 'o-adminoff', currentHolderName: 'Internal Audit Service' }),
]

const others: Doc[] = [
  mk('COMM-IN', 'ADMIN', '47th Aurora Day celebration coordination meeting', '2026-08-13', {
    origin: 'PGA Notice of Meeting', content: '47th Aurora Day anniversary program coordination meeting',
    activity_datetime: 'August 15, 2026 — 8:30AM', place: 'PGA Conference Hall, Capitol',
  }, { status: 'COMPLETED', completedAt: '2026-08-15', stepsDone: 1, directive: 'attend_send_rep' }),

  mk('COMM-IN', 'P4MP', 'PRDP year-end assessment invitation', '2026-08-15', {
    origin: 'PRDP-RPCO III', content: 'Conduct of P/C/MPMU year-end assessment with partner LGUs',
    activity_datetime: 'August 28-29, 2026', place: 'Subic Bay, Zambales',
  }, { status: 'AT_OFFICE', stepsDone: 0, directive: 'appropriate_action', currentHolderName: 'Nelita Abordo' }),

  mk('COMM-OUT', 'HVCDP', 'Reply — updated list of HVCDP beneficiaries', '2026-08-21', {
    origin: 'Engr. AB David — Regional HVCDP/NUPAP Coordinator',
    content: 'Transmitting the updated list of high value crops beneficiaries',
  }, { status: 'AT_PA', stepsDone: 2 }),

  mk('OBS', 'ADMIN', 'Follow up vouchers at Accounting', '2026-08-24', {
    name: 'Alfred', date_time: 'August 26, 2026 — AM',
    destination: 'Provincial Capitol', purpose: 'Follow up disbursement vouchers at Accounting',
  }, { status: 'AT_PA', stepsDone: 3 }),

  mk('LEAVE', 'ADMIN', 'Vacation Leave — Ninia', '2026-08-19', {
    name: 'Ninia', leave_type: 'Vacation Leave', leave_dates: 'September 7-9, 2026',
  }, { status: 'FOR_RELEASE', stepsDone: 4, currentOfficeId: 'o-hrmo' }),

  mk('PAY-JO', 'ADMIN', 'Payroll — Job Order, first half August 2026', '2026-08-17', {
  }, { status: 'AT_OFFICE', stepsDone: 4, amount: 412500, currentOfficeId: 'o-treas', currentHolderName: 'Treasury Office' }),
]

export const seedDocs: Doc[] = numberInOrder([...travelOrders, ...postTravelReports, ...procurement, ...others])

// ---------------------------------------------------------------------------
// A walkthrough set: one document per acting role.
//
// Enough to see the whole process without 35 documents in the way. All three
// are Travel Orders, whose trail is the shortest in the office — FOD, then the
// PA, then the Governor — so the same document type shows every hand-off.
//
// The control numbers restart so the walkthrough begins at 0001; document ids
// keep counting, so the two sets can never collide.
// ---------------------------------------------------------------------------

const walkthroughDocs: Doc[] = numberInOrder([
  // 1 — with the ENCODER. Sits in the Review queue, waiting to be verified.
  mk('TO', 'RICE', 'Attend regional rice program review', '2026-08-24', {
    travellers: 'Lorenzo', date_of_travel: 'September 3-4, 2026',
    destination: 'San Fernando, Pampanga', purpose: 'Regional rice program mid-year review',
  }, { status: 'FOR_REVIEW', stepsDone: 0 }),

  // 2 — with the PROVINCIAL AGRICULTURIST. On his table for signature; the
  //     Encoder is the one who records that he has signed.
  mk('TO', 'FISHERY & AQUATIC', 'Fingerling dispersal, Dinalungan', '2026-08-21', {
    travellers: 'Lai', date_of_travel: 'August 27, 2026',
    destination: 'Dinalungan', purpose: 'Transport and dispersal of tilapia fingerlings',
  }, { status: 'AT_PA', stepsDone: 1 }),

  // 3 — with the LIAISON. Signed here, now bound for the Governor's Office, so
  //     it is ready to be carried out and handed over.
  mk('TO', 'CORN & CASSAVA', 'Corn seed inspection, Dipaculao', '2026-08-19', {
    travellers: 'Alfred', date_of_travel: 'August 28, 2026',
    destination: 'Dipaculao', purpose: 'Inspection of corn seed deliveries',
    // Signed and released; step 5 is the Governor, so it is genuinely in the
    // liaison's hands rather than still awaiting hand-over.
  }, { status: 'FOR_RELEASE', stepsDone: 4, currentOfficeId: 'o-gov' }),
])

/**
 * Which set of documents the prototype starts from.
 *
 * `empty` is the default — a fresh install of the real system has no
 * documents in it yet. `walkthrough` and `full` stay on as demo data,
 * switchable from the sidebar, for showing the process off or testing a role
 * without registering documents by hand first.
 */
export type SeedMode = 'empty' | 'walkthrough' | 'full'

export function makeDB(mode: SeedMode = 'empty'): DB {
  const docs = mode === 'full' ? seedDocs : mode === 'walkthrough' ? walkthroughDocs : []
  return { offices, programs, users, types, docs: docs.map((d) => ({ ...d })), transmittals: [] }
}
