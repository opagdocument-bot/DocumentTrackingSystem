# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

SUBAYBAY — a document tracking system for the Office of the Provincial Agriculturist (OPAg),
Province of Aurora, Philippines. `app/` is a clickable prototype built to evaluate **process flow**,
not visuals. There is no backend: state lives in memory and `localStorage`.

Four top-level directories:

- `app/` — the Vite + React + TypeScript prototype
- `docs/` — the whitepaper (`whitepaper.html`) and the published single-file build (`subaybay-app.html`)
- `mobile/` — the liaison's Expo app (SDK 54), which imports the office rules from `app/src`
- `Supporting Files/` — the office's real source material: org chart, `OPAG documents 2026.xlsx`, frontend design references

Not a git repository. There is no version control safety net — prefer additive changes over
deleting existing data (e.g. seed sets), and say so when removing something irreversible.

## Commands

All commands run from `app/`.

```bash
npm install
npm run dev          # http://localhost:5173
npx tsc --noEmit     # typecheck — run this after every change
npm run build        # tsc -b && vite build
```

**There is no test framework.** Verification is done by typechecking plus throwaway scripts bundled
with the esbuild that ships inside Vite. This is the established pattern for checking behaviour —
write the script into `app/`, run it, delete it:

```bash
cd app
cat > __q.ts <<'TS'
import { makeDB } from './src/data/seed'
import { availableActions, trailFor } from './src/lib/workflow'
// assert whatever the change claims to do, and print it
TS
npx esbuild --bundle --platform=node --format=cjs --outfile=__q.cjs __q.ts --log-level=error \
  && node __q.cjs && rm -f __q.ts __q.cjs
```

The entry file must live inside `app/` or its relative imports will not resolve.

## The mobile app

`mobile/` is the liaison's phone app — Expo SDK 54, pinned to what the office's Expo Go supports.
Only the liaison uses it; every other role works from the web.

```bash
cd mobile
npm start            # scan the QR with Expo Go, phone on the same Wi-Fi
npm run tunnel       # when the LAN is blocked or the phone is on mobile data
npx tsc --noEmit     # typechecks the shared app/src files too
```

It **imports** the shared rules from `app/src` rather than copying them, through `mobile/src/shared.ts`
and a `watchFolders` entry in `metro.config.js`. Do not reimplement trail, custody, status or
transition logic there — a liaison recording a signature must move a document exactly as the
encoder's browser would. `app/src/lib/transition.ts` exists for this reason: it holds the pure
document transitions (`stepDone`, `receiptRecorded`, `departed`) that both stores call. It cannot
live in `workflow.ts` because it needs `officeIdFor` from the seed, which already imports workflow.

Metro's resolver is deliberately left at its defaults. Restricting `nodeModulesPaths` or setting
`disableHierarchicalLookup` breaks Expo's own nested dependencies — `expo-asset` is not hoisted.

The phone keeps its own documents in `AsyncStorage`. The two apps do **not** sync; that is the
backend phase.

## Publishing

The user reviews work in a browser, not the terminal. After a change: build, inline into a single
HTML file, and republish to the **same** artifact URL (`docs/subaybay-app.html` →
`https://Codex.ai/code/artifact/e2adf4c4-0211-4bb7-a809-141a9926aa47`). Always end the reply with
that link.

Inlining has one non-obvious trap. **Use a function replacer, never a string**, in
`String.prototype.replace`:

```js
html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, () => '<script type="module">' + jsTxt + '<' + '/script>')
```

React's minified bundle contains the literal `$&`, which a string replacement expands as
"the matched substring" — silently splicing a `<script src=…>` tag into the middle of React and
breaking the page with no error. Always assert `html.includes(jsTxt)` after inlining.

## Architecture

### The trail is data, not code

`src/data/trail.ts` is the single source of truth for routing, transcribed from the office's own
process map. A `Trail` is a document type plus an ordered list of `TrailStep`s, each naming an
office, a signatory and typical working days. Adding or changing a document type needs no changes
elsewhere — screens render themselves from this plus the field definitions in `src/data/seed.ts`.

`TRAILS` is the raw transcription. Two passes then derive what the app actually uses:

```
TRAILS → withPaCheckpoints → withReceiptCheckpoints → TRAILS_WITH_CHECKPOINTS
```

- **`withPaCheckpoints`** inserts a `record_in` step before every Provincial Agriculturist signature
  and a `record_out` after it, so custody is logged either side of his desk.
- **`withReceiptCheckpoints`** inserts a `record_receipt` wherever the route crosses back into OPAg
  from an outside office.

Both renumber `seq`. **Always read trails through `trailFor(code)`**, never `TRAILS` directly, or
you get the pre-checkpoint version. Note `TRAILS_WITH_CHECKPOINTS` is declared *after*
`TRAIL_OFFICES` because the receipt step labels read it at module-init time.

