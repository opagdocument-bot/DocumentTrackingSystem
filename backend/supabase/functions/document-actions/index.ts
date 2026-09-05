// Every action that changes a document already in the system. Registration
// (a brand new document) is register-document instead — everything here
// operates on an existing row, found by id.
//
// One dispatcher, not one function per action: they all share the same
// shape (identify caller -> load the document -> re-check the exact rule
// availableActions()/can() already encode -> compute the mutation ->
// apply it atomically) and splitting them into separate deployments would
// only multiply the places that setup has to be kept right.

import { availableActions, can, currentStep, needsRefNumberNow, statusForStep, todayISO } from '../_shared/rules.ts'
import type { DocRow } from '../_shared/rules.ts'
import { departed, receiptRecorded, returnedForRevision, stepDone } from '../_shared/transitions.ts'
import type { Actor, MutationPlan, Proof } from '../_shared/transitions.ts'
import { AuthError, errorResponse, identifyCaller, jsonResponse, serviceClient } from '../_shared/client.ts'

type ActionName =
  | 'submit' | 'advance' | 'return' | 'hold' | 'resume'
  | 'receive' | 'depart' | 'cancel' | 'assignLiaison' | 'poke'
  | 'setPrereqs' | 'removeExternalRef'

interface Body {
  action: ActionName
  docId: string
  note?: string
  proof?: Proof
  receivedBy?: string
  destination?: string
  refNumber?: string
  liaisonId?: string
  reason?: string
  cancelFile?: Proof
  prereqDocIds?: string[]
  prereqManual?: string[]
  externalRefId?: string
}

Deno.serve(async (req) => {
  try {
    const caller = await identifyCaller(req)
    const body = (await req.json()) as Body
    if (!body.docId) return errorResponse('docId is required', 400)

    const db = serviceClient()
    const { data: doc, error: docErr } = await db.from('documents').select('*').eq('id', body.docId).single()
    if (docErr || !doc) return errorResponse('Document not found', 404)

    const row = doc as DocRow
    const actor: Actor = { name: caller.name, source: caller.role === 'liaison' ? 'mobile' : 'web' }

    const result = await handle(db, row, caller.role, caller.id, actor, body)
    if ('error' in result) return errorResponse(result.error, result.status ?? 403)

    await applyPlan(db, row.id, result.plan)

    const { data: updated } = await db.from('documents').select('*').eq('id', row.id).single()
    return jsonResponse({ document: updated })
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, err.status)
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})

type Db = ReturnType<typeof serviceClient>
type PlanWithRefEvent = MutationPlan & { extraEvent?: MutationPlan['event'] }
type Handled = { plan: PlanWithRefEvent } | { error: string; status?: number }

