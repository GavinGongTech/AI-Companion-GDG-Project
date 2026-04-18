# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All workspaces use **bun**, not npm. The repo is a bun monorepo with three packages: `server`, `web`, `extension`.

```bash
# Install all packages from root
bun install --frozen-lockfile

# Dev servers
bun run dev:server       # Express API on :3000 (node --watch)
bun run dev:web          # Vite web app on :5173
bun run dev:extension    # Vite watch build into extension/dist
bun run dev:all          # All three concurrently

# Build (web + extension only — server has no build step)
bun run build

# Lint all packages
bun run lint

# Server tests (vitest)
bun run --cwd server test
bun run --cwd server test -- --reporter=verbose   # with detail
bun run --cwd server test src/routes/routes.integration.test.js  # single file
```

Health check: `curl http://localhost:3000/health`

## Environment Variables

`server/.env` (required):
- `GEMINI_API_KEY` — Gemini API key
- `GOOGLE_APPLICATION_CREDENTIALS` — path to Firebase service account JSON
- `FIREBASE_PROJECT_ID`
- `GEMINI_MODEL` — optional override; defaults to `gemini-2.0-flash-exp`. **Never change the default without web-searching first** — the model list changes faster than training cutoffs.

`web/.env.local` and `extension/.env`: `VITE_FIREBASE_*` keys + `VITE_API_URL`.

## Architecture

### Three Packages

**`server/`** — Express 5 API, plain JS (no TypeScript). Single entry point `src/index.js` → `src/app.js`. All routes mount under `/api/v1` via `src/routes/index.js`. Auth is Firebase ID token verified by `requireFirebaseAuth` middleware on every protected route.

**`web/`** — TypeScript + React 19 + Vite. Marketing site + auth pages + dashboard. Uses TanStack Query for server state, Zustand for theme persistence, D3 for the concept graph, Radix UI for primitives. The `@` path alias points to `web/src/`.

**`extension/`** — Plain JSX + React 19 + Vite, built as Chrome MV3. Two separate entry points: `background.js` (service worker) and `sidepanel/` (React SPA). The extension and web app share no code — they have separate Firebase clients and API wrappers in their respective `lib/` directories.

### The Core AI Pipeline (`POST /api/v1/analyze`)

Five sequential async steps, each dependent on the previous:
1. `retrieveChunks(uid, courseId, question)` — embed the question, cosine-search Firestore chunks
2. `explainConcept(question, ragContext, smgHistory)` — Gemini primary model, returns structured JSON
3. `classifyConcept(question, explanation.solution)` — Gemini fast model, returns `{ conceptNode, errorType, confidence }`
4. `recordInteraction(uid, conceptNode, ...)` — SM-2 update to `users/{uid}/smg/{conceptNode}`
5. `saveInteraction(uid, ...)` — event log to `users/{uid}/events/{id}`

Steps 4 and 5 are parallelized with `Promise.all`. Gamification (`addXP`, `updateStreak`) is fire-and-forget after the response.

### Student Misconception Graph (SMG)

Each student has a Firestore subcollection `users/{uid}/smg/{conceptNode}`. The `conceptNode` key is snake_case (e.g. `derivatives_chain_rule`). The SM-2 algorithm lives in `server/src/services/misconception.js`. Accuracy, ease factor, review interval, and next review date are all stored here. The drill queue urgency score is `(overdueDays * 2) + ((1 - accuracyRate) * 5)`.

### RAG: Single vs. Multi-Course

`retrieveChunks` in `server/src/services/rag.js` branches on whether `courseId` is provided:
- **Single course**: uses Firestore native `findNearest` (vector index required)
- **No courseId**: fetches all courses sequentially, computes cosine similarity in-process — this is an N+1 pattern that degrades with many courses

Chunks are stored at `users/{uid}/courses/{courseId}/chunks/{id}` with a `embedding` vector field (768-dimensional, text-embedding-004).

### Quiz Session Security

Quiz answers are stored server-side at `users/{uid}/quizSessions/{sessionId}` at generation time. The client receives a `sessionId` but never sees the answers. Answer submission routes go through `POST /api/v1/quiz/answer` with `sessionId` + `questionIndex`, and the server grades against the stored session. Sessions expire after 30 minutes.

### Logging

Server uses `pino` (structured JSON). Import `logger` from `./logger.js`. HTTP request logging middleware is in `app.js`. Use `logger.info / warn / error` — never `console.log` in server code.

### Firestore Data Model

```
users/{uid}
  ├── email, displayName, createdAt
  ├── courses/{courseId}
  │   ├── files/{fileId}        — geminiFileUri, filename, fileHash
  │   └── chunks/{chunkId}      — content, embedding (vector), chunkIndex
  ├── events/{eventId}          — courseId, eventType, content, response, classifierTag
  ├── smg/{conceptNode}         — accuracyRate, easeFactor, reviewIntervalDays, nextReviewDate, errorTypeMap
  └── gamification/stats        — xp, level, streak, lastActivityDate, quizCount, unlockedAchievements
```

`quizSessions/{sessionId}` is a subcollection of `users/{uid}` (not `courses`).

### Extension Auth vs. Web Auth

The extension uses `chrome.identity.getAuthToken()` → `signInWithCredential()` (Google only). The web app uses Firebase Auth directly (Google SSO + email/password). Both produce Firebase ID tokens used as `Authorization: Bearer <token>` on every API call.

### Gemini Models

`gemini.js` uses two model constants:
- `PRIMARY_MODEL` — from `env.geminiModel` (explain, quiz generation, streaming)
- `FAST_MODEL` — hardcoded `gemini-2.0-flash` (classification, fast tasks)

The SMG section builder `buildSmgSection(smg, options)` is a private helper that all three Gemini prompt functions use — do not inline the top-errors logic again.

### Web State Management

- **TanStack Query** — all API data (graph, drill queue, events, gamification). Custom hooks in `web/src/hooks/`.
- **Zustand** — theme only (`web/src/store/theme.ts`), persisted to localStorage as `sf-theme`.
- **No other global state** — auth state lives in `web/src/lib/auth.tsx` context.

### CI

Three jobs on `main` and PRs: `lint` (all packages), `test-server` (vitest), `build` (web + extension). All run bun 1.3.11. Tests mock Firebase Admin and Gemini entirely — no real credentials needed.
