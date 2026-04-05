# AI Study Companion: Refined Implementation Plan

## Context

Chrome extension + web app + Node/Express backend for university math/STEM students. The core differentiator is a **Student Misconception Graph (SMG)** that classifies interactions into concept nodes with error types, then uses SM-2 spaced repetition to schedule targeted review.

The backend services (Gemini integration, SM-2, RAG, embeddings, ingestion, OCR) are substantially built. The gaps are: **missing route files** the server expects, **missing Firebase/Firestore modules**, **no client-side auth**, **unwired extension UI**, **dead PostgreSQL artifacts**, and **outdated landing page copy**.

## Critical Finding: Server Won't Start

`server/src/routes/index.js` imports 3 route modules that **don't exist**:
- `./analyze.js` (analyze router)
- `./graph.js` (graph router)
- `./course.js` (course router)

Services import 2 modules that **don't exist**:
- `../db/firebase.js` (Firebase Admin SDK init — used by `auth.js`, `misconception.js`, `rag.js`, `ingestion.js`)
- `../services/firestore.js` (used by `quiz.js` for `saveInteraction`, `ingest.js` for `ensureUserDoc`)

**The server crashes on startup.** This is the highest priority fix.

## Dependency Graph

```
Phase 0: Make it Run
  ├─ 0.1 Create server/src/db/firebase.js (Firebase Admin init)
  ├─ 0.2 Create server/src/services/firestore.js (saveInteraction, ensureUserDoc, updateSMG stub)
  ├─ 0.3 Create server/src/routes/analyze.js
  ├─ 0.4 Create server/src/routes/graph.js
  ├─ 0.5 Create server/src/routes/course.js
  ├─ 0.6 Remove dead code (PG, dead auth, unused deps)
  ├─ 0.7 Fix env.js (add Firebase env vars)
  └─ 0.8 Fix README (UTF-16 → UTF-8)

Phase 1: Auth + Extension Wiring (depends on Phase 0)
  ├─ 1.1 Web: Firebase Auth (firebase SDK, AuthProvider, Login/SignUp rewrite)
  ├─ 1.2 Extension: Firebase Auth (chrome.identity flow)
  ├─ 1.3 Extension: Wire Ask page (POST /api/v1/analyze, response rendering)
  ├─ 1.4 Extension: Wire Quiz page (state machine, MCQ UI, answer submission)
  └─ 1.5 Backend: GET /api/v1/events endpoint

Phase 2: Differentiation (depends on Phase 1)
  ├─ 2.1 Floating widget + content script (Brightspace/Gradescope)
  ├─ 2.2 Extension: My Graph tab (progress bars)
  ├─ 2.3 Web: Dashboard + network graph (cytoscape.js)
  └─ 2.4 Narrow extension permissions in manifest.json

Phase 3: Polish (depends on Phase 2)
  ├─ 3.1 Landing page copy rewrite (anti-cognitive-debt positioning)
  ├─ 3.2 KaTeX math rendering (extension + web)
  ├─ 3.3 Error handling (boundaries, loading states, 401 redirect)
  ├─ 3.4 Backend hardening (zod validation, rate limiting, JSON retry)
  └─ 3.5 Tests + CI
```

---

## Phase 0: Make It Run

### 0.1 Create `server/src/db/firebase.js`

This is imported by `auth.js`, `misconception.js`, `rag.js`, `ingestion.js`. Must export `db` (Firestore instance) and `auth` (Firebase Auth instance).

```js
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { env } from "../env.js";

const app = initializeApp({
  credential: env.googleApplicationCredentials
    ? cert(JSON.parse(readFileSync(env.googleApplicationCredentials, "utf-8")))
    : applicationDefault(),
  projectId: env.firebaseProjectId,
});

export const db = getFirestore(app);
export const auth = getAuth(app);
```

### 0.2 Create `server/src/services/firestore.js`

Imported by `quiz.js` (for `saveInteraction`, `ensureUserDoc`) and `ingest.js` (for `ensureUserDoc`). The draft plan mentions `updateSMG()` as dead code here — don't create it.

```js
// saveInteraction(uid, { courseId, content, eventType, response, classifierTag })
//   -> writes to users/{uid}/events/{auto-id}, returns eventId
//
// ensureUserDoc(uid, email, displayName)
//   -> creates users/{uid} if it doesn't exist (set with merge)
```

### 0.3 Create `server/src/routes/analyze.js`

The "full pipeline" route: RAG retrieval -> Gemini explain -> classifier -> save event -> SM-2 update. Imports from `gemini.js` (explainConcept, classifyConcept), `rag.js` (retrieveChunks), `firestore.js` (saveInteraction), `misconception.js` (recordInteraction).