async function handle(db: Db, doc: DocRow, role: string, userId: string, actor: Actor, body: Body): Promise<Handled> {
  // Every action is re-checked against the exact same gate the frontend
  // already trusts — a client asserting "I can do this" is never enough on
  // its own, only what availableActions/can independently say is true.
  const actions = availableActions(doc, role as never, userId)
  const legal = actions.find((a) => a.kind === body.action)

  if (body.action === 'cancel') {
    if (!can(role as never, 'cancel', doc, userId)) return { error: 'Not allowed to cancel this document' }
    if (!body.reason?.trim()) return { error: 'A reason is required to cancel', status: 400 }
    if (!body.cancelFile) return { error: 'A photo of the paper marked CANCELLED is required', status: 400 }
    return {
      plan: {
        patch: { status: 'CANCELLED', completed_at: todayISO(), current_holder_name: null, cancel_reason: body.reason },
        event: { actor_name: actor.name, type: 'CANCELLED', to_status: 'CANCELLED', note: body.reason, source: actor.source },
        file: { name: body.cancelFile.name, page_role: 'cancelled', captured_at: todayISO(), drive_file_id: body.cancelFile.driveFileId ?? `pending-${crypto.randomUUID()}`, drive_view_url: body.cancelFile.driveViewUrl ?? null, thumb_data_url: body.cancelFile.thumb ?? null },
      },
    }
  }

  if (body.action === 'assignLiaison') {
    if (!can(role as never, 'assign', doc, userId)) return { error: 'Not allowed to assign a liaison' }
    if (!body.liaisonId) return { error: 'liaisonId is required', status: 400 }
    return { plan: { patch: { assigned_liaison_id: body.liaisonId }, event: { actor_name: actor.name, type: 'ASSIGNED', note: 'Assigned to a liaison', source: actor.source } } }
  }

  if (body.action === 'setPrereqs') {
    if (!can(role as never, 'edit_prereqs', doc, userId)) return { error: 'Not allowed to edit prerequisites on this document' }
    return { plan: { patch: { prereq_doc_ids: body.prereqDocIds ?? [], prereq_manual: body.prereqManual ?? [] } } }
  }

  if (body.action === 'removeExternalRef') {
    if (!can(role as never, 'edit_refs', doc, userId)) return { error: 'Not allowed to edit reference numbers on this document' }
    if (!body.externalRefId) return { error: 'externalRefId is required', status: 400 }
    const { error } = await db.from('document_external_refs').delete().eq('id', body.externalRefId).eq('document_id', doc.id)
    if (error) return { error: error.message, status: 500 }
    return { plan: { patch: {} } }
  }

  if (body.action === 'poke') {
    if (!can(role as never, 'poke', doc, userId)) return { error: 'Not allowed to follow up on this document' }
    if (!body.note?.trim()) return { error: 'A note is required', status: 400 }
    const { error } = await db.from('document_pokes').insert({
      document_id: doc.id, at: todayISO(), by_name: actor.name, to_handler: 'the current handler', note: body.note,
    })
    if (error) return { error: error.message, status: 500 }
    return { plan: { patch: {}, event: { actor_name: actor.name, type: 'FOLLOW_UP', note: body.note, source: actor.source } } }
  }

  if (!legal) return { error: `"${body.action}" is not available on this document right now` }

  // A step producing an outside reference number asks for it in the same
  // motion as recording the step — see needsRefNumberNow in rules.ts.
  const refBlocked = needsRefNumberNow(doc)
  let refPatch: Record<string, unknown> = {}
  let refEvent: MutationPlan['event']
  if (legal.needsRef && refBlocked) {
    if (!body.refNumber?.trim()) return { error: 'The outside reference number is required for this step', status: 400 }
    refPatch = { ref_number: doc.ref_number ?? body.refNumber }
    refEvent = { actor_name: actor.name, type: 'REFERENCE_RECORDED', note: `Reference number: ${body.refNumber}`, source: actor.source }
  }
  if (legal.needsProof && !body.proof) return { error: 'A photo of the document is required for this step', status: 400 }
  if (legal.needsNote && !body.note?.trim() && body.action !== 'receive') return { error: 'A note is required for this step', status: 400 }

  let plan: PlanWithRefEvent
  switch (body.action) {
    case 'submit':
      plan = {
        patch: { status: 'FOR_REVIEW', deficiency: null },
        event: { actor_name: actor.name, type: 'SUBMITTED', to_status: 'FOR_REVIEW', source: actor.source },
      }
      break
    case 'advance':
      plan = stepDone(doc, actor, { note: body.note, proof: body.proof })
      break
    case 'return':
      if (!body.note?.trim()) return { error: 'A reason is required to return this document', status: 400 }
      plan = returnedForRevision(doc, actor, body.note)
      break
    case 'hold':
      if (!body.note?.trim()) return { error: 'A reason is required to place this on hold', status: 400 }
      plan = { patch: { status: 'ON_HOLD' }, event: { actor_name: actor.name, type: 'HELD', to_status: 'ON_HOLD', note: body.note, source: actor.source } }
      break
    case 'resume': {
      const step = currentStep(doc)
      const status = statusForStep(step)
      plan = { patch: { status, custody: (step?.officeCode ?? 'OPAG') === 'OPAG' ? 'office' : 'field' }, event: { actor_name: actor.name, type: 'RESUMED', to_status: status, source: actor.source } }
      break
    }
    case 'receive':
      if (!body.receivedBy?.trim()) return { error: 'Received by (name) is required', status: 400 }
      if (!body.proof) return { error: 'A photo is required', status: 400 }
      plan = receiptRecorded(doc, actor, body.receivedBy, body.proof)
      break
    case 'depart':
      plan = departed(doc, actor, body.destination ?? 'the next office')
      break
    default:
      return { error: `Unknown action: ${body.action}`, status: 400 }
  }

  // Fold the reference-number capture into the same write as the step it
  // rides along with, rather than a second, separate mutation.
  if (Object.keys(refPatch).length) {
    plan = { ...plan, patch: { ...plan.patch, ...refPatch } }
  }
  if (refEvent) plan = { ...plan, extraEvent: refEvent }
  return { plan }
}

async function applyPlan(db: Db, documentId: string, plan: PlanWithRefEvent) {
  const { error } = await db.rpc('apply_document_mutation', {
    p_document_id: documentId,
    p_patch: plan.patch ?? {},
    p_step_log: plan.stepLog ?? null,
    p_event: plan.event ?? null,
    p_file: plan.file ?? null,
  })
  if (error) throw new Error(error.message)

  if (plan.extraEvent) {
    const { error: refErr } = await db.rpc('apply_document_mutation', {
      p_document_id: documentId, p_patch: {}, p_step_log: null, p_event: plan.extraEvent, p_file: null,
    })
    if (refErr) throw new Error(refErr.message)
  }
}
