-- SUBAYBAY backend schema — Postgres/Supabase.
--
-- What does NOT live here, on purpose: the process map. Which offices a
-- document visits, in what order, what each step requires and who signs it —
-- all of that stays in app/src/data/trail.ts, reviewed and deployed like any
-- other code change (confirmed with the office 2026-09-05). This schema holds
-- only the things that actually happen: real documents, their history, the
-- people who touch them.
--
-- Photos (RECEIVED stamps, signatures, cancelled-document proof) are stored in
-- Google Drive, not here — document_files below holds only the metadata and
-- the Drive file id.
--
-- Apply with the Supabase CLI once a project exists:
--   supabase db push
-- Nothing in this file has been run against a live database yet.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Reference data. Low-risk, occasionally-edited lists — unlike the process
-- map, these are safe to let a future admin screen edit without a code review,
-- since getting an office's display name wrong has nowhere near the
-- consequence of getting its place in a routing sequence wrong.
-- ---------------------------------------------------------------------------

create table offices (
  code        text primary key,          -- matches TRAIL_OFFICES keys in trail.ts — e.g. 'OPAG', 'BAC', 'GOV'
  name        text not null,
  type        text not null check (type in ('opa_division','opa_facility','pg_office','national_agency','lgu','external')),
  is_routable boolean not null default true
);

create table programs (
  code  text primary key,                -- e.g. 'RICE', 'CORN & CASSAVA'
  name  text not null,
  color text not null                    -- hex, for the ProgramTag swatch
);

