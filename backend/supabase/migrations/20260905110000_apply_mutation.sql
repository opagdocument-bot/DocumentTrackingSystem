-- A single, logic-free entry point for every multi-table document write.
--
-- The branching logic that decides *what* changes when a step completes
-- (stepDone / receiptRecorded / departed) lives in TypeScript
-- (functions/_shared/transitions.ts), ported from app/src/lib/transition.ts.
-- This function does not know or care what a "Travel Order" or a "record_in"
-- step is — it only applies whatever patch/log/event/file it's handed, as one
-- transaction. A Postgres function body is one transaction implicitly, so a
-- document can never end up updated without its event logged, or vice versa,
-- even if something fails partway through.
--
-- security definer + a fixed search_path so it runs with the privileges of
-- the function owner regardless of who calls it — callable only by the
-- service role (see the revoke below), which is the only thing that should
-- ever be deciding what patch to apply in the first place.
create function public.apply_document_mutation(
  p_document_id uuid,
  p_patch jsonb,              -- partial row for `documents`, applied with jsonb_populate_record-style merge
  p_step_log jsonb default null,     -- one row for document_step_logs, or null
  p_event jsonb default null,        -- one row for document_events, or null
  p_file jsonb default null          -- one row for document_files, or null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_file_id uuid;
begin
  if p_file is not null then
    insert into document_files (document_id, name, page_role, size_kb, captured_at, drive_file_id, drive_view_url, thumb_data_url)
    values (
      p_document_id,
      p_file ->> 'name',
      p_file ->> 'page_role',
      nullif(p_file ->> 'size_kb', '')::int,
      (p_file ->> 'captured_at')::date,
      p_file ->> 'drive_file_id',
      p_file ->> 'drive_view_url',
      p_file ->> 'thumb_data_url'
    )
    returning id into v_file_id;
  end if;

  if p_patch is not null and p_patch != '{}'::jsonb then
    update documents set
      status              = coalesce(p_patch ->> 'status', status),
      custody              = coalesce(p_patch ->> 'custody', custody),
      current_step_seq    = coalesce((p_patch ->> 'current_step_seq')::int, current_step_seq),
      current_office_id   = coalesce(p_patch ->> 'current_office_id', current_office_id),
      current_holder_name = case when p_patch ? 'current_holder_name' then p_patch ->> 'current_holder_name' else current_holder_name end,
      completed_at        = case when p_patch ? 'completed_at' then (p_patch ->> 'completed_at')::date else completed_at end,
      ref_number          = case when p_patch ? 'ref_number' then p_patch ->> 'ref_number' else ref_number end,
      deficiency          = case when p_patch ? 'deficiency' then p_patch ->> 'deficiency' else deficiency end,
      cancel_reason       = case when p_patch ? 'cancel_reason' then p_patch ->> 'cancel_reason' else cancel_reason end,
      assigned_liaison_id = case when p_patch ? 'assigned_liaison_id' then (p_patch ->> 'assigned_liaison_id')::uuid else assigned_liaison_id end,
      prereq_doc_ids      = case when p_patch ? 'prereq_doc_ids' then array(select jsonb_array_elements_text(p_patch -> 'prereq_doc_ids'))::uuid[] else prereq_doc_ids end,
      prereq_manual       = case when p_patch ? 'prereq_manual' then array(select jsonb_array_elements_text(p_patch -> 'prereq_manual')) else prereq_manual end
    where id = p_document_id;
  end if;

  if p_step_log is not null then
    insert into document_step_logs (document_id, seq, at, actor_name, outcome, note, receipt_method, received_by_name)
    values (
      p_document_id,
      (p_step_log ->> 'seq')::int,
      (p_step_log ->> 'at')::date,
      p_step_log ->> 'actor_name',
      p_step_log ->> 'outcome',
      p_step_log ->> 'note',
      p_step_log ->> 'receipt_method',
      p_step_log ->> 'received_by_name'
    );
  end if;

  if p_event is not null then
    insert into document_events (document_id, actor_name, type, from_status, to_status, step_seq, file_id, note, source)
    values (
      p_document_id,
      p_event ->> 'actor_name',
      p_event ->> 'type',
      p_event ->> 'from_status',
      p_event ->> 'to_status',
      nullif(p_event ->> 'step_seq', '')::int,
      coalesce(v_file_id, nullif(p_event ->> 'file_id', '')::uuid),
      p_event ->> 'note',
      p_event ->> 'source'
    );
  end if;
end;
$$;

-- Only the service role may call this — an ordinary signed-in user has no
-- direct path to it, same as every other document write.
revoke all on function public.apply_document_mutation from public, anon, authenticated;
grant execute on function public.apply_document_mutation to service_role;
