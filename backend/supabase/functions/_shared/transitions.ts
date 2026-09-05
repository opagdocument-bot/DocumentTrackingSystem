// The server port of app/src/lib/transition.ts — stepDone, receiptRecorded,
// departed. Each one here computes the *same* next state the original
// function would build, just shaped as a mutation plan (a documents patch,
// plus optional step-log/event/file rows) instead of a whole new Doc object,
// since the database is relational rather than one JSON blob per document.
// apply_document_mutation (see the migration of the same era) is what
// actually writes the plan, atomically.

import { currentStep, statusForStep, stepsOf, todayISO } from './rules.ts'
import type { DocRow } from './rules.ts'

export interface Actor {
  name: string
  source: 'web' | 'mobile' | 'system'
}

export interface Proof {
  name: string
  thumb?: string
  driveFileId?: string
  driveViewUrl?: string
}

export interface MutationPlan {
  patch: Record<string, unknown>
  stepLog?: Record<string, unknown>
  event?: Record<string, unknown>
  file?: Record<string, unknown>
}

function fileRow(proof: Proof, pageRole: string) {
  return {
    name: proof.name,
    page_role: pageRole,
    captured_at: todayISO(),
    drive_file_id: proof.driveFileId ?? `pending-${crypto.randomUUID()}`,
    drive_view_url: proof.driveViewUrl ?? null,
    thumb_data_url: proof.thumb ?? null,
  }
}

/**
 * Record the current step as done and move to the next one. The status of
 * the step it lands on is what puts a document on the PA's desk, out for
 * release, or into transit — see statusForStep.
 */
export function stepDone(doc: DocRow, actor: Actor, o: { note?: string; proof?: Proof } = {}): MutationPlan {
  const steps = stepsOf(doc)
  const step = currentStep(doc)
  const today = todayISO()

  if (doc.status === 'FOR_REVIEW') {
    const first = steps[0]
    const status = statusForStep(first)
    return {
      patch: {
        status, current_step_seq: first?.seq ?? 1, current_office_id: first?.officeCode ?? 'OPAG',
        current_holder_name: null, custody: (first?.officeCode ?? 'OPAG') === 'OPAG' ? 'office' : 'field',
      },
      event: { actor_name: actor.name, type: 'VERIFIED', to_status: status, step_seq: first?.seq ?? null, note: o.note ?? null, source: actor.source },
    }
  }

  if (!step) return { patch: {} }

  const stepLog = { seq: step.seq, at: today, actor_name: actor.name, outcome: 'done', note: o.note ?? null }
  const file = o.proof ? fileRow(o.proof, 'receiving_stamp') : undefined
  const next = steps[steps.findIndex((s) => s.seq === step.seq) + 1]

  if (!next) {
    return {
      patch: {
        status: 'COMPLETED', completed_at: today, current_step_seq: step.seq + 1,
        current_office_id: 'OPAG', current_holder_name: null, custody: 'office',
      },
      stepLog,
      event: { actor_name: actor.name, type: 'STEP_DONE', to_status: 'COMPLETED', step_seq: step.seq, note: step.requirement, source: actor.source },
      file,
    }
  }

  const status = statusForStep(next, step.officeCode)
  return {
    patch: {
      status, current_step_seq: next.seq, current_office_id: next.officeCode,
      current_holder_name: status === 'AT_PA' ? 'Provincial Agriculturist' : null,
      custody: next.officeCode === 'OPAG' ? 'office' : 'field',
    },
    stepLog,
    event: { actor_name: actor.name, type: 'STEP_DONE', to_status: status, step_seq: step.seq, note: step.requirement, source: actor.source },
    file,
  }
}

/** The office it was carried to has taken it in, and signed for it. */
export function receiptRecorded(doc: DocRow, actor: Actor, receivedBy: string, proof: Proof): MutationPlan {
  return {
    patch: { status: 'AT_OFFICE', current_holder_name: receivedBy, custody: 'field' },
    event: { actor_name: actor.name, type: 'RECEIVED', to_status: 'AT_OFFICE', step_seq: doc.current_step_seq, note: `Received by ${receivedBy}`, source: actor.source },
    file: fileRow(proof, 'receiving_stamp'),
  }
}

/** The liaison has left with it. The trail does not move — the paper is
 *  merely between two desks — so only the status changes. */
export function departed(doc: DocRow, actor: Actor, destination: string): MutationPlan {
  const step = currentStep(doc)
  return {
    patch: { status: 'IN_TRANSIT', current_office_id: step?.officeCode ?? 'OPAG', current_holder_name: `Liaison — ${actor.name}`, custody: 'field' },
    event: { actor_name: actor.name, type: 'RELEASED', to_status: 'IN_TRANSIT', step_seq: doc.current_step_seq, note: `En route to ${destination}`, source: actor.source },
  }
}

/** A document returned for correction — the encoder's "Return" / "PA
 *  returned it" action. Mirrors returnDoc() in store.tsx. */
export function returnedForRevision(doc: DocRow, actor: Actor, note: string): MutationPlan {
  const step = currentStep(doc)
  const external = step && step.officeCode !== 'OPAG'
  const status = external ? 'RETURNED_EXT' : 'RETURNED'
  return {
    patch: { status, deficiency: note, current_office_id: 'OPAG', current_holder_name: null, custody: 'office' },
    stepLog: step ? { seq: step.seq, at: todayISO(), actor_name: actor.name, outcome: 'returned', note } : undefined,
    event: { actor_name: actor.name, type: 'RETURNED', to_status: status, step_seq: step?.seq ?? null, note, source: actor.source },
  }
}
