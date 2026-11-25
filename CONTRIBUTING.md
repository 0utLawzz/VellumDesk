# Contributing to VellumDesk

Thank you for contributing to **VellumDesk**! Please review these guidelines before opening an issue or pull request.

## Code of Conduct

All contributors and maintainers are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Workflow

1. **Fork & Branch**: Create a descriptive branch from `main` (e.g., `feat/export-watermark` or `fix/fuzzy-search-ranking`).
2. **Install & Run**: Follow [docs/INSTALL.md](docs/INSTALL.md) to set up Node.js 22+, `.env`, and `npm run dev`.
3. **Follow Project Conventions**:
   - Keep `server.ts` compatible with Node.js native TypeScript execution (avoid `enum` and constructor parameter properties).
   - Keep `GEMINI_API_KEY` strictly server-side inside `server.ts`.
   - Maintain strict Firestore access controls in `firestore.rules` and `firebase-blueprint.json`.
   - Style UI components with Tailwind CSS using the existing parchment (`#fdfaf3`), forest teal (`#1a2e2a`), and terracotta (`#d44c3c`) tokens.
4. **Verify Before Submitting**:
   ```bash
   npm run lint
   npm run build
   npx eslint firestore.rules
   ```

## Pull Requests

- Use the provided [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
- Link related issues and summarize user-facing changes clearly.
- Include screenshots or recordings for UI updates when applicable.

## Reporting Bugs or Requesting Features

- Check existing issues before opening a new one.
- Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) or [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) templates.
