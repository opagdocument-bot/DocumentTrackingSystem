-- SUBAYBAY backend — Row Level Security policies.
--
-- One principle decides almost everything here: custody decides who may
-- *act*, never who may *see*. Every signed-in person — encoder, liaison, PA,
-- viewer — already sees every document in the current prototype; only edit
-- rights differ by role. So every SELECT policy below is simply "any
-- signed-in user," and the real security work is on the write side.
--
-- The write side is deliberately simple: nobody gets a direct INSERT, UPDATE
-- or DELETE policy on documents or any of its child tables. Under Postgres
-- RLS, enabling it with no matching policy means "denied" — so those tables
-- are readable but not directly writable by any logged-in user. All writes
-- happen through Edge Functions (next migration) using the service role key,
-- which bypasses RLS by design. Each function re-implements the exact check
-- app/src/lib/workflow.ts already makes (custodyOf, can, availableActions)
-- before writing anything, so the rule can't drift between the two, and a
-- client can't shortcut it by crafting its own request — there is no direct
-- path to shortcut.
--
-- Apply with the Supabase CLI, or paste into the SQL Editor, same as 0001.

-- ---------------------------------------------------------------------------
-- Reference data — read by everyone signed in, written by nobody from the
-- client. Changing an office's name or adding a program is an admin action,
-- done directly in the Supabase dashboard for now rather than exposed in
-- app UI.
-- ---------------------------------------------------------------------------

create policy "offices are readable by signed-in users"
  on offices for select
  to authenticated
  using (true);

create policy "programs are readable by signed-in users"
  on programs for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- People. Names and roles need to be visible so the app can show "held by
-- Lyka Crisanto" — but a profile is edited only by the person administering
-- the roster (via the dashboard) or by a signed-in user updating their own
-- device field (which phone they last used), never their own role.
-- ---------------------------------------------------------------------------

create policy "profiles are readable by signed-in users"
  on profiles for select
  to authenticated
  using (true);

create policy "a user may update only their own device field"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Documents and everything attached to one. Readable by any signed-in user,
-- matching the app's existing "custody decides who acts, not who sees" rule.
-- No write policies at all: every mutation goes through an Edge Function.
-- ---------------------------------------------------------------------------

create policy "documents are readable by signed-in users"
  on documents for select
  to authenticated
  using (true);

create policy "document step logs are readable by signed-in users"
  on document_step_logs for select
  to authenticated
  using (true);

create policy "document events are readable by signed-in users"
  on document_events for select
  to authenticated
  using (true);

create policy "document files are readable by signed-in users"
  on document_files for select
  to authenticated
  using (true);

create policy "document external refs are readable by signed-in users"
  on document_external_refs for select
  to authenticated
  using (true);

create policy "document pokes are readable by signed-in users"
  on document_pokes for select
  to authenticated
  using (true);

create policy "transmittals are readable by signed-in users"
  on transmittals for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- A quick way to check this actually took effect, from the SQL Editor:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename;
-- should list exactly one policy per table above (two for profiles), all
-- "select" except the profiles one, which is "update".
-- ---------------------------------------------------------------------------