Where the trail data contradicts the office's stated process, the fix goes in `trail.ts` with a
comment explaining what the sheet said and why it was changed.

### The custody rule

`custodyOf(doc)` returns `office` or `field` from the current step's `officeCode`. This is the spine
of the whole permission model:

- inside OPAg → the **Encoder** updates it, including recording that the PA signed
- outside → the **assigned Liaison** updates it
- the **Provincial Agriculturist** updates nothing, ever — oversight only
- the **Viewer** can only view and poke whoever holds the document

Two functions enforce this and nothing should bypass them: `availableActions(doc, role, userId)` for
buttons, and `can(role, capability, doc, userId)` for edit rights. A previous bug let viewers edit
reference numbers because three call sites checked permissions themselves.

### Proof of custody outside the office

An office ruling, and it applies to every document: once a document leaves OPAg,
the liaison logs **two** things at every stop — that the office received the paper, and that
its signatory signed it — and **both need a photograph** of the document showing the RECEIVED
stamp, sticker or note. `Action.needsProof` marks those; `ProofPrompt` in `components.tsx`
collects the file, and the store writes the file and the status change in the same update so a
document can never be marked received with nothing to show for it.

The status text follows the paper: `statusPhrase(doc)` turns a bare `IN_TRANSIT` into
"In transit to HRMO", `AT_OFFICE` into "In HRMO for signature", and a finished approval trail into
"Approved". `StatusPill` takes the whole `doc` for this reason, never a bare status.

`statusForStep` distinguishes the two ways a document moves: leaving OPAg gives `FOR_RELEASE`
(it waits for the encoder to name a carrier), while moving between two outside offices gives
`IN_TRANSIT` — the liaison already has it and simply walks it over.

Custody decides who may *act*. It does **not** decide visibility — `liaisonLoad` returns everything
still assigned and open, and `loadBucket(doc)` sorts each into exactly one of `carry` / `field` /
`office`. Every open document must land in a bucket; a hard-coded status list is what previously
made documents vanish from My Load.

### Numbering

- `nextControlNo` issues `OPA-<TYPE>-yyyy-mm-nnnn` on save — one series per document type, restarting
  monthly, taken from the **highest already used** so gaps are never back-filled.
- `paperNumber(controlNo)` returns the `yyyy-mm-nnnn` tail — what the clerk writes on documents the
  office numbers itself (`issuesOwnRefNumber`). Derived, never counted separately, so the two cannot drift.
- Reference numbers issued *outside* (BAC, Governor, Budget) are typed in. `needsRefNumberNow(doc)`
  demands one only once the document has actually passed the issuing office.
- Seed documents are numbered by `numberInOrder()` in a second pass, sorted by `createdAt`, because
  `mk()` runs in source order.

### State

`src/store.tsx` holds the single context: reference data always comes from code, and only `docs` and
`transmittals` are restored from `localStorage`. This is deliberate — editing a name or a trail must
show up without the tester wiping their session.

`makeDB(mode)` serves two seed sets: `walkthrough` (3 documents, one per acting role — the default)
and `full` (33 documents). Switchable from the sidebar.

`src/lib/viewstate.ts` is a `useState` that survives unmounting, keyed by string. Screens use it for
tabs and filters so opening a document and pressing Back returns you to the list you were looking at.
View state only — never anything the office depends on.

`TODAY` in `src/lib/workflow.ts` is a frozen date (`2026-08-26`). All ages and SLAs derive from it.

### Conventions

- Comments explain *why*, especially where the code departs from the process map. Match the density
  of the surrounding file.
- User-facing wording matters to this office and has been corrected repeatedly — reuse existing
  phrasing rather than inventing new labels for the same thing.
- Filipino (`labelFil`, `STATUS_LABEL.fil`) must be kept in step with English when either changes.
- Bash heredocs eat backslashes. Multi-line TypeScript containing regexes, `${}` template literals
  or JSX is safer through the Edit/Write tools than through `node - <<'EOF'` or `perl -pe`.

## Known gaps

`app/README.md` is **stale** — it describes an older five-role model (Uploader, Reviewer, Program
Coordinator, Office Head) and a role picker that no longer exists. The current roles are encoder,
liaison, pa, viewer, reached through a login page. Treat this file as authoritative over it.

The `full` seed set has 11 documents missing fields that later became required; the `walkthrough`
set is complete. `prerequisiteCodes` referencing `PTR`, `CTC`, `ITR`, `DTR` point at documents the
office does not track — they behave correctly as plain text checkboxes.

The whitepaper's §19 lists open questions the office has not yet answered.
