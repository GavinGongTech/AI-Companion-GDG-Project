# Study Flow — Design Document

*AI Study Companion · Team of 4 · Built on Google*

> **Audience**: developers contributing to this repo. For the full product pitch see `AI_Companion_Design_Doc_v3.md`.

---

## 1. Product Vision

Study Flow is a Chrome MV3 extension + React web app that builds a persistent model of each student's misconceptions and uses spaced repetition to fix them — **without asking the student to do anything extra**.

**Three core innovations vs. ChatGPT / NotebookLM:**

| Feature | Study Flow | ChatGPT | NotebookLM | Anki |
|---------|-----------|---------|------------|------|
| Knows your syllabus | Auto (content script) | No | Manual | No |
| Tracks misconceptions | Yes (SMG + SM-2) | No | No | Manual |
| Professor-style quizzes | Yes (weighted by weakness) | Generic | No | Manual |
| Lives in browser | Side panel | New tab | New tab | Separate app |
| Grows smarter over time | Yes | Resets per chat | Static | Manual |

**Target users**: university students on Brightspace or Gradescope, taking STEM courses.

---

## 2. System Architecture

```
Brightspace / Gradescope page
    │
    ▼  (content script auto-fire)
extension/src/content.js
    │  POST /api/v1/ingest/text
    ▼
┌───────────────────────────────────────────────────┐
│              Express API  (port 3000)             │
│                                                   │
│  POST /api/v1/analyze  ──► RAG ──► Gemini explain │
│                          ──► Gemini classify      │
│                          ──► recordInteraction()  │
│                          ──► saveInteraction()    │
│                                                   │
│  POST /api/v1/quiz      ──► getWeakestConcepts()  │
│                          ──► Gemini generateQuiz  │
│                          ──► recordInteraction()  │
│                                                   │
│  GET  /api/v1/graph     ──► getGraph()            │
│  GET  /api/v1/graph/drill ► getDrillQueue()       │
└───────────┬──────────────────────────┬────────────┘
            │                          │
            ▼                          ▼
       Firestore                  Gemini / Cloud Vision
  users/{uid}/smg/          text-embedding-004 (RAG)
  users/{uid}/courses/       gemini-2.0-flash (explain, classify, quiz)
  users/{uid}/events/        cloud-vision (OCR)

Chrome Extension side panel
    │  Firebase ID Token (chrome.identity → signInWithCredential)
    └─► same /api/v1/* endpoints above

Web App (React)
    │  Firebase ID Token (signInWithPopup / signInWithEmailAndPassword)
    └─► same /api/v1/* endpoints above
```

### Packages / layout

```
ai-companion-gdg-project/
├── server/          Express API  (Node.js ESM, bun)
│   ├── src/
│   │   ├── routes/      analyze.js  quiz.js  ingest.js  graph.js  course.js  events.js
│   │   ├── services/    gemini.js  embeddings.js  rag.js  ingestion.js
│   │   │               misconception.js  ocr.js  firestore.js  cache.js
│   │   ├── middleware/  auth.js  errorHandler.js  rateLimit.js  validate.js
│   │   └── db/          firebase.js  (admin SDK init)
├── extension/       Chrome MV3  (React + Vite, bun)
│   ├── src/
│   │   ├── background.js    side panel opener + message bridge
│   │   ├── content.js       Brightspace/Gradescope detection + auto-ingest
│   │   └── sidepanel/       React app (Hub | Ask | Quiz | My Graph tabs)
│   └── public/manifest.json
└── web/             Web app  (React 19 + Vite, bun)
    └── src/
        ├── pages/   Home.jsx  Login.jsx  SignUp.jsx  Dashboard.jsx
        └── contexts/authContexts/  (AuthProvider, useAuth)
```

---

## 3. Data Flow: Explain (Ask) Mode

```
1.  Student types question in extension side panel
2.  POST /api/v1/analyze  { content, courseId? }
3.  retrieveChunks(uid, courseId, question)
       → embed question with text-embedding-004 (768-dim)
       → Firestore findNearest on users/{uid}/courses/{courseId}/chunks/
       → returns top-5 matching text chunks (cosine similarity fallback if needed)
4.  explainConcept(question, ragContext, smgHistory)
       → Gemini 2.0 Flash, temp 0.4
       → structured JSON: { solution, mainConcept, relevantLecture, keyFormulas, personalizedCallout }
5.  classifyConcept(question, solution)
       → second Gemini call
       → returns { conceptNode, errorType, confidence }
       → conceptNode is snake_case (e.g. "lhopitals_rule")
       → errorType is one of: conceptual_misunderstanding | procedural_error | knowledge_gap | reasoning_error | none
6.  saveInteraction(uid, { courseId, content, eventType:"explain", response, classifierTag })
       → writes to users/{uid}/events/{auto-id}
7.  recordInteraction(uid, conceptNode, { errorType, confidence, courseId })
       → SM-2 update on users/{uid}/smg/{conceptNode}
       → cacheInvalidate("graph:{uid}") + cacheInvalidate("drill:{uid}")
8.  Response returned to extension
```

