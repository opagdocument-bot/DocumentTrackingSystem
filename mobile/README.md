# SUBAYBAY — liaison app

The phone half of the document tracking system, for the **Liaison Officer only**.
The Encoder, the Provincial Agriculturist and viewers all work from the web app
in `../app`.

Expo SDK 57, React Native 0.86 — matching what Expo Go on the office phone supports.

## Run it on a phone

The phone and this computer must be on the **same Wi-Fi**.

    npm start          # or double-click start-phone.cmd

Then scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS).
If the QR does not appear, type the address into Expo Go by hand:

    exp://<this computer's LAN IP>:8081

Find the IP with `ipconfig` — it is the IPv4 address of your Wi-Fi adapter.

**Your Wi-Fi is currently marked Public**, and Windows Firewall blocks inbound
connections on Public networks — which is why the phone cannot reach port 8081
even though the server is running. Metro binds correctly; the packets never
arrive. Fix it once, in an **administrator** PowerShell:

    Set-NetConnectionProfile -Name "OPAG x DICT GovNet 5G 2" -NetworkCategory Private
    New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound `
      -LocalPort 8081 -Protocol TCP -Action Allow -Profile Private

Marking the network Private is the important half: it tells Windows this is a
network you trust, and the rule then only opens the port there — not on any
public network you join later.

If you would rather not touch the firewall:

    npm run tunnel

routes through Expo's servers instead of the LAN. It works on any network,
including mobile data, but it puts the dev server behind a temporary public URL,
so use it when you are actually testing and stop it afterwards.

## Sign in

Liaison accounts only — anyone else is refused with a message saying so.

| Username | Password |
|---|---|
| `aescobar` | `aescobar@opag` |
| `ldulay` | `ldulay@opag` |
| `lcrisanto` | `lcrisanto@opag` |
| `aposerio` | `aposerio@opag` |
| `ytolentino` | `ytolentino@opag` |

## What it does

**My load** — every document assigned to you, in the three buckets the office
rule defines: ready to carry, out of the office, back in the office. Newly
assigned ones carry a **NEW** tag until you act on one.

**Notifications** — coordinator follow-ups and new assignments in one place.

**A document** — where it is, its trail, its history, and the updates you can
record. Outside the office every update opens the camera first: the office's
rule is that custody is never a matter of somebody's word.

## Sharing the office's rules with the web app

The trail, the custody rule, the statuses, the numbering and the state machine
are **imported** from `../app/src`, not copied:

    app/src/types.ts          the schema
    app/src/data/trail.ts     the process map, and the checkpoint passes
    app/src/data/seed.ts      offices, people, document types, seed documents
    app/src/lib/workflow.ts   custody, permissions, statuses, SLA
    app/src/lib/transition.ts what a recorded update does to a document

`src/shared.ts` is the single door to them, so the relative path out of this
project appears exactly once. `metro.config.js` adds `app/src` to Metro's watch
folders, which is what lets a file outside the project be bundled.

**This matters more than it looks.** A liaison recording a signature must move a
document exactly as the encoder's browser would. Anything reimplemented here
would drift, and the phone would start telling a different story about the same
piece of paper.

## State

No backend. Documents live in `AsyncStorage` on the phone, seeded from the same
`full` set as the web app. The two do **not** sync — each keeps its own copy, so
an update made on the phone will not appear in the browser. Wiring them together
is the backend phase (whitepaper §14).
