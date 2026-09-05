# SUBAYBAY

A document tracking system for the Office of the Provincial Agriculturist (OPAg),
Province of Aurora, Philippines — built to answer one question the office's paper
logbook never could: *where is this document right now, and who's holding it up?*

## What's here

| Path | What it is |
|---|---|
| [`app/`](app) | The web app — Vite + React + TypeScript. Used by the Encoder, the Provincial Agriculturist, and viewers. |
| [`mobile/`](mobile) | The liaison's phone app — Expo (SDK 57). The liaison is the only role that works from a phone; everyone else uses the web. |
| [`backend/`](backend) | The Supabase schema and setup notes for the system's real database — in progress, not yet live. |
| [`docs/`](docs) | The whitepaper and the published single-file build of the web app. |
| [`Supporting Files/`](Supporting%20Files) | The office's own source material — org chart, the real document logbook, design references. |

## Status

The web app and the liaison's phone app are both working prototypes — clickable,
tested, and running against seeded or empty demo data in the browser's own storage
(no backend yet). The two don't currently sync with each other; that's the backend
phase, underway in `backend/`.

**Web app (published):** https://claude.ai/code/artifact/e2adf4c4-0211-4bb7-a809-141a9926aa47

**Whitepaper:** https://claude.ai/code/artifact/7a422018-f1d4-42a7-b02b-5cc913251806

## Running it locally

### Web app

```bash
cd app
npm install
npm run dev          # http://localhost:5173
```

### Mobile app (liaison)

```bash
cd mobile
npm install
npm start            # scan the QR with Expo Go, phone on the same Wi-Fi
npm run tunnel        # if the LAN is blocked, or the phone is on mobile data
```

Full development notes — architecture, conventions, the trail-as-data model, the
publishing workflow — live in [`CLAUDE.md`](CLAUDE.md).

## The backend, in short

The office's actual process — which offices a document visits, in what order,
what each step requires — stays in code (`app/src/data/trail.ts`), reviewed like
any other change. The backend (Supabase Postgres + Auth, Google Drive for proof
photos) holds only the things that actually happen: real documents, their event
history, and the people who touch them. See `backend/supabase/0001_init.sql` for
the schema, and its own comments for why it's split this way.

## Roles

- **Encoder** — registers documents, updates them while they're inside the office
- **Liaison** — carries documents once they leave the office, photographs every
  hand-off as proof
- **Provincial Agriculturist** — oversight only; never updates anything
- **Viewer** — read-only, can follow up with whoever is currently holding a document
