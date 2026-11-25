# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in **VellumDesk** (such as an authentication bypass, Firestore rule gap, XSS vector, or secret exposure), please **do not open a public GitHub issue**.

Instead, report it privately to the repository maintainers with:
- A clear description of the vulnerability and affected file(s)
- Steps to reproduce or a minimal proof of concept
- Potential impact and any suggested remediation

We aim to acknowledge reports within 48 hours and coordinate a fix before public disclosure.

## Security Architecture Notes

- **API Key Isolation**: `GEMINI_API_KEY` is read exclusively in `server.ts` and never bundled into client assets.
- **Firestore Rules**: Document, version, comment, and template access controls are enforced in `firestore.rules` and validated via `@firebase/eslint-plugin-security-rules`.
- **Restricted Private Vault**: Documents marked `vault_restricted` / `private` restrict reads and writes strictly to the authenticated owner UID.