---

## 4. Data Flow: Quiz Mode

```
1.  Student requests quiz (topic optional)
2.  POST /api/v1/quiz  { topic?, courseId?, count? }
3.  If no topic → getWeakestConcepts(uid)
       → SMG concepts with nextReviewDate ≤ now, ordered by date
       → fallback: lowest accuracyRate concepts
4.  retrieveChunks for topic context
5.  generateQuiz(topic, chunks, smgData, count)
       → Gemini 2.0 Flash, temp 0.7
       → 4-option MCQ, difficulty based on student accuracy:
            < 30% accuracy → easy
            30–60%         → medium
            > 60%          → hard
6.  Student submits answer → POST /api/v1/quiz/answer
       { conceptNode, selectedAnswer, correctAnswer, courseId? }
7.  recordInteraction(uid, conceptNode, { isCorrect, errorType, confidence, courseId })
       → SM-2 update: correct → interval grows, incorrect → interval resets to 1 day
```

---

## 5. Data Flow: Ingestion

```
Auto (content script):
  Detects brightspace.*.edu  or  *.gradescope.com
  → POST /api/v1/ingest/text  { courseId, rawContent, sourcePlatform:"brightspace" }

Manual (extension or web file upload):
  → POST /api/v1/ingest/upload  (multipart: file + courseId + sourcePlatform)
  → OCR if image/PDF (Cloud Vision API)

Both paths:
  → chunkText(text)         ~500-char overlapping chunks
  → embedBatch(chunks)      768-dim vectors
  → batch write to Firestore: users/{uid}/courses/{courseId}/chunks/
  → upload to Gemini File API  → store URI in Firestore files subcollection
```

---

## 6. SM-2 Spaced Repetition Algorithm

Implementation: `server/src/services/misconception.js`

### Quality mapping (`toQuality`)

| Signal | Quality | Meaning |
|--------|---------|---------|
| `isCorrect === false`, confidence > 0.8 | 0 | Confident wrong |
| `isCorrect === false`, confidence > 0.5 | 1 | Wrong |
| `isCorrect === false`, confidence ≤ 0.5 | 2 | Barely wrong |
| Explain mode (no correct/wrong) | 3 | Exposure only |
| `isCorrect === true`, `errorType !== "none"`, confidence ≤ 0.7 | 4 | Correct with hesitation |
| `isCorrect === true`, `errorType !== "none"`, confidence > 0.7 | 3 | Correct (harder) |
| `isCorrect === true`, `errorType === "none"` | 5 | Perfect (easy) |

### Interval update (`sm2`)

```
easeFactor' = max(1.3, EF + 0.1 - (5-q)*(0.08 + (5-q)*0.02))

if q < 3:     interval = 1  (reset on failure)
else if prev == 0: interval = 1
else if prev == 1: interval = 6
else:          interval = round(prev * easeFactor')
```

Interval is capped at 365 days.

### Drill queue urgency

```
urgency = (overdueDays * 2) + ((1 - accuracyRate) * 5)
```

Higher urgency = shown first in quiz and dashboard drill queue.

---

## 7. Misconception Taxonomy

The classifier assigns each interaction an `errorType`:

| errorType | Meaning |
|-----------|---------|
| `conceptual_misunderstanding` | Wrong mental model of a concept |
| `procedural_error` | Knows the concept but applies it incorrectly |
| `knowledge_gap` | Hasn't encountered this concept before |
| `reasoning_error` | Logic / inference error (not a knowledge gap) |
| `none` | No error detected (correct answer or no misconception) |

`conceptNode` is the snake_case concept identifier (e.g., `lhopitals_rule`, `matrix_multiplication`, `dynamic_programming`). It serves as the Firestore document ID in `users/{uid}/smg/`.

---

## 8. API Reference

All endpoints require `Authorization: Bearer <firebase-id-token>` except `/health`.

