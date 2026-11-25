# Changelog

All notable changes to **VellumDesk** are documented in this file.

## [1.0.0] — 2026-11-25

### Added
- **Automated AI Document Drafting Studio**: Server-side Gemini endpoints (`/api/documents/draft`, `/api/documents/refine-section`, `/api/documents/audit`) for contracts and executive business reports.
- **Customizable Templates**: Built-in contract and report templates plus user-defined template creation and persistence.
- **Fuzzy Archive Search**: Subsequence and typo-tolerant fuzzy filtering by title or category in `DocumentsIndex`.
- **Global Hotkeys**: `Ctrl+S` (save draft), `Ctrl+N` (open Draft Studio), and `Ctrl+F` (toggle & focus search bar).
- **Real-Time Collaboration & Version Control**: WebSocket live presence and patches, anchored comments, immutable version snapshots, and diff inspection.
- **Multi-Format Export**: Client-side `.pdf` (`jspdf`), `.docx` (`docx`), `.md`, and print sheet exports.
- **Cloud Security**: Firebase Auth + Cloud Firestore rules supporting Standard Cloud Sync and Restricted Private Vault storage tiers.
- **GitHub & Community Readiness**: `README.md`, `docs/INSTALL.md`, `docs/PR_V1.0.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`, CI workflow, issue/PR templates, and social preview/logo assets.