Body: `{ courseId?, content?, imageBase64? }`. If `imageBase64`, use OCR `extractTextFromBase64` first.

### 0.4 Create `server/src/routes/graph.js`

Three routes using existing functions from `misconception.js`:
- `GET /` → `getGraph(uid)` → `{ nodes: [...] }`
- `GET /drill` → `getDrillQueue(uid)` → `{ queue: [...] }`
- `GET /course/:courseId` → `getGraph(uid)` filtered by courseId

### 0.5 Create `server/src/routes/course.js`

- `GET /` → list `users/{uid}/courses`
- `GET /:courseId` → course doc + files subcollection + chunk count

### 0.6 Remove Dead Code

**Delete files:**
- `server/src/db/client.js` (exports `pool = null`)
- `server/src/db/migrations/001_init.sql`
- `docker-compose.yml`
- `docs/ARCHITECTURE.md` (describes PostgreSQL system, never built)

**Remove from `server/package.json`:**
- `pg`, `bcryptjs`, `jsonwebtoken`

**Delete or gut `server/src/routes/auth.js`:**
- All 4 routes return 501. Firebase handles auth client-side.
- Remove from `routes/index.js` import + mount.

**Remove `requireAuth` stub** from `server/src/middleware/auth.js` (only `requireFirebaseAuth` is used by real routes).

**Clean `server/.env.example`:**
- Remove `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `LMS_CLIENT_ID`, `LMS_CLIENT_SECRET`, `LMS_REDIRECT_URI`

**Clean `server/src/env.js`:**
- Remove `databaseUrl`, `jwtSecret`, `jwtExpiresIn`
- Add `firebaseProjectId`, `googleApplicationCredentials`

### 0.7 Fix README

Delete the UTF-16 corrupted file. Rewrite as UTF-8 markdown covering: project description, architecture (Extension + Web → Express API → Gemini + Firestore), quick start, environment variables, project structure.

### Verification (Phase 0)

1. `npm install` succeeds (no pg/bcryptjs/jsonwebtoken resolution)
2. `node server/src/index.js` starts without import errors (requires `.env` with valid Firebase creds)
3. `grep -r "pg\|postgres\|DATABASE_URL\|JWT_SECRET" server/src/` returns nothing
4. README renders on GitHub

---

## Phase 1: Auth + Extension Wiring

### 1.1 Web: Firebase Auth

**New deps:** `firebase` in `web/package.json`

**New files:**
- `web/src/lib/firebase.ts` — Firebase client SDK init (reads `VITE_FIREBASE_*` env vars)
- `web/src/lib/auth.tsx` — `AuthProvider` context with `onAuthStateChanged`, auto token refresh
- `web/src/lib/api.ts` — fetch wrapper injecting Bearer token from auth context

**Modified files:**
- `web/src/main.jsx` — wrap with `<AuthProvider>`
- `web/src/App.jsx` — add `/dashboard` route with `<ProtectedRoute>`
- `web/src/pages/Login.jsx` — replace stub `navigate("/welcome")` with `signInWithPopup` (Google) + `signInWithEmailAndPassword`; redirect to `/dashboard`
- `web/src/pages/SignUp.jsx` — same pattern with `createUserWithEmailAndPassword`
- `web/.env.example` — add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_API_URL`

Remove outdated copy from Login.jsx ("Sessions use JWT; Canvas connects via OAuth").

### 1.2 Extension: Firebase Auth

Chrome extensions can't use `signInWithPopup`. Flow:
1. `chrome.identity.getAuthToken({ interactive: true })` → Google OAuth token
2. `GoogleAuthProvider.credential(null, oauthToken)` → Firebase credential
3. `signInWithCredential(auth, credential)` → Firebase user + ID token
4. Store token in `chrome.storage.session`

**New files:**
- `extension/src/sidepanel/components/SignIn.jsx` — Google SSO button
- `extension/src/sidepanel/api.js` — fetch wrapper reading token from `chrome.storage.session`

**Modified files:**
- `extension/public/manifest.json` — add `"identity"` to permissions
- `extension/src/background.js` — add message listeners, token refresh alarm
- `extension/src/sidepanel/App.jsx` — auth state check, conditionally render SignIn or Shell

### 1.3 Wire Extension Ask Page

**File:** `extension/src/sidepanel/pages/Ask.jsx`

Add: `useState` for question/courseId/loading/error/response. Form `onSubmit` calls `POST /api/v1/analyze` with `{ content: question, courseId }`. Render response as structured cards: solution, concept badge, key formulas, relevant material, personalized callout.

