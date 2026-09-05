/* ---------------------------------------------------------------------------
   What happens to a document when somebody records something.

   These are pure functions: a document in, a new document out. They live here
   rather than inside a React store because two apps perform the same
   transitions — the web prototype and the liaison's phone — and a liaison
   recording a signature must move a document exactly as the encoder's browser
   would. Anything that lived in only one store would drift, and the phone would
   start telling a different story about the same paper.

   It cannot live in `workflow.ts`: these need `officeIdFor` from the seed, and
   the seed already imports from `workflow.ts`.
   --------------------------------------------------------------------------- */

import { officeIdFor } from '../data/seed'
import { TODAY, currentStep, statusForStep, stepsOf } from './workflow'
import type { Doc, DocEvent, DocFile, Status, StepLog } from '../types'

/** Who is recording, and from what. Liaison updates are stamped `mobile`. */
export interface Actor {
  name: string
  source: 'web' | 'mobile' | 'system'
}

export function makeEvent(
  d: Doc, actor: Actor, type: string,
  o: { to?: Status; note?: string; stepSeq?: number; fileId?: string } = {},
): DocEvent {
  return {
    id: `${d.id}-e${d.events.length + 1}`,
    at: TODAY,
    actorName: actor.name,
    type,
    from: d.status,
    to: o.to,
    note: o.note,
    stepSeq: o.stepSeq,
    fileId: o.fileId,
    source: actor.source,
  }
}

/** A photograph filed against the document — the proof of custody. */
export function makeProof(d: Doc, name: string, thumb?: string): DocFile {
  return {
    id: nextFileId(d),
    name,
    pageRole: 'receiving_stamp',
    sizeKb: 180 + Math.floor(Math.random() * 140),
    capturedAt: TODAY,
    thumb,
  }
}

export function nextFileId(d: Doc): string {
  return `${d.id}-f${d.files.length + 1}`
}

export interface Proof {
  name: string
  thumb?: string
}

/**
 * Record the current step as done and move to the next one.
 *
 * The status of the step it lands on is what puts documents on the PA's desk,
 * out for release or into transit — see `statusForStep`.
 */
export function stepDone(d: Doc, actor: Actor, o: { note?: string; proof?: Proof } = {}): Doc {
  const steps = stepsOf(d)
  const step = currentStep(d)

  // Verifying a draft simply moves it onto step 1.
  if (d.status === 'FOR_REVIEW') {
    const first = steps[0]
    return {
      ...d,
      status: statusForStep(first),
      currentStepSeq: first?.seq ?? 1,
      currentOfficeId: officeIdFor(first?.officeCode ?? 'OPAG'),
      currentHolderName: undefined,
      events: [...d.events, makeEvent(d, actor, 'VERIFIED', {
        to: statusForStep(first), note: o.note, stepSeq: first?.seq,
      })],
    }
  }

  if (!step) return d

  const log: StepLog = { seq: step.seq, at: TODAY, actorName: actor.name, outcome: 'done', note: o.note }
  const files = o.proof ? [...d.files, makeProof(d, o.proof.name, o.proof.thumb)] : d.files
  const fileId = o.proof ? nextFileId(d) : undefined
  const next = steps[steps.findIndex((s) => s.seq === step.seq) + 1]

  if (!next) {
    return {
      ...d,
      status: 'COMPLETED',
      completedAt: TODAY,
      currentStepSeq: step.seq + 1,
      stepLog: [...d.stepLog, log],
      files,
      currentOfficeId: officeIdFor('OPAG'),
      currentHolderName: undefined,
      events: [...d.events, makeEvent(d, actor, 'STEP_DONE', {
        to: 'COMPLETED', note: step.requirement, stepSeq: step.seq, fileId,
      })],
    }
  }

  const status = statusForStep(next, step.officeCode)
  return {
    ...d,
    status,
    currentStepSeq: next.seq,
    stepLog: [...d.stepLog, log],
    files,
    currentOfficeId: officeIdFor(next.officeCode),
    currentHolderName: status === 'AT_PA' ? 'Provincial Agriculturist' : undefined,
    events: [...d.events, makeEvent(d, actor, 'STEP_DONE', {
      to: status, note: step.requirement, stepSeq: step.seq, fileId,
    })],
  }
}

/** The office it was carried to has taken it in, and signed for it. */
export function receiptRecorded(d: Doc, actor: Actor, receivedBy: string, proof: Proof): Doc {
  return {
    ...d,
    status: 'AT_OFFICE',
    currentHolderName: receivedBy,
    files: [...d.files, makeProof(d, proof.name, proof.thumb)],
    events: [...d.events, makeEvent(d, actor, 'RECEIVED', {
      to: 'AT_OFFICE', note: `Received by ${receivedBy}`, stepSeq: d.currentStepSeq, fileId: nextFileId(d),
    })],
  }
}

/**
 * The liaison has left with it. The trail does not move — the paper is merely
 * between two desks — so only the status changes.
 */
export function departed(d: Doc, actor: Actor, destination: string): Doc {
  const step = currentStep(d)
  return {
    ...d,
    status: 'IN_TRANSIT',
    currentOfficeId: officeIdFor(step?.officeCode ?? 'OPAG'),
    currentHolderName: `Liaison — ${actor.name}`,
    events: [...d.events, makeEvent(d, actor, 'RELEASED', {
      to: 'IN_TRANSIT', note: `En route to ${destination}`, stepSeq: d.currentStepSeq,
    })],
  }
}
