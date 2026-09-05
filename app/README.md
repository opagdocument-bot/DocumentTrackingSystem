# SUBAYBAY — web prototype

Clickable prototype of the document tracking system for the Office of the
Provincial Agriculturist, Aurora. Built to evaluate **flow**, not visuals —
the styling is deliberately plain and lives entirely in `src/styles.css`.

## Run

    npm install
    npm run dev

Opens on http://localhost:5173

## What to try

Switch roles with the picker in the top right. Each role sees a different set
of screens, and the sidebar suggests what to test.

1. **Uploader** — register a Travel Order. The form renders itself from the
   document type definition, so adding a type needs no code.
2. **Reviewer** — open a queued document. *Approve for release* stays disabled
   until every required attachment is ticked.
3. **Liaison** — select documents bound for one office, build a transmittal,
   then simulate the receiver scanning its QR.
4. **Program Coordinator** — scoped to the Rice program only.
5. **Office Head** — sees everything, plus aging and deficiency counts.

## The point of the demo

The dashboard's first card lists **completed travels with no Post-Travel
Report**. Your 2026 logbook has 222 Travel Orders and 44 Post-Travel Reports;
that gap is invisible in a spreadsheet because it needs two sheets joined.

## Data

No backend, no accounts, no network. Seed data is in `src/data/seed.ts`,
adapted from real rows in `OPAG documents 2026.xlsx`. State persists to
`localStorage`; **Reset data** in the top bar restores the seed.

## Structure

    src/types.ts       schema types, mirroring whitepaper §12
    src/data/seed.ts   offices, programs, document types, seeded documents
    src/lib/workflow.ts state machine, SLA/working days, the TEV-gap report
    src/store.tsx      state + actions
    src/screens/       one file per screen
    src/styles.css     all styling, token-driven — replace this wholesale
