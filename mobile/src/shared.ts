/**
 * The single door to the shared office rules.
 *
 * Everything below lives in `../../app/src` and is imported, not copied — the
 * trail, the custody rule, the numbering and the seed are the same in the web
 * prototype and on the phone. Routing every import through this one file means
 * the relative path out of the project appears exactly once.
 */
export type {
  Doc,
  DocEvent,
  DocFile,
  DocumentType,
  Poke,
  Role,
  Status,
  User,
} from '../../app/src/types'

export type { Trail, TrailStep } from '../../app/src/data/trail'

export {
  CHAINS,
  OFFICE_SHORT,
  SIGNATORY_LABEL,
  TRAILS_WITH_CHECKPOINTS,
  TRAIL_OFFICES,
  trailDays,
  trailFor,
} from '../../app/src/data/trail'

export {
  liaisonFor,
  makeDB,
  officeIdFor,
  offices,
  users,
} from '../../app/src/data/seed'

export {
  ROLE_LABEL,
  STATUS_LABEL,
  TODAY,
  availableActions,
  currentStep,
  custodyOf,
  daysAtCurrentStep,
  eventPhrase,
  isOpen,
  liaisonLoad,
  loadBucket,
  needsRefNumberNow,
  statusPhrase,
  stepState,
  stepsOf,
} from '../../app/src/lib/workflow'

export type { Action, LoadBucket } from '../../app/src/lib/workflow'
