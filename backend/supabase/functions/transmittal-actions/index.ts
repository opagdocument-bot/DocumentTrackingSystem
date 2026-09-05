// Batch operations on several documents at once — building a transmittal
// (the liaison hands a stack of documents to one office in one trip) and
// receiving one back. Kept apart from document-actions because every other
// action there works on exactly one document; these two always work on a
// list, and mixing the two shapes into one dispatcher would make both
// harder to read.
//
// Ported from createTransmittal / receiveTransmittal in app/src/store.tsx.
// One real change from the prototype: the transmittal number there was a
// placeholder counter (`200 + transmittals.length`), fine for demo data but
// not a real numbering scheme. This uses the same OPA-<TYPE>-yyyy-mm-nnnn
// shape as every other number the office issues, for the same reason —
// gaps stay visible, nothing is ever back-filled.

import { todayISO } from '../_shared/rules.ts'
import { AuthError, errorResponse, identifyCaller, jsonResponse, serviceClient } from '../_shared/client.ts'

type Db = ReturnType<typeof serviceClient>

interface CreateBody {
  action: 'create'
  toOfficeId: string
  docIds: string[]
}

interface ReceiveBody {
  action: 'receive'
  transmittalId: string
  receivedByName: string
  proof: { name: string; thumb?: string; driveFileId?: string; driveViewUrl?: string }
}

type Body = CreateBody | ReceiveBody

Deno.serve(async (req) => {
  try {
    const caller = await identifyCaller(req)
    if (caller.role !== 'liaison') return errorResponse('Only a liaison builds or receives a transmittal', 403)

    const body = (await req.json()) as Body
    const db = serviceClient()

    if (body.action === 'create') return await createTransmittal(db, caller, body)
    if (body.action === 'receive') return await receiveTransmittal(db, caller, body)
    return errorResponse('Unknown action', 400)
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, err.status)
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})

async function nextTransmittalNo(db: Db): Promise<string> {
  const today = todayISO()
  const prefix = `OPA-TRN-${today.slice(0, 4)}-${today.slice(5, 7)}-`
  const { data } = await db.from('transmittals').select('no').like('no', `${prefix}%`)
  const used = (data ?? [])
    .map((t) => parseInt(t.no.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  return prefix + String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')
}

async function createTransmittal(db: Db, caller: { id: string; name: string }, body: CreateBody) {
  if (!body.toOfficeId) return errorResponse('toOfficeId is required', 400)
  if (!body.docIds?.length) return errorResponse('At least one document is required', 400)

  // Every document must actually be this liaison's to carry, and ready to
  // go — the same "carry" bucket the frontend's loadBucket() puts it in.
  // Rejecting the whole batch if even one document doesn't qualify, rather
  // than silently dropping it, keeps the transmittal's own document list
  // trustworthy.
  const { data: docs, error: docsErr } = await db
    .from('documents')
    .select('id, status, assigned_liaison_id')
    .in('id', body.docIds)
  if (docsErr) return errorResponse(docsErr.message, 500)
  if ((docs ?? []).length !== body.docIds.length) return errorResponse('One or more documents were not found', 404)

  const ineligible = (docs ?? []).find((d) => d.status !== 'FOR_RELEASE' || d.assigned_liaison_id !== caller.id)
  if (ineligible) return errorResponse(`Document ${ineligible.id} is not ready for this liaison to carry`, 409)

  const no = await nextTransmittalNo(db)
  const today = todayISO()

  const { data: transmittal, error: insertErr } = await db
    .from('transmittals')
    .insert({ no, liaison_id: caller.id, to_office_id: body.toOfficeId, doc_ids: body.docIds, released_at: today, status: 'RELEASED' })
    .select()
    .single()
  if (insertErr) return errorResponse(insertErr.message, 500)

  for (const docId of body.docIds) {
    const { error } = await db.rpc('apply_document_mutation', {
      p_document_id: docId,
      p_patch: { status: 'IN_TRANSIT', current_office_id: body.toOfficeId, current_holder_name: `Liaison — ${caller.name}`, custody: 'field' },
      p_step_log: null,
      p_event: { actor_name: caller.name, type: 'RELEASED', to_status: 'IN_TRANSIT', note: `Transmittal ${no}`, source: 'mobile' },
      p_file: null,
    })
    if (error) return errorResponse(`Transmittal created, but updating document ${docId} failed: ${error.message}`, 500)
  }

  return jsonResponse({ transmittal })
}

async function receiveTransmittal(db: Db, caller: { id: string; name: string }, body: ReceiveBody) {
  if (!body.transmittalId) return errorResponse('transmittalId is required', 400)
  if (!body.receivedByName?.trim()) return errorResponse('receivedByName is required', 400)
  if (!body.proof) return errorResponse('A photo is required', 400)

  const { data: transmittal, error: findErr } = await db
    .from('transmittals').select('*').eq('id', body.transmittalId).single()
  if (findErr || !transmittal) return errorResponse('Transmittal not found', 404)
  if (transmittal.liaison_id !== caller.id) return errorResponse('This transmittal belongs to a different liaison', 403)
  if (transmittal.status === 'RECEIVED') return errorResponse('This transmittal was already received', 409)

  const today = todayISO()
  const { error: updateErr } = await db
    .from('transmittals')
    .update({ status: 'RECEIVED', received_at: today, received_by_name: body.receivedByName })
    .eq('id', transmittal.id)
  if (updateErr) return errorResponse(updateErr.message, 500)

  for (const docId of transmittal.doc_ids as string[]) {
    const { error } = await db.rpc('apply_document_mutation', {
      p_document_id: docId,
      p_patch: { status: 'AT_OFFICE', current_holder_name: body.receivedByName, custody: 'field' },
      p_step_log: null,
      p_event: { actor_name: body.receivedByName, type: 'RECEIVED', to_status: 'AT_OFFICE', note: `QR scan · transmittal ${transmittal.no}`, source: 'mobile' },
      p_file: { name: body.proof.name, page_role: 'receiving_stamp', captured_at: today, drive_file_id: body.proof.driveFileId ?? `pending-${crypto.randomUUID()}`, drive_view_url: body.proof.driveViewUrl ?? null, thumb_data_url: body.proof.thumb ?? null },
    })
    if (error) return errorResponse(`Transmittal received, but updating document ${docId} failed: ${error.message}`, 500)
  }

  const { data: updated } = await db.from('transmittals').select('*').eq('id', transmittal.id).single()
  return jsonResponse({ transmittal: updated })
}