| Method | Endpoint | Body / Params | Response |
|--------|----------|---------------|----------|
| GET | `/health` | — | `{ ok, service, env?, firestore? }` |
| POST | `/api/v1/analyze` | `{ content, courseId?, imageBase64? }` | `{ question, solution, mainConcept, relevantLecture, keyFormulas, personalizedCallout, classifierTag, eventId }` |
| POST | `/api/v1/explain` | `{ question, courseId? }` | Same as analyze, no SMG update |
| POST | `/api/v1/quiz` | `{ topic?, courseId?, count? }` | `{ question, options[], answer, explanation, difficulty, conceptNode }` |
| POST | `/api/v1/quiz/answer` | `{ conceptNode, selectedAnswer, correctAnswer, courseId? }` | `{ isCorrect, eventId }` |
| GET | `/api/v1/quiz/queue` | — | `{ queue: [{ conceptNode, accuracyRate, nextReviewDate, urgency }] }` |
| POST | `/api/v1/ingest/upload` | multipart: `file`, `courseId`, `sourcePlatform` | `{ ok, filename, courseId }` |
| POST | `/api/v1/ingest/text` | `{ courseId, rawContent, sourcePlatform?, filename? }` | `{ ok, courseId, ingestedAt }` |
| GET | `/api/v1/graph` | — | `{ nodes: [SMGNode] }` |
| GET | `/api/v1/graph/drill` | — | `{ queue: [DrillItem] }` |
| GET | `/api/v1/graph/course/:courseId` | — | `{ nodes: [SMGNode] }` |
| GET | `/api/v1/courses` | — | `{ courses: [{ courseId, platform, lastIngestedAt }] }` |
| GET | `/api/v1/courses/:courseId` | — | `{ courseId, ingestedDocs, chunkCount }` |
| GET | `/api/v1/events` | `?limit=50&offset=0` | `{ events, count }` |

### Type: SMGNode
```json
{
  "conceptNode": "lhopitals_rule",
  "accuracyRate": 0.6,
  "errorTypeMap": { "procedural_error": 2, "knowledge_gap": 1 },
  "nextReviewDate": "<timestamp>",
  "interactionCount": 5
}
```

### Type: DrillItem
```json
{
  "conceptNode": "lhopitals_rule",
  "accuracyRate": 0.6,
  "nextReviewDate": "<timestamp>",
  "urgency": 7.0
}
```

---

## 9. Firestore Data Model

All data is under `users/{uid}/`. Users can only read/write their own subcollections (enforced by Firestore security rules and the backend `requireFirebaseAuth` middleware).

### `users/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| email | string | From Firebase Auth |
| displayName | string | From Firebase Auth |
| createdAt | timestamp | First sign-in |

### `users/{uid}/smg/{conceptNode}`
| Field | Type | Notes |
|-------|------|-------|
| courseId | string | Most recent course |
| accuracyRate | number | correctCount / (correctCount + incorrectCount) |
| correctCount | number | Running total |
| incorrectCount | number | Running total |
| errorTypeMap | map | `{ errorType: count }` |
| interactionCount | number | All interactions (including explains) |
| easeFactor | number | SM-2 EF, min 1.3, default 2.5 |
| reviewIntervalDays | number | Days until next review |
| nextReviewDate | timestamp | EF-scheduled review date |
| lastInteractionAt | timestamp | Server timestamp |
| lastErrorAt | timestamp \| null | Last wrong answer |

### `users/{uid}/events/{eventId}`
| Field | Type | Notes |
|-------|------|-------|
| courseId | string | — |
| eventType | string | "explain" \| "quiz_generated" \| "quiz_answer" |
| content | string | Student's question or topic |
| response | map | Full Gemini response |
| classifierTag | map | `{ conceptNode, errorType, confidence }` |
| requestMeta | map | `{ path, method, ip, userAgent }` |
| createdAt | timestamp | — |

### `users/{uid}/courses/{courseId}`
| Field | Type | Notes |
|-------|------|-------|
| platform | string | "brightspace" \| "gradescope" \| "upload" |
| lastIngestedAt | timestamp | — |

### `users/{uid}/courses/{courseId}/chunks/{chunkId}`
| Field | Type | Notes |
|-------|------|-------|
| content | string | ~500-char text chunk |
| embedding | vector | 768-dim float (Firestore Vector type) |
| metadata | map | `{ filename, source, page, week }` |
| chunkIndex | number | Position in original doc |
| createdAt | timestamp | — |

### `users/{uid}/courses/{courseId}/files/{fileId}`
| Field | Type | Notes |
|-------|------|-------|
| geminiFileUri | string | Gemini File API URI (server-side only) |
| filename | string | — |
| fileHash | string | SHA-256 of filename + courseId (dedup key) |
| sourcePlatform | string | — |
| uploadedAt | timestamp | — |