-- ---------------------------------------------------------------------------
-- People. auth.users is Supabase's own table (email, hashed password, one row
-- per login) — profiles is ours, holding everything the app actually needs
-- about a person, one-to-one with auth.users.
--
-- `role` is singular, not an array: every place the app reads a role today
-- (store.tsx's `role: Role = me?.roles[0] ?? 'viewer'`) already only ever
-- looks at the first one. A real multi-role person doesn't exist in the
-- office's user matrix, so this is a simplification, not a behavior change.
-- ---------------------------------------------------------------------------

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  name              text not null,
  position          text not null,
  office_id         text not null references offices(code),
  role              text not null check (role in ('encoder','liaison','pa','viewer')),
  scope_program_id  text references programs(code),   -- null = all programs
  signatory         text,                               -- matches a Signatory key in trail.ts, when this person signs
  -- Liaison assignment matrix: { trailCodes: string[], prCategories?: string[], catchAll?: boolean }
  assignment        jsonb,
  device            text check (device in ('web','phone')),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documents. One row per document the office tracks, mirroring the Doc type
-- in app/src/types.ts field for field — the frontend's own model is the
-- source of truth for this shape, not the other way around.
--
-- `custody` is the one column with no direct equivalent in Doc: it's the
-- output of custodyOf(doc) from workflow.ts, written by the same server-side
-- code that moves a document along its trail (see the Edge Functions note at
-- the bottom of this file) rather than computed here. RLS reads this column
-- to decide whether the signed-in encoder or liaison may write to a row — so
-- it has to be trustworthy, which means it must never come from a raw client
-- write, only from the one function that already computes it correctly today.
-- ---------------------------------------------------------------------------

create table documents (
  id                  uuid primary key default gen_random_uuid(),
  control_no          text not null unique,             -- OPA-<TYPE>-yyyy-mm-nnnn
  ref_number          text,                              -- the paper-tail or outside-issued number
  drs_no              text,
  tracking_code       text not null unique,              -- public TRK-XXXX-XXXX lookup code
  trail_code          text not null,                     -- Trail.code in trail.ts — not a foreign key; the trail lives in code
  program_id          text references programs(code),
  subject             text not null,
  particulars         text,
  amount              numeric,
  directive           text,
  disposition         text check (disposition in ('pa','release')),
  status              text not null,
  custody             text not null check (custody in ('office','field')),
  current_step_seq    int not null default 0,
  current_office_id   text references offices(code),
  current_holder_name text,
  created_by          uuid not null references profiles(id),
  created_at          date not null,
  completed_at        date,
  fields              jsonb not null default '{}'::jsonb,  -- per-type field values, keyed by TypeField.key
  prereq_doc_ids      uuid[] not null default '{}',
  prereq_manual       text[] not null default '{}',
  assigned_liaison_id uuid references profiles(id),
  follows_id          uuid references documents(id),      -- e.g. a PTR follows the TO it reports on
  deficiency          text,                                -- reason it was returned
  cancel_reason       text
);

create index documents_trail_code_idx on documents(trail_code);
create index documents_status_idx on documents(status);
create index documents_assigned_liaison_idx on documents(assigned_liaison_id);

-- One completed (or returned) step of the trail.
create table document_step_logs (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references documents(id) on delete cascade,
  seq              int not null,
  at               date not null,
  actor_name       text not null,
  outcome          text not null check (outcome in ('done','returned')),
  note             text,
  receipt_method   text check (receipt_method in ('qr_scan','signature','photo','manual_entry')),
  received_by_name text
);

-- The audit trail. Append-only — see the RLS policy below, which grants
-- INSERT and SELECT but never UPDATE or DELETE to any role, service role
-- excepted. A previously-logged event can't be quietly edited or removed
-- later by anyone, including a legitimately logged-in user.
create table document_events (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_name  text not null,
  type        text not null,
  from_status text,
  to_status   text,
  step_seq    int,
  file_id     uuid,  -- references document_files(id); not a hard FK so a file row and its event can be written in either order
  note        text,
  source      text not null check (source in ('web','mobile','system'))
);

-- Proof photos: metadata and the Google Drive pointer live here; the image
-- itself never touches this database.
create table document_files (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references documents(id) on delete cascade,
  name           text not null,
  page_role      text not null check (page_role in ('front','last','receiving_stamp','supporting','cancelled')),
  size_kb        int,
  captured_at    date not null,
  drive_file_id  text not null,   -- Google Drive file id — the office's own Drive, not this app's
  drive_view_url text,
  thumb_data_url text            -- small base64 preview, same as today's Doc.files[].thumb, for a fast UI without a Drive round-trip
);

alter table document_events
  add constraint document_events_file_id_fkey
  foreign key (file_id) references document_files(id);

-- A number issued by an office other than OPAg — a PR number from the BAC, a
-- Travel Order number from the Governor — recorded as it's captured, per the
-- needsRefNumberNow rule in workflow.ts.
create table document_external_refs (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  office_code  text not null,
  label        text not null,
  number       text not null,
  issued_at    date not null,
  recorded_by  text not null
);

-- A viewer nudging whoever is holding a document.
create table document_pokes (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  at          date not null,
  by_name     text not null,
  to_handler  text not null,
  note        text
);

create table transmittals (
  id               uuid primary key default gen_random_uuid(),
  no               text not null unique,
  liaison_id       uuid not null references profiles(id),
  to_office_id     text not null references offices(code),
  doc_ids          uuid[] not null,
  released_at      date,
  received_at      date,
  received_by_name text,
  status           text not null check (status in ('OPEN','RELEASED','RECEIVED'))
);

-- ---------------------------------------------------------------------------
-- Row Level Security — turned on for every table. Policies are written in a
-- separate migration (0002_policies.sql) once the write-path decision below
-- is settled, so the two don't have to be reasoned about at the same time.
-- ---------------------------------------------------------------------------

alter table offices enable row level security;
alter table programs enable row level security;
alter table profiles enable row level security;
alter table documents enable row level security;
alter table document_step_logs enable row level security;
alter table document_events enable row level security;
alter table document_files enable row level security;
alter table document_external_refs enable row level security;
alter table document_pokes enable row level security;
alter table transmittals enable row level security;

-- ---------------------------------------------------------------------------
-- NOTE ON THE WRITE PATH — decide before writing 0002_policies.sql.
--
-- A plain RLS policy can say "an encoder may UPDATE a document row when its
-- custody is 'office'" — but it cannot recompute what the *next* status,
-- current_step_seq or custody should be when a step is completed. That logic
-- (stepDone / receiptRecorded / departed in app/src/lib/transition.ts) is
-- currently ~80 lines of plain TypeScript with no DOM dependency, which is
-- exactly the shape Supabase Edge Functions run (Deno, plain TS/JS).
--
-- The plan: port transition.ts and the read side of workflow.ts (custodyOf,
-- availableActions, can, needsRefNumberNow) into one Edge Function per
-- action — advance, receive, depart, submit, cancel, etc. Each function reads
-- the row, re-checks the caller's role and the same custody rule the frontend
-- already trusts, and writes the *entire* next state (status, custody,
-- current_step_seq, the new event and step log row) in one transaction. RLS
-- on the base tables then only needs to allow SELECT broadly and deny direct
-- client UPDATE/INSERT on documents/document_events/document_step_logs
-- entirely — every write goes through a function that cannot be bypassed by
-- a client crafting its own request, which a plain per-column RLS policy
-- cannot guarantee on its own.
--
-- This reuses the same rule engine the prototype already runs on, rather than
-- writing the custody/permission logic a second time in SQL where it could
-- drift from the TypeScript version.
-- ---------------------------------------------------------------------------
