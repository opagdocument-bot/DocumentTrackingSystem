// Register a new document — the server port of addDoc() in app/src/store.tsx.
// Encoder only, same as the web app's own Intake screen only rendering the
// "Encode document" button for that role.

import {
  currentStep, issuesOwnRefNumber, makeTrackingCode, nextControlNo,
  paperNumber, statusForStep, trailFor,
} from '../_shared/rules.ts'
import { errorResponse, identifyCaller, jsonResponse, serviceClient, AuthError } from '../_shared/client.ts'

interface RegisterInput {
  trailCode: string
  programId: string | null
  subject: string
  fields: Record<string, string>
  directive?: string
  disposition: 'pa' | 'release'
  liaisonId?: string
  amount?: number
  followsId?: string
  prereqDocIds?: string[]
  prereqManual?: string[]
}

Deno.serve(async (req) => {
  try {
    const caller = await identifyCaller(req)
    if (caller.role !== 'encoder') return errorResponse('Only the encoder registers documents', 403)

    const input = (await req.json()) as RegisterInput
    const trail = trailFor(input.trailCode)
    if (!trail) return errorResponse(`Unknown document type: ${input.trailCode}`, 400)
    if (!input.subject?.trim()) return errorResponse('A description is required', 400)
    if (input.disposition !== 'pa' && input.disposition !== 'release') return errorResponse('disposition must be "pa" or "release"', 400)

    const db = serviceClient()
    const today = new Date().toISOString().slice(0, 10)

    // The control number's own series depends on what's already used this
    // month for this type — read under the service role so a concurrent
    // registration can't race an ordinary client past RLS to see it.
    const { data: existing, error: existingErr } = await db
      .from('documents')
      .select('control_no')
      .like('control_no', `OPA-${trail.code}-${today.slice(0, 7)}-%`)
    if (existingErr) return errorResponse(existingErr.message, 500)

    const controlNo = nextControlNo((existing ?? []).map((d) => d.control_no), trail.code, today)

    // Same landing logic as addDoc(): the encoder's disposition decides which
    // step the document is entered at, not always step one.
    const steps = trail.steps
    const landing = input.disposition === 'release'
      ? steps.find((s) => s.officeCode !== 'OPAG')
      : steps.find((s) => s.kind === 'record_in' || s.signatory === 'provincial_agriculturist')
    const step = landing ?? steps[0]
    const status = landing
      ? (input.disposition === 'release' ? 'FOR_RELEASE' : 'AT_PA')
      : statusForStep(step)

    // Liaison auto-assignment matrix — same rule as liaisonFor() in seed.ts:
    // Purchase Requests route on class of goods first, then an exact trail
    // match, then whoever is the catch-all.
    let liaisonId = input.liaisonId ?? null
    if (!liaisonId) {
      const { data: liaisons } = await db
        .from('profiles')
        .select('id, assignment')
        .eq('role', 'liaison')
        .not('assignment', 'is', null)
      const prCategory = input.fields.supply_category
      const list = (liaisons ?? []) as { id: string; assignment: { trailCodes: string[]; prCategories?: string[]; catchAll?: boolean } }[]
      if (trail.code === 'PR' && prCategory) {
        liaisonId = list.find((u) => u.assignment.prCategories?.includes(prCategory))?.id ?? null
      }
      if (!liaisonId) liaisonId = list.find((u) => u.assignment.trailCodes.includes(trail.code))?.id ?? null
      if (!liaisonId) liaisonId = list.find((u) => u.assignment.catchAll)?.id ?? null
    }

    const refNumber = issuesOwnRefNumber(trail.code) ? paperNumber(controlNo) : null

    const { data: inserted, error: insertErr } = await db
      .from('documents')
      .insert({
        control_no: controlNo,
        ref_number: refNumber,
        tracking_code: makeTrackingCode(),
        trail_code: trail.code,
        program_id: input.programId,
        subject: input.subject,
        amount: input.amount ?? null,
        directive: input.directive ?? null,
        disposition: input.disposition,
        status,
        custody: step?.officeCode === 'OPAG' || !step ? 'office' : 'field',
        current_step_seq: step?.seq ?? 1,
        current_office_id: step?.officeCode ?? 'OPAG',
        current_holder_name: status === 'AT_PA' ? 'Provincial Agriculturist' : null,
        created_by: caller.id,
        created_at: today,
        fields: input.fields,
        prereq_doc_ids: input.prereqDocIds ?? [],
        prereq_manual: input.prereqManual ?? [],
        assigned_liaison_id: liaisonId,
        follows_id: input.followsId ?? null,
      })
      .select()
      .single()
    if (insertErr) return errorResponse(insertErr.message, 500)

    const { error: eventErr } = await db.from('document_events').insert({
      document_id: inserted.id,
      actor_name: caller.name,
      type: 'REGISTERED',
      to_status: status,
      source: 'web',
      note: input.disposition === 'release' ? 'Registered for release' : 'Registered for signature of the Provincial Agriculturist',
    })
    if (eventErr) return errorResponse(eventErr.message, 500)

    return jsonResponse({ document: inserted })
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, err.status)
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})