### 1.4 Wire Extension Quiz Page

**File:** `extension/src/sidepanel/pages/Quiz.jsx`

State machine: idle → loading → question → answered → (next question). On mount, fetch `GET /api/v1/quiz/queue` to show weak concept chips. Generate via `POST /api/v1/quiz`. Submit answers via `POST /api/v1/quiz/answer`. Show correct/incorrect feedback + explanation.

### 1.5 Backend: Events Endpoint

Add `GET /api/v1/events?limit=50&offset=0` — query `users/{uid}/events` ordered by `createdAt desc`, paginated. Needed for web dashboard session history.

### Verification (Phase 1)

1. Google sign-in on web → token persists across refresh → redirects to /dashboard
2. Google sign-in in extension → token in chrome.storage.session → Shell renders
3. Extension Ask: type question → structured response with solution/concept/formulas
4. Extension Quiz: generate → select answer → green/red feedback → score updates
5. `GET /api/v1/graph` returns SMG data after interactions
6. Firestore console: `smg/{conceptNode}` has updated `easeFactor`, `nextReviewDate`

---

## Phase 2: Differentiation

### 2.1 Content Script + Floating Widget

**File:** `extension/src/content.js` (rewrite from 11-line stub)

Platform detection by hostname (brightspace.*.edu, gradescope.com). DOM extraction using platform-specific selectors. Shadow DOM widget (FAB → expanded panel with "Explain this" / "Quiz me" buttons). Auto-ingest: extract text → hash → check localStorage → send `INGEST_PAGE` to background → background calls `POST /api/v1/ingest/text`.

### 2.2 Extension: My Graph Tab

**New file:** `extension/src/sidepanel/pages/Graph.jsx`

Fetch `GET /api/v1/graph`. Render horizontal progress bars per concept: colored red→yellow→green by accuracy, sortable by weakness/urgency. Add "My Graph" nav tab to Shell.

### 2.3 Web Dashboard

**New files:**
- `web/src/pages/Dashboard.tsx` — grid layout
- `web/src/components/GraphView.tsx` — cytoscape.js network graph (nodes = concepts, color = accuracy, size = interaction count)
- `web/src/components/DrillQueue.tsx` — urgency-ranked list
- `web/src/components/SessionHistory.tsx` — recent events from `GET /api/v1/events`

**New dep:** `cytoscape` in `web/package.json`

### 2.4 Narrow Extension Permissions

**File:** `extension/public/manifest.json`

Content script matches: `*://*.brightspace.com/*`, `*://*.gradescope.com/*`, `*://brightspace.*.edu/*` (not `https://*/*`). Host permissions: localhost + production API only.

### Verification (Phase 2)

1. Visit Brightspace page → widget appears → shows "Ingested" after auto-ingest
2. "Explain this" → side panel opens with pre-filled context
3. Extension "My Graph" tab → progress bars sorted by weakness
4. Web `/dashboard` → network graph + drill queue + session history

---

## Phase 3: Polish

### 3.1 Landing Page Rewrite

**Files:** `web/src/pages/Home.jsx`, `Home.module.css`

Replace "Postgres + pgvector" / "JWT" / "Canvas OAuth" references. New hero: "Stop re-learning what you already forgot". Feature cards: auto-ingestion, course-grounded explanations, professor-style quizzes, misconception graph. Comparison table vs NotebookLM/StudyFetch/Anki.

### 3.2 KaTeX Math Rendering

**New dep:** `katex` in both `extension/package.json` and `web/package.json`

MathRenderer component: split on `$...$` / `$$...$$` delimiters, render LaTeX with `katex.renderToString`. Used in Ask response and Quiz explanation cards.

### 3.3 Error Handling

React ErrorBoundary wrappers. Loading skeletons. Toast/banner for network errors. 401 → redirect to sign-in. Offline detection banner.

### 3.4 Backend Hardening

- `zod` for POST body validation on all routes
- `express-rate-limit` at 30 req/min per uid
- Try/catch + retry around `JSON.parse(result.response.text())` in gemini.js
- Expand `/health` to check Firestore connectivity

### 3.5 Tests + CI

- Unit tests: SM-2 algorithm, `toQuality()`, `chunkText()`
- Integration tests: API routes with mocked Firestore/Gemini
- `.github/workflows/ci.yml`: lint + test on PR, build on merge

### Verification (Phase 3)

1. Landing page: no PostgreSQL/JWT/Canvas references, new comparison table renders
2. Math expressions render via KaTeX in explain/quiz responses
3. Invalid API requests return 400 with zod messages
4. >30 req/min from same user returns 429
5. `npm test` passes
