# Installation & Setup Guide

This guide walks through installing, configuring, and running **VellumDesk** locally or in production.

## Prerequisites

- **Node.js 22+** (required for native TypeScript execution via `node server.ts` in production and `tsx` in development)
- **npm 10+**
- A **Google Gemini API Key** (`GEMINI_API_KEY`) for AI drafting, section refinement, and audit endpoints
- *(Optional for Cloud Sync)* A **Firebase project** with **Cloud Firestore** and **Firebase Authentication (Google provider)** enabled

---

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```env
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"
```

> **Security note:** Never commit `.env` to version control. `GEMINI_API_KEY` is used strictly server-side inside `server.ts` and is never exposed to client bundles.

## 3. Configure Firebase (Optional for Local Session Mode)

VellumDesk runs in **Local Session Mode** out of the box without sign-in. To enable persistent Cloud Firestore storage, team sharing, and immutable version snapshots:

1. Ensure `firebase-applet-config.json` contains your Firebase Web App config (`apiKey`, `authDomain`, `projectId`, `firestoreDatabaseId`, etc.).
2. Enable **Google Sign-In** in **Firebase Console → Authentication → Sign-in method**.
3. Deploy the Firestore security rules defined in `firestore.rules`:
   ```bash
   npx firebase deploy --only firestore:rules
   ```
4. Validate rules locally with ESLint:
   ```bash
   npx eslint firestore.rules
   ```

## 4. Run Locally

Start the combined Express API, WebSocket collaboration server, and Vite dev middleware on port `3000`:

```bash
npm run dev
```

Verify the server health endpoint:

```bash
curl http://localhost:3000/api/health
```

## 5. Build & Run in Production

Run TypeScript verification, compile the frontend bundle into `dist/`, and launch the production Node.js server:

```bash
npm run lint
npm run build
npm start
```

The production server listens on `PORT` (default `3000`) and serves static assets from `dist/` alongside `/api/*` and `/ws`.

## Troubleshooting

- **AI endpoints return `500` or API key error**: Verify `GEMINI_API_KEY` is exported in your environment or present in `.env`.
- **Firestore permission denied**: Confirm Google Sign-In is enabled and `firestore.rules` has been deployed to the target `firestoreDatabaseId`.
- **Port `3000` already in use**: Stop the conflicting process or pass `PORT=3001 npm start`.