---

## 10. Authentication

```
Extension flow:
  chrome.identity.getAuthToken()     → Google OAuth access token
  GoogleAuthProvider.credential(null, token)
  signInWithCredential(auth, cred)   → Firebase user + ID token
  Authorization: Bearer <id-token>   → API calls

Web app flow:
  signInWithPopup(auth, GoogleAuthProvider)    → Firebase user + ID token
  OR signInWithEmailAndPassword(auth, e, p)    → Firebase user + ID token
  Authorization: Bearer <id-token>             → API calls

Backend:
  requireFirebaseAuth middleware
  auth.verifyIdToken(token)          → { uid, email, name }
  req.user set for all downstream handlers
```

---

## 11. In-Memory Cache

`server/src/services/cache.js` — LRU Map with TTL.

- **Capacity**: 5,000 entries max (evicts oldest on overflow)
- **TTL**: per-entry (default 60 s for graph/drill responses)
- **Sweep**: expired entries purged every 100 writes
- **LRU**: `cacheGet` deletes + re-inserts to refresh insertion order
- **Invalidation**: `analyze.js` calls `cacheInvalidate("graph:{uid}")` and `cacheInvalidate("drill:{uid}")` **after** `recordInteraction` completes (race-condition-safe)

---

## 12. Extension UX

**Side panel tabs** (dark theme: bg `#06080c`, accent `#3ee0d0`):

| Tab | What it does |
|-----|-------------|
| Hub | Shows SMG-weighted recommended topics + quick links to Ask / Quiz |
| Ask | Text input → calls `/analyze` → renders solution cards (step-by-step, key formulas, relevant lecture, personalized callout based on SMG) |
| Quiz | Topic input (or auto-select from weak areas) → MCQ with 4 options → color-coded feedback → running score |
| My Graph | Network visualization of SMG concept nodes; planned (currently dashboard is web-only) |

**Content script** (`content.js`):
- Triggers on `*://*.brightspace.com/*` and `*://*.gradescope.com/*`
- Extracts page text, sends to `/api/v1/ingest/text`
- Shadow DOM widget planned for "Explain this" / "Quiz me" buttons on selected text

---

## 13. Security Model

| Concern | Implementation |
|---------|----------------|
| API auth | Every route (except `/health`) requires a valid Firebase ID token |
| Data isolation | All Firestore paths scoped to `users/{uid}/`; Firestore rules enforce `request.auth.uid === userId` |
| No credential storage | Extension uses `chrome.identity` (existing Google session); never reads Brightspace cookies or passwords |
| Gemini File URIs | Stored in Firestore server-side; never sent to clients |
| Input limits | Express JSON parser capped at 1MB; route-level schema validation via `validate` middleware |
| Rate limiting | `apiLimiter` middleware on all `/api/v1/*` routes |
| Security headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS in production |

---

## 14. Environment Variables

### `server/.env`
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | AI Studio key |
| `GOOGLE_APPLICATION_CREDENTIALS` | One of these | Path to Firebase service account JSON |
| `FIREBASE_PROJECT_ID` | One of these | Project ID for ADC fallback |
| `PORT` | No | Defaults to 3000 |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (empty = permissive in dev) |

### `web/.env.local` and `extension/.env`
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_API_URL` | No | Backend URL (default: `http://localhost:3000`) |

---

## 15. Running Locally

```bash
# Install all workspaces
cd server && bun install
cd ../web && bun install
cd ../extension && bun install

# Fill in env files (see section 14)
# server/.env needs GEMINI_API_KEY + FIREBASE_PROJECT_ID at minimum

# Start all three in separate terminals
cd server && bun run dev        # Express API on :3000
cd web    && bun run dev        # Vite web app on :5173
cd extension && bun run dev     # Vite extension build (watch mode)

# Load extension in Chrome: chrome://extensions → Load unpacked → extension/dist/
```

---

## 16. CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

| Job | What it runs |
|-----|-------------|
| `ci-lint` | `bun run lint` (ESLint, `--max-warnings 0`) |
| `ci-test-server` | `bun run --cwd server test` (Vitest) |
| `ci-build-web-extension` | `bun run build` (web + extension Vite builds) |
| `ci-dependency-review` | `actions/dependency-review-action` (PR only) |
| `ci-required` | Gate job — PR is mergeable only if all above pass |

Firebase Hosting deploys preview URLs on each PR and production on merge to `main`.
