# Pull Request: `feat/v1.0.0` — Initial Release of VellumDesk

## Summary

Introduces **VellumDesk v1.0.0**, an automated AI contract and business report drafting studio featuring customizable templates, Cloud Firestore vault persistence, real-time WebSocket collaboration, immutable version control, fuzzy archive search, global keyboard shortcuts, and PDF/DOCX/Markdown export.

## What's Included

### Core Drafting & AI Studio
- Server-side `@google/genai` endpoints in `server.ts`:
  - `POST /api/documents/draft` — Generates structured multi-section contracts and business reports from templates and party/metric metadata.
  - `POST /api/documents/refine-section` — Rewrites individual clauses or sections with quick presets or custom editorial instructions.
  - `POST /api/documents/audit` — Evaluates risk, completeness, and clarity with one-click section remediation.
- Customizable Template Library (`src/data/defaultTemplates.ts` + `TemplateCustomizerModal.tsx`).

### Collaboration, Storage & Versioning
- Firebase Auth + Cloud Firestore sync (`src/lib/firebase.ts`, `src/lib/documentService.ts`, `firestore.rules`, `firebase-blueprint.json`) with **Standard Cloud Sync** and **Restricted Private Vault** isolation tiers.
- Real-time WebSocket presence & section patching (`src/hooks/useCollaborationSocket.ts`, `/ws`).
- Version snapshot history with section-level diffs (`src/lib/diffUtils.ts`) and restore support.
- Section-anchored review comments with resolve/reopen workflow.

### Productivity, Search & Export
- Global keyboard shortcut listener in `src/App.tsx`:
  - `Ctrl+S` / `Cmd+S`: Save working draft in the Document Editor.
  - `Ctrl+N` / `Cmd+N`: Open Draft Studio for a new draft.
  - `Ctrl+F` / `Cmd+F`: Toggle and focus the Document Archive search bar.
- Fuzzy search (`src/lib/fuzzySearch.ts`) in `DocumentsIndex.tsx` matching document titles and categories with subsequence scoring and typo tolerance.
- Multi-format export (`src/lib/exportUtils.ts`) to `.pdf`, `.docx`, `.md`, and print layout.

### Documentation & GitHub Readiness
- Added `README.md`, `docs/INSTALL.md`, `CHANGELOG.md`, `LICENSE` (Apache-2.0).
- Added community templates & workflows (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/ci.yml`).
- Added OpenGraph social preview (`/social-preview.jpg`) and brand logo icon (`/logo-icon.jpg`).

## Verification Checklist

- [x] `npm run lint` (`tsc --noEmit`) passes with zero errors
- [x] `npm run build` (`vite build`) produces clean production bundle in `dist/`
- [x] `npx eslint firestore.rules` validates Firestore security rules
- [x] Global hotkeys (`Ctrl+S`, `Ctrl+N`, `Ctrl+F`) verified in `App.tsx`, `DocumentEditor.tsx`, and `DocumentsIndex.tsx`
- [x] Fuzzy search filters by document title and category (`contract` / `report`)
