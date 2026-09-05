# TASK: Implement Frontend Redesign from Reference Files (`Supporting Files/Design`)

You are tasked with redesigning the frontend of the **SUBAYBAY** Document Tracking System (web app in `app/` and mobile app in `mobile/`) to faithfully replicate the visual design system in `D:\Claude\DocumentTrackingSystem\Supporting Files\Design`.

---

### 🎯 Primary Objectives:
1. **Visual Redesign**: Upgrade the visual interface to be eye-catching, modern, clean, and intuitive, matching the layout, tokens, typography, and components from the design mockups.
2. **Preserve Business Logic & Workflow**: **DO NOT change the underlying document workflow, custody model, role permissions, or data layer.** Only adapt the presentation layer to seamlessly wrap the existing state and process flow.
3. **Keep Filipino Localizations in Step**: Ensure bilingual labels (`labelFil`, `STATUS_LABEL.fil`) remain intact.

---

### 📂 Design References to Replicate (`D:\Claude\DocumentTrackingSystem\Supporting Files\Design`):
Extract design tokens (colors, font hierarchy, spacing, border radii, shadows, card layouts) from:
- `Main-html/Main.dc.html` → Shell layout, sidebar, global header with search bar, and Dashboard screen.
- `DocumentDetail-html/DocumentDetail.dc.html` → Document Details screen, meta info panels, step timeline/stepper, and action modals.
- `Documents-html/Documents.dc.html` → Document Registry table, filters, status pills, and pagination/counts.
- `ReceiveRelease-html/ReceiveRelease.dc.html` → Document Intake, Release/Receive queues, and carrier assignment.
- `TrackByCode-html/TrackByCode.dc.html` → Public/Viewer Track-by-Code screen and public status timeline.

---

### 📐 Design System Specs to Apply:
- **Typography**: Primary UI font `'Public Sans'`, Monospace for control/ref numbers `'IBM Plex Mono'`.
- **Palette**:
  - Background / Desk: `#FBFAF7`
  - Sidebar / Secondary panels: `#F5F3EE`
  - Card & Container borders: `1px solid #E5E2DA`
  - OPAg Primary Accent: `#2E6A4A` (Hover: `#1F4B34`)
  - Text: Dark ink `#1C1B18`, Muted `#8A867C` / `#6B675E`
- **Component Styling**: Clean institutional government cards with subtle borders (`#E5E2DA`), top search bar with shortcut hint (`/`), refined status badges, and clear document step indicators.

---

### 🛡️ Non-Negotiable Flow & Architecture Constraints:
1. **Custody & Permissions**: Keep `custodyOf(doc)`, `availableActions(doc, role, userId)`, and `can(...)` in `app/src/lib/workflow.ts` fully functional. The Encoder operates inside OPAg, the Liaison operates outside, the PA oversees, and Viewers search/poke.
2. **Checkpoints & Proofs**: Preserve the `withPaCheckpoints` and `withReceiptCheckpoints` trail logic and mandatory `needsProof` photo attachments.
3. **State Management**: State remains in `app/src/store.tsx` with localStorage persistence.
4. **Mobile App Harmony**: Update the Liaison Expo app in `mobile/` to align with the new color tokens and clean card layouts while keeping its camera/photo capture and bottom thumb-rail navigation.

---

### 🔨 Implementation Steps:

1. **Step 1 — Foundation (`app/src/styles.css`)**:
   - Update CSS custom properties (tokens) in `app/src/styles.css` to match the `#FBFAF7` / `#2E6A4A` / `#F5F3EE` / `#E5E2DA` palette and Public Sans font hierarchy from `Main.dc.html`.
   - Update reusable utility classes for buttons, cards, tables, badges, headers, and form inputs.

2. **Step 2 — Shell & Navigation (`app/src/App.tsx`, `components.tsx`)**:
   - Update the top bar (search input, date display, "Encode document" CTA) and sidebar navigation to reflect the layout in `Main.dc.html`.

3. **Step 3 — Screen Redesigns (`app/src/screens/`)**:
   - Redesign `Dashboard.tsx` to match the layout in `Main.dc.html`.
   - Redesign `Registry.tsx` to match `Documents.dc.html`.
   - Redesign `DocumentDetail.tsx` to match `DocumentDetail.dc.html`.
   - Redesign `Intake.tsx` and `Review.tsx` to match `ReceiveRelease.dc.html`.
   - Ensure the Viewer tracking view matches `TrackByCode.dc.html`.

4. **Step 4 — Mobile App Alignment (`mobile/src/`, `mobile/App.tsx`)**:
   - Update theme tokens and component styles in the mobile app to match the web app's new look and feel.

5. **Step 5 — Verification & Build**:
   - Run `npx tsc --noEmit` in `app/` and `mobile/` to verify zero type errors.
   - Build and inline the single-file distribution into `docs/subaybay-app.html`.

Please proceed systematically, updating the files and running typechecks after each step.
