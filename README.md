<p align="center">
  <img src=".github/assets/social-preview.jpg" alt="VellumDesk — Automated Contract & Business Report Studio" width="100%" />
</p>

<p align="center">
  <img src=".github/assets/logo-icon.jpg" alt="VellumDesk Logo" width="64" height="64" />
</p>

<h1 align="center">VellumDesk</h1>

<p align="center">
  <strong>Automated AI contract and business report drafting studio with customizable templates, secure Cloud Firestore sync, real-time WebSocket collaboration, version control history, and PDF/DOCX/Markdown export.</strong>
</p>

<p align="center">
  <a href="docs/INSTALL.md">Installation Guide</a> ·
  <a href="docs/PR_V1.0.md">v1.0.0 Release PR</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="SECURITY.md">Security Policy</a> ·
  <a href="LICENSE">Apache-2.0 License</a>
</p>

---

## Key Features

- **AI-Assisted Drafting & Clause Refinement**: Server-side `@google/genai` (`gemini-4-hydrogen`) endpoints draft structured legal contracts and executive business reports, refine individual sections with quick presets or custom instructions, and run full compliance/clarity audits.
- **Customizable Template Library**: Built-in contract and report templates plus a full Template Customizer Modal for creating, editing, and persisting custom section blueprints.
- **Fuzzy Search & Archive Index**: Typo-tolerant subsequence and token-scored fuzzy search across document titles and categories (`contract` / `report`), paired with status and access filters.
- **Real-Time Collaboration**: WebSocket presence rooms (`/ws`) showing active section editors, live section patches, and section-anchored review comments with resolution tracking.
- **Immutable Version Control**: Snapshot checkpoints with side-by-side diff inspection and one-click version restoration.
- **Multi-Format Export**: Client-side export to **PDF** (`.pdf`), **Microsoft Word** (`.docx`), **Markdown** (`.md`), and print-ready layout sheets.
- **Cloud Security & Vault Isolation**: Firebase Authentication + Cloud Firestore security rules supporting owner-only **Restricted Private Vault** mode or explicit per-email team sharing.

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl+S` / `Cmd+S` | Save active working draft in the Document Editor |
| `Ctrl+N` / `Cmd+N` | Open Draft Studio to start a new AI-drafted document |
| `Ctrl+F` / `Cmd+F` | Toggle and focus the fuzzy search bar in Document Archive |
| `Esc` | Clear active search query or hide the search bar |

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Backend**: Express + native WebSockets (`ws`) served via `server.ts`
- **AI Engine**: `@google/genai` (server-side proxy routes under `/api/documents/*`)
- **Cloud Storage & Auth**: Firebase Auth (Google Sign-In) & Cloud Firestore (`firestore.rules` + `firebase-blueprint.json`)
- **Export Engines**: `jspdf` (PDF), `docx` (Word `.docx`)

## Quick Start

1. **Install dependencies** (requires **Node.js 22+**):
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` and `APP_URL` in `.env`. See [docs/INSTALL.md](docs/INSTALL.md) for Firebase setup and Firestore rules deployment.
3. **Run in development**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).
4. **Type-check & build for production**:
   ```bash
   npm run lint
   npm run build
   npm start
   ```

## Community & Contributing

We welcome bug reports, template improvements, and pull requests. Please review:
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [v1.0.0 Release PR Summary](docs/PR_V1.0.md)
