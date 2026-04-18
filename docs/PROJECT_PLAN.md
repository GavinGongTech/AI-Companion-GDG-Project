# [RENAME TBD] -- AI Study Companion: Full Project Plan

## Context

This is a **startup-track real product** being built by a **team of 4** over **1-2 months**. Chrome extension + web app + Node/Express backend targeting university math/STEM students.

**Core innovation:** A **Student Misconception Graph (SMG)** that classifies every interaction into a concept node and error type, then uses SM-2 spaced repetition to schedule targeted review. This directly counters the "cognitive debt" problem dominating education discourse in 2026.

**Why this matters now:** Fortune, NPR, and Inside Higher Ed all report in 2026 that AI tools are making students *worse* at thinking. Study Flow is designed as the antidote -- it forces active recall and tracks misconceptions rather than just giving answers.

### What WORKS Today

| Component | Status | Details |
|-----------|--------|---------|
| `POST /api/v1/analyze` | **Done** | Full pipeline: RAG retrieval -> Gemini explain -> classifier -> save event -> SM-2 update |
| `POST /api/v1/explain` | **Done** | RAG -> Gemini explanation (lighter: no SMG update) |
| `POST /api/v1/quiz` | **Done** | Picks from weakest concepts via SM-2, generates MCQs with Gemini |
| `POST /api/v1/quiz/answer` | **Done** | Records answer, updates SMG with SM-2 scheduling |
| `GET /api/v1/quiz/queue` | **Done** | Urgency-weighted drill queue |
| `POST /api/v1/ingest/upload` | **Done** | Multer file upload -> chunking -> embedding -> Gemini File API |
| `POST /api/v1/ingest/text` | **Done** | Raw text from content scripts -> chunk + embed |
| `GET /api/v1/graph` | **Done** | Full SMG for user |
| `GET /api/v1/graph/drill` | **Done** | Drill queue (duplicate of quiz/queue) |
| `GET /api/v1/graph/course/:courseId` | **Done** | Course-filtered SMG |
| `GET /api/v1/courses` | **Done** | List user's courses |
| `GET /api/v1/courses/:courseId` | **Done** | Course detail with ingested docs + chunk count |
| Firebase Auth middleware | **Done** | `requireFirebaseAuth` verifies ID tokens on all routes |
| RAG pipeline | **Done** | Firestore `findNearest` vector search + manual cosine fallback |
| Embeddings | **Done** | `text-embedding-004` (768-dim) via Gemini |
| SM-2 algorithm | **Done** | Full implementation in `misconception.js` with ease factor |
| Misconception classifier | **Done** | Gemini secondary call classifies conceptNode + errorType |
| OCR | **Done** | Cloud Vision: image, base64, PDF text extraction |
| Ingestion pipeline | **Done** | 500-char chunks, 50-char overlap, batch embed, Gemini File API |
| Web frontend (marketing) | **Done** | 5 pages, polished dark theme, CSS custom properties |
| Extension scaffold | **Done** | Manifest V3, side panel shell, Hub/Ask/Quiz page stubs |

### Newly Implemented Features (Gaps Closed)

| Component | Status | Details |
|-----------|--------|---------|
| Extension Ask page wiring | **Done** | State, fetch to `/analyze`, structured response rendering |
| Extension Quiz page wiring | **Done** | MCQ UI, answer submission, correct/incorrect feedback |
| Extension auth | **Done** | Firebase client SDK, `chrome.identity` Google SSO flow |
| Web auth | **Done** | Firebase client SDK, email/Google login to Dashboard |
| Content script | **Done** | Platform detection, extracting content |
| Floating widget | **Done** | Auto-ingest, action buttons |
| My Graph tab (extension) | **Done** | Progress bars, concept visualization |
| Web dashboard | **Done** | `/dashboard` route, graph viz, drill queue UI |
| KaTeX math rendering | **Done** | `MathRenderer` added to extension and web |
| Shared workspace | **Skipped** | Replicated API client instead of shared workspace |
| Auth stub routes | **Removed** | Dead code `/auth/register`, `/login` removed |
| `firestore.js:updateSMG()` | **Removed** | Superseded by `recordInteraction()` |
| PostgreSQL artifacts | **Removed** | PostgreSQL migrations, dependencies, and clients removed |
| README | **Fixed** | Corrupted UTF-16 encoding fixed, updated docs |

---

## Market Research (April 2026)

### Competitive Landscape

| Tool | Strengths | Weaknesses |
|------|-----------|------------|
| **NotebookLM** (Google) | Source-grounded AI, 50-100 sources, AI podcasts | No flashcards, no quizzes, no spaced repetition, no performance tracking |
| **StudyFetch** (market leader) | All-in-one (flashcards, quizzes, notes, tutor) | **Struggles with math/equations**, not STEM-focused |
| **CuFlow** | Auto-generates study materials, performance tracking, free | No LMS integration, no misconception-level tracking |
| **Anki** | Gold standard spaced repetition | Manual card creation, no AI, no course integration |
| **ChatGPT/Gemini** | Powerful reasoning | No memory across sessions, no spaced repetition, no course grounding |
| **Classology AI** | Chrome extension, LMS integration | Answer-giving (cognitive debt), no misconception tracking |

### Unfulfilled Market Gaps

1. **No tool combines course-grounded AI + spaced repetition + misconception tracking.**
2. **Math/STEM tutoring is weak.** StudyFetch can't handle equations well.
3. **"Cognitive debt" is the #1 education concern** -- AI tools making students worse at thinking.
4. **LMS auto-ingestion doesn't exist** in student tools. Every tool requires manual upload.
5. **No extension does misconception-aware quiz generation** weighted by individual weakness patterns.

### Our Unique Position

**The only tool that auto-ingests from LMS + tracks misconceptions + uses spaced repetition to close knowledge gaps.** Anti-cognitive-debt by design.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | **Firestore only** | Already working. Drop PostgreSQL artifacts. |
| Auth | **Google SSO + email/password** | SSO for frictionless onboarding, email as fallback |
| Gemini model | **gemini-3.1-pro-preview** | Best math reasoning for explain mode |
| Subject scope | **Math/STEM first, expand later** | Strong differentiator |
| LMS targets | **Brightspace + Gradescope** | Materials + error signals |
| Extension UX | **Floating widget + side panel** | Simplify Jobs pattern: auto-detect LMS pages, inject widget, auto-ingest |
| Widget behavior | **Auto-ingest silently, show Explain + Quiz** | No manual "save" step |
| SMG visualization | **Progress bars (extension) + network graph (dashboard)** | Quick glance + deep dive |
| Web dashboard | **Full dashboard** | SMG heatmap, drill queue, session history, streaks |
| Landing page | **Full redesign + anti-cognitive-debt positioning** | Differentiate from competitors |
| Design doc | **For development team** | Architecture decisions, data models, API contracts |
| Team split | **By workspace** | Person 1: web, Person 2: extension, Person 3: backend, Person 4: AI/docs |
| Branding | **Rename TBD** | "Study Flow" is generic |

---

## Architecture Reference

### A1. Firestore Data Model

```
users/{uid}
  Fields: email, displayName, createdAt (server timestamp)
  Created by: ensureUserDoc() in firestore.js

users/{uid}/events/{auto-id}
  Fields:
    courseId: string | null
    eventType: "explain" | "quiz_generated" | "quiz_answer"
    content: string (original question/topic)
    response: object (Gemini response or quiz answer details)
    classifierTag: { conceptNode, errorType, confidence }
    createdAt: server timestamp
  Created by: saveInteraction() in firestore.js

users/{uid}/smg/{conceptNode}
  Document ID = concept identifier (e.g., "derivatives_chain_rule")
  Fields:
    accuracyRate: number (0-1, correctCount / total answered)
    correctCount: number
    incorrectCount: number
    interactionCount: number
    easeFactor: number (starts 2.5, min 1.3 -- SM-2 parameter)
    reviewIntervalDays: number (1-365)
    nextReviewDate: Date
    errorTypeMap: { conceptual_misunderstanding: 3, procedural_error: 1, ... }
    lastErrorAt: Timestamp | null
    lastInteractionAt: Timestamp
    courseId: string | null
  Updated by: recordInteraction() in misconception.js

users/{uid}/courses/{courseId}
  Fields: platform, lastIngestedAt
  users/{uid}/courses/{courseId}/files/{auto-id}
    Fields: geminiFileUri, filename, fileHash (SHA256), sourcePlatform, uploadedAt
  users/{uid}/courses/{courseId}/chunks/{auto-id}
    Fields:
      content: string (500-char chunk)
      embedding: FieldValue.vector([...768 floats...])
      metadata: { source, page?, week?, filename }
      chunkIndex: number
      createdAt: Timestamp
```

### A2. Complete API Contract

All routes require `Authorization: Bearer <firebase-id-token>` (enforced by `requireFirebaseAuth` middleware).

```
POST /api/v1/analyze
  Body: { courseId?: string, content?: string, imageBase64?: string }
  Flow: extract text (content or OCR) -> RAG chunks -> explainConcept() -> classifyConcept() -> save event -> recordInteraction()
  Response: { question, solution, mainConcept, relevantLecture, keyFormulas[], personalizedCallout, classifierTag: { conceptNode, errorType, confidence }, eventId }

POST /api/v1/explain
  Body: { question: string, courseId?: string }
  Flow: RAG chunks -> explainConcept() (no classifier, no SMG update)
  Response: { question, solution, mainConcept, relevantLecture, keyFormulas[], personalizedCallout }

POST /api/v1/quiz
  Body: { topic?: string, courseId?: string, count?: number (default 1) }
  Flow: if no topic -> getWeakestConcepts() -> pick random; retrieve chunks -> generateQuiz() -> save event
  Response: { topic, courseId, question, options[4], answer (0-3), explanation, difficulty, conceptNode }

POST /api/v1/quiz/answer
  Body: { conceptNode: string, selectedAnswer: number, correctAnswer: number, courseId?: string }
  Flow: recordInteraction() with SM-2 -> save event
  Response: { isCorrect: boolean, eventId: string }

GET /api/v1/quiz/queue
  Response: { queue: [{ conceptNode, accuracyRate, urgency, interactionCount, nextReviewDate }] }

POST /api/v1/ingest/upload
  Body: multipart file + { courseId: string, sourcePlatform?: string }
  Flow: ensureUserDoc() -> ingestFile() (chunk + embed + Gemini File API)
  Response: { ok: true, filename, courseId }

POST /api/v1/ingest/text
  Body: { courseId: string, rawContent: string, sourcePlatform?: string, filename?: string }
  Flow: ensureUserDoc() -> ingestText() (chunk + embed)
  Response: { ok: true, courseId, ingestedAt }

GET /api/v1/graph
  Response: { nodes: [{ conceptNode, accuracyRate, errorTypeMap, nextReviewDate, interactionCount, ... }] }

GET /api/v1/graph/drill
  Response: { queue: [{ conceptNode, accuracyRate, nextReviewDate, interactionCount, urgency }] }
  Urgency formula: overdueDays * 2 + (1 - accuracyRate) * 5

GET /api/v1/graph/course/:courseId
  Response: { nodes: [...] } (filtered by courseId)

GET /api/v1/courses
  Response: { courses: [...] }

GET /api/v1/courses/:courseId
  Response: { course doc + ingestedDocs[] + chunkCount }
```

**Missing endpoint needed for dashboard:**
```
GET /api/v1/events?limit=50&offset=0  (NEW -- session history)
  Query: users/{uid}/events ordered by createdAt desc, paginated
  Response: { events: [{ eventId, eventType, content, classifierTag, createdAt }] }
```

### A3. SM-2 Spaced Repetition Algorithm

**Location:** `server/src/services/misconception.js` -- `sm2()` function

```
Inputs:
  prevInterval: number (days, 0 on first call)
  prevEaseFactor: number (2.5 initially, min 1.3)
  quality: number (0-5)

Algorithm:
  easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  easeFactor = max(1.3, easeFactor)

  if quality < 3:  interval = 1         (reset on failure)
  elif prevInterval == 0: interval = 1  (first review)
  elif prevInterval == 1: interval = 6  (second review)
  else: interval = round(prevInterval * easeFactor)

  return { interval: min(interval, 365), easeFactor }

Quality score mapping (toQuality function):
  Wrong + high confidence (>0.8): quality = 0 (worst)
  Wrong + medium confidence (>0.5): quality = 1
  Wrong + low confidence: quality = 2
  Correct + errorType == "none": quality = 5 (easiest)
  Correct + high confidence (>0.7): quality = 3 (hard correct)
  Correct + low confidence: quality = 4 (standard correct)
  Explain mode (no isCorrect): quality = 3 (neutral exposure)
```

### A4. Gemini Prompt Templates

**Location:** `server/src/services/gemini.js`

**Current model:** `gemini-2.0-flash` (to be changed to `gemini-3.1-pro-preview`)
**Temperature:** 0.4 (explain/classify), 0.7 (quiz generation)
**Response format:** `application/json`

**explainConcept(question, context, smgHistory?)**
```
You are an AI study companion. A student asked the following question.
Use the course material context below to give a clear, detailed explanation.

COURSE MATERIAL CONTEXT:
${context || "No course materials available — use your general knowledge."}
${smgSection -- if smgHistory provided: includes accuracyRate %, interactionCount, top 3 error types}

STUDENT QUESTION: ${question}

Respond with ONLY a JSON object:
{ "solution", "mainConcept", "relevantLecture", "keyFormulas": [], "personalizedCallout" }
```

**generateQuiz(topic, chunks, smgData?, count?)**
```
You are an AI study companion generating quiz questions styled like a professor's exam.
TOPIC: ${topic}
COURSE MATERIAL: ${material}
${smgSection -- difficulty hint from accuracyRate: <0.3=easy, 0.3-0.6=medium, >0.6=hard; includes top 3 error types}

Generate exactly ${count} multiple-choice question(s) (4 options each, exactly one correct).
Respond with ONLY a JSON object:
{ "questions": [{ "question", "options": [4], "answer": 0-3, "explanation", "difficulty", "conceptNode" }] }
```

**classifyConcept(question, answer)**
```
You are a misconception classifier for a student study tool.
STUDENT QUESTION: ${question}
AI ANSWER: ${answer}

Classify this interaction. conceptNode should be snake_case, specific enough to track
(e.g. "derivatives_chain_rule", not just "math").
Respond with ONLY: { "conceptNode", "errorType": "conceptual_misunderstanding|procedural_error|knowledge_gap|reasoning_error|none", "confidence": 0-1 }
```

### A5. Misconception Error Type Taxonomy

| Error Type | Description | Example |
|-----------|-------------|---------|
| `conceptual_misunderstanding` | False or incomplete mental model | "Derivatives find area under curve" |
| `procedural_error` | Wrong steps or algorithm execution | Forgetting to apply chain rule |
| `knowledge_gap` | Missing prerequisite knowledge | Not knowing trig identities |
| `reasoning_error` | Flawed logic or assumption | "If f'(a)=0, then f has a max at a" |
| `none` | No error (correct understanding) | Correct quiz answer |

---

## Implementation Plan

### Phase 0: Foundation (Week 1)

**Goal:** Clean house, align the team, make everything buildable.

#### 0.1 Fix README
**Owner:** Person 1 (Web) | **File:** `README.md`

Delete the UTF-16 corrupted file and rewrite. Key content:

```markdown
# Study Flow AI

**The AI study companion that remembers your mistakes.**

Chrome extension + web dashboard + Node/Express backend. Automatically ingests
course materials from Brightspace and Gradescope, builds a persistent Student
Misconception Graph (SMG) with SM-2 spaced repetition, and generates
professor-style practice problems weighted toward your weakest concepts.

## Architecture
[ASCII diagram: Extension + Web -> Express API -> Gemini + Firestore]

## Quick Start
1. git clone && npm install
2. cp server/.env.example server/.env (fill GEMINI_API_KEY, FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS)
3. npm run dev:all (starts server on :3000, web on :5173, extension watch build)
4. Load extension: chrome://extensions -> Developer mode -> Load unpacked -> extension/dist

## Feature Status
[Table from "Corrected Implementation Status" section above]

## Project Structure
[Monorepo tree: web/, extension/, server/, docs/]

## Data Model (Firestore)
[Summary from A1 above]

## Environment Variables
Server: GEMINI_API_KEY (required), FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS, PORT
Web: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_API_URL
Extension: VITE_API_URL

## License
Private -- GDG Build Sprint 2026.
```

#### 0.2 Consolidate Design Doc
**Owner:** Person 4 (AI/Docs) | **Files:** `docs/DESIGN.md` (new), archive old docs

Create single `docs/DESIGN.md` structured for the dev team:
- Product vision + market positioning (preserve Design Doc v3's excellent SMG/classifier/ingestion descriptions)
- Architecture: Express + Firestore (not Cloud Functions, not PostgreSQL). Document WHY: simpler debugging, no cold starts, single process for 4-person team
- Data models (Firestore paths from section A1)
- API contract (from section A2)
- Extension UX spec (floating widget + side panel)
- Misconception taxonomy (from section A5)
- SM-2 algorithm reference (from section A3)

Archive: `AI_Companion_Design_Doc_v3.md` -> `docs/_archive_design_doc_v3.md`
Delete: `docs/ARCHITECTURE.md` (describes PostgreSQL system that was never built)

#### 0.3 Remove Dead Code
**Owner:** Person 3 (Backend)

**PostgreSQL artifacts:**
- Delete `server/src/db/client.js` (exports `pool = null`)
- Delete `server/src/db/migrations/001_init.sql`
- Delete `docker-compose.yml`
- Remove `pg` from `server/package.json`
- Remove `DATABASE_URL` from `server/.env.example`

**Duplicate SMG logic:**
- Delete `updateSMG()` from `server/src/services/firestore.js` (never called; `misconception.js:recordInteraction()` is the authoritative implementation)

**Dead auth routes:**
- Delete or gut `server/src/routes/auth.js` (returns 501; Firebase handles auth client-side)
- Remove `bcryptjs` and `jsonwebtoken` from `server/package.json` (unused)
- Remove `requireAuth` stub from `server/src/middleware/auth.js`

#### 0.4 Migrate Gemini SDK
**Owner:** Person 3 (Backend)

**Files:** `server/src/services/gemini.js`, `embeddings.js`, `ingestion.js`, `server/package.json`

Replace `@google/generative-ai` with `@google/genai`:
```js
// Old
import { GoogleGenerativeAI } from "@google/generative-ai"
const genai = new GoogleGenerativeAI(apiKey)
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })
const result = await model.generateContent({ contents: [{ parts: [{ text }] }] })
const text = result.response.text()

// New
import { GoogleGenAI } from "@google/genai"
const ai = new GoogleGenAI({ apiKey })
const response = await ai.models.generateContent({ model: "gemini-3.1-pro-preview", contents: prompt, config: { responseMimeType: "application/json", temperature: 0.4 } })
```

**CRITICAL:** Web-search `gemini-3.1-pro-preview` to confirm model name before changing. Training cutoff predates Gemini 3.x.

Add JSON parse error handling with retry (currently raw `JSON.parse(result.response.text())` with no try/catch):
```js
function parseGeminiJSON(text, retryFn, maxRetries = 1) {
  try { return JSON.parse(text) }
  catch (e) {
    if (maxRetries > 0) return retryFn() // retry the Gemini call
    throw new Error("Gemini returned malformed JSON")
  }
}
```

#### 0.5 Fix TypeScript Confusion
**Owner:** Person 1 (Web)

**Files:** All `.jsx` -> `.tsx`, add `tsconfig.json` to web/ and extension/

Current `.jsx` files use TypeScript syntax (`import type { FormEvent }`, non-null assertion `!` on `getElementById`) but there's no `tsconfig.json`. This works in Vite (esbuild strips types) but provides no type checking and confuses contributors.

Decision: Rename to `.tsx` + add minimal `tsconfig.json` (Vite handles compilation, tsconfig just enables IDE checking).

#### 0.6 Create Shared Workspace
**Owner:** Person 1 (Web) + Person 2 (Extension)

**New files:**
- `shared/package.json` (workspace package)
- `shared/api-client.ts` -- fetch wrapper with auth token injection
- `shared/firebase-config.ts` -- Firebase client SDK initialization (shared config)

Add `"shared"` to root `package.json` workspaces array.

**`shared/api-client.ts`:**
```ts
const API_URL = typeof import.meta !== 'undefined' 
  ? import.meta.env.VITE_API_URL 
  : "http://localhost:3000"

export async function apiFetch(token: string, path: string, options: { method?: string, body?: any } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw { status: res.status, error: data.error || res.statusText }
  }
  return res.json()
}
```

#### 0.7 Narrow Extension Permissions
**Owner:** Person 2 (Extension) | **File:** `extension/public/manifest.json`

Current: content script matches `https://*/*` and `http://*/*` (every page). `host_permissions` includes `https://*/*`. Chrome Web Store will reject this.

Change content script `matches` to:
- `*://*.brightspace.com/*`
- `*://*.gradescope.com/*`
- `*://brightspace.*.edu/*` (covers `brightspace.nyu.edu` etc.)

Change `host_permissions` to:
- `http://localhost:3000/*` (dev)
- The production API URL

Add `"identity"` to permissions (needed for chrome.identity SSO).
Add `"alarms"` to permissions (needed for token refresh).
Add `oauth2` section with Chrome extension OAuth client ID.

---

### Phase 1: Core Loop (Weeks 2-3)

**Goal:** A student can sign in, ask a question, take a quiz, and see their misconceptions tracked.

#### 1.1 Firebase Auth -- Web App
**Owner:** Person 1 (Web)

**New files:**
- `web/src/lib/firebase.ts` -- Firebase client SDK init
- `web/src/lib/auth.tsx` -- AuthProvider context (user, token, loading, signOut)
- `web/src/lib/api.ts` -- `useApi()` hook wrapping shared api-client with token from context
- `web/.env.example` -- add `VITE_FIREBASE_*` variables

**New dependency:** `firebase` in `web/package.json`

**AuthProvider pattern:**
- `onAuthStateChanged` listener sets user + token state
- Token auto-refresh every 50 minutes (Firebase tokens expire at 60 min)
- `ProtectedRoute` component redirects to /login if !user

**Login.tsx rewrite:**
- "Sign in with Google" button: `signInWithPopup(auth, GoogleAuthProvider)`
- Email/password form: `signInWithEmailAndPassword(auth, email, password)`
- On success: navigate to `/dashboard` (not `/welcome`)
- Error display for auth failures

**SignUp.tsx rewrite:**
- "Sign up with Google" button (same as login, Firebase creates account on first SSO)
- Email/password form: `createUserWithEmailAndPassword(auth, email, password)` + `updateProfile(user, { displayName })`
- On success: navigate to `/dashboard`

**Wrap app in `main.tsx`:**
```jsx
<AuthProvider>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</AuthProvider>
```

#### 1.2 Firebase Auth -- Extension
**Owner:** Person 2 (Extension)

**Flow:** Chrome extensions can't use `signInWithPopup`. Use `chrome.identity` API instead:

1. `chrome.identity.getAuthToken({ interactive: true })` -> Google OAuth token
2. `GoogleAuthProvider.credential(null, oauthToken)` -> Firebase credential
3. `signInWithCredential(auth, credential)` -> Firebase user
4. `user.getIdToken()` -> Firebase ID token
5. Store in `chrome.storage.session`: `{ firebaseToken, firebaseUid, tokenExpiry }`

**Token refresh:** `chrome.alarms.create("token-refresh", { periodInMinutes: 50 })` -- background worker re-authenticates and refreshes token before 60-min expiry.

**Auth-gated UI:** In `App.tsx`, check `chrome.storage.session` for token on mount. If no token, show `<SignIn />` component. If token present, show the normal Shell with routes.

**File changes:**
- `extension/src/background.js` -- add message listeners for GET_AUTH_TOKEN, INGEST_PAGE, OPEN_SIDE_PANEL; add alarm handler for token refresh
- `extension/src/sidepanel/App.tsx` -- add auth state check, conditionally render SignIn or Shell
- `extension/src/sidepanel/components/SignIn.tsx` (new) -- Google SSO button
- `extension/src/sidepanel/api.ts` (new) -- fetch wrapper reading token from `chrome.storage.session`

#### 1.3 Wire Extension Ask Page
**Owner:** Person 2 (Extension) | **File:** `extension/src/sidepanel/pages/Ask.tsx`

**State hooks:**
```ts
const [question, setQuestion] = useState("")
const [courseId, setCourseId] = useState<string | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [response, setResponse] = useState<ExplainResponse | null>(null)
```

**Context pre-fill:** `useEffect` listening for `chrome.runtime.onMessage` with type `PREFILL_CONTEXT` from the floating widget. Sets question and courseId.

**Submit flow:**
1. `setLoading(true)`, clear error and response
2. `POST /api/v1/analyze` with `{ courseId, content: question }` (uses `/analyze` not `/explain` to get SMG tracking)
3. On success: `setResponse(data)`
4. On error: `setError(err.error)`
5. `setLoading(false)`

**Response rendering (structured cards):**
- **Solution card**: `<MathRenderer content={response.solution} />` (KaTeX for LaTeX)
- **Concept badge**: Pill showing `response.mainConcept` from classifier
- **Key formulas**: List of `<MathRenderer>` items
- **Relevant material**: `response.relevantLecture`
- **Personalized callout**: If `response.personalizedCallout` exists, highlight card with accent border

**MathRenderer component** (new: `extension/src/sidepanel/components/MathRenderer.tsx`):
- Splits content on `$...$` (inline) and `$$...$$` (display) delimiters
- Renders LaTeX segments via `katex.renderToString(tex, { throwOnError: false })`
- Renders plain text segments as-is
- Output via `dangerouslySetInnerHTML` (safe: input is from our API, not user)

**New dependency:** `katex` in `extension/package.json`

#### 1.4 Wire Extension Quiz Page
**Owner:** Person 2 (Extension) | **File:** `extension/src/sidepanel/pages/Quiz.tsx`

**State machine (5 phases):**
```ts
const [phase, setPhase] = useState<"idle" | "loading" | "question" | "answered" | "error">("idle")
const [topic, setTopic] = useState("")
const [courseId, setCourseId] = useState<string | null>(null)
const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null)
const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
const [score, setScore] = useState({ correct: 0, total: 0 })
const [weakConcepts, setWeakConcepts] = useState<DrillItem[]>([])
const [error, setError] = useState<string | null>(null)
```

**On mount:** Fetch `GET /api/v1/quiz/queue` -> populate `weakConcepts` as clickable topic chips showing `conceptNode` name + accuracy %.

**Generate flow:**
1. Set phase="loading"
2. `POST /api/v1/quiz` with `{ topic, courseId }`
3. Set `currentQuestion`, phase="question"

**Answer flow:**
1. User selects radio button (0-3) -> `setSelectedAnswer(i)`
2. "Submit" button: compute `isCorrect = selectedAnswer === currentQuestion.answer`
3. Update local score, set phase="answered"
4. Fire-and-forget: `POST /api/v1/quiz/answer` with `{ conceptNode, selectedAnswer, correctAnswer, courseId }` -> SM-2 update happens server-side
5. Show correct/incorrect state on options (green/red borders)
6. Show explanation card with `<MathRenderer>`
7. "Next question" button -> re-runs generate flow

**Context pre-fill from widget:** Listen for `PREFILL_CONTEXT` with `action: "quiz"`, auto-set topic and generate.

#### 1.5 Add Events Endpoint
**Owner:** Person 3 (Backend) | **File:** `server/src/routes/graph.js` (or new `events.js`)

```
GET /api/v1/events?limit=50&offset=0
  Auth: requireFirebaseAuth
  Query: users/{uid}/events ordered by createdAt desc, paginated
  Response: { events: [{ eventId, eventType, content, classifierTag, createdAt }], hasMore: boolean }
```

Needed for the web dashboard's session history view.

---

### Phase 2: Differentiation (Weeks 3-4)

**Goal:** The features that make this product unique -- floating widget, auto-ingestion, misconception visualization.

#### 2.1 Floating Widget on Brightspace/Gradescope
**Owner:** Person 2 (Extension) | **Files:** `extension/src/content.js` (major rewrite), `extension/src/widget.css` (new)

**Platform detection (top of content.js):**
```js
const PLATFORMS = {
  brightspace: {
    hostPattern: /brightspace\.\w+\.edu/,
    contentRoutes: [
      /\/d2l\/le\/content\/\d+\/Home/,
      /\/d2l\/le\/content\/\d+\/viewContent\/\d+/,
      /\/d2l\/le\/lessons\/\d+/
    ],
    extractCourseId: (url) => url.match(/\/content\/(\d+)\//)?.[1] || url.match(/\/lessons\/(\d+)/)?.[1]
  },
  gradescope: {
    hostPattern: /gradescope\.com/,
    contentRoutes: [
      /\/courses\/\d+\/assignments\/\d+\/submissions\/\d+/,
      /\/courses\/\d+\/assignments\/\d+\/review/
    ],
    extractCourseId: (url) => url.match(/\/courses\/(\d+)/)?.[1]
  }
}
```

**DOM extraction selectors:**

Brightspace:
- Content area: `.d2l-page-main` or `#ContentView` or `.d2l-le-content`
- Lesson body: `.d2l-html-block-rendered`
- Title: `.d2l-page-title` or `h1.d2l-heading`
- PDF links: `a[href*=".pdf"]` within content area

Gradescope:
- Rubric deductions: `.rubricItem--selected` or `.rubric-item` elements
- Each rubric item: `.rubric-item-description` (text), `.rubric-item-points` (score)
- Assignment title: `.submissionOutline--submissionTitle` or `h1`
- Total score: `.score` or `.submissionStatus--score`

**Widget structure (Shadow DOM to avoid style conflicts):**

```html
<study-flow-widget>
  #shadow-root
    <style>...widget CSS...</style>
    <div class="sf-container" data-state="collapsed|expanded|dismissed">
      <!-- Collapsed: floating pill (48x48px, accent color, bottom-right) -->
      <button class="sf-fab">[logo] <span class="sf-badge"></span></button>
      <!-- Expanded: action panel (260px wide) -->
      <div class="sf-panel">
        <div class="sf-panel-header">Study Flow | <span class="sf-ingest-status">Ingested ✓</span> | [x]</div>
        <div class="sf-panel-body">
          <button class="sf-action-explain">Explain this</button>
          <button class="sf-action-quiz">Quiz me on this</button>
        </div>
        <div class="sf-panel-footer"><span>CALC 101</span> | <button>Hide</button></div>
      </div>
    </div>
```

Widget CSS uses the existing design system: `#0d1118` bg, `#3ee0d0` accent, `#f2f5f9` text, 12px border-radius.

**Message passing architecture:**

```
Content Script -> Background:
  { type: "INGEST_PAGE", payload: { courseId, rawContent, sourcePlatform, pageUrl, pageTitle } }
  { type: "OPEN_SIDE_PANEL", payload: { action: "explain"|"quiz", context, courseId } }
  { type: "GRADESCOPE_ERRORS", payload: { courseId, deductions: [{ rubricText, points, conceptHint }] } }
  { type: "WIDGET_DISMISSED", payload: { hostname } }

Background -> Side Panel:
  { type: "PREFILL_CONTEXT", payload: { action, context, courseId } }

Background -> Content Script (response):
  { type: "INGEST_RESULT", payload: { ok, error? } }
  { type: "AUTH_STATE", payload: { isAuthenticated, token? } }
```

**Auto-ingest flow:**
1. Content script runs at `document_idle`
2. Detect platform from hostname + URL path
3. Check `chrome.storage.local` for `dismissedHosts` -- skip if dismissed
4. Check `chrome.storage.session` for auth -- if not authed, show FAB in "sign in required" state
5. Extract page text using platform-specific DOM selectors
6. Generate content hash (SHA-256 of first 500 chars + URL)
7. Check `chrome.storage.local` for `ingestedPages[hash]` -- skip if ingested within 24h
8. Send `INGEST_PAGE` message to background -> background calls `POST /api/v1/ingest/text`
9. Update widget status indicator (spinner -> checkmark)
10. Store hash + timestamp in `chrome.storage.local`

**Gradescope rubric parsing:**
- For returned assignments, extract rubric deductions
- Each deduction = high-confidence error signal (professor's rubric IS ground truth)
- Send `GRADESCOPE_ERRORS` to background -> background calls `POST /api/v1/quiz/answer` with `isCorrect: false` for each deduction, letting the classifier determine the concept node

**"Explain this" button:** Sends `OPEN_SIDE_PANEL` to background -> background calls `chrome.sidePanel.open()` then sends `PREFILL_CONTEXT` to side panel with the extracted page text as context.

**"Quiz me on this" button:** Same flow but with `action: "quiz"`.

#### 2.2 SMG Visualization -- Progress Bars (Extension)
**Owner:** Person 2 (Extension)

**New files:**
- `extension/src/sidepanel/pages/Graph.tsx`
- Update `extension/src/sidepanel/Shell.tsx` to add "My Graph" nav tab

**Data fetch:** `GET /api/v1/graph` -> returns all SMG nodes

**UI:** List of concepts, each as a horizontal bar:
- Label: concept name (humanized from snake_case: `derivatives_chain_rule` -> `Derivatives Chain Rule`)
- Accuracy bar: `width = accuracyRate * 100%`, colored red (0%) -> yellow (50%) -> green (100%)
- Right side: interaction count badge, "Review in X days" or "Due now" tag
- Sortable: by accuracy ascending (weakest first), by urgency, by interaction count
- Tap a concept -> "Quiz me on this" shortcut (navigates to /quiz with topic pre-filled)

Color mapping: `hsl(${accuracyRate * 120}, 70%, 50%)` gives red at 0, yellow at 0.5, green at 1.

#### 2.3 SMG Visualization -- Network Graph (Web Dashboard)
**Owner:** Person 1 (Web)

**New files:**
- `web/src/pages/Dashboard.tsx` -- main container with sidebar nav
- `web/src/pages/Dashboard.module.css` -- responsive grid layout
- `web/src/components/GraphView.tsx` -- cytoscape.js network graph
- `web/src/components/DrillQueue.tsx` -- urgency-ranked list
- `web/src/components/ProgressBars.tsx` -- sortable/filterable bars (same as extension but larger)
- `web/src/components/SessionHistory.tsx` -- recent activity feed from `GET /api/v1/events`
- `web/src/components/StudyStreak.tsx` -- streak counter + 30-day calendar heatmap

**New dependency:** `cytoscape` in `web/package.json`

**Graph library:** cytoscape.js (over vis.js and d3-force). Rationale: first-class node/edge data model, built-in layouts (cose for organic clustering), styling maps directly to data properties.

**Data -> visual mapping:**
```js
// Nodes from GET /api/v1/graph
{ id: conceptNode, label: conceptNode.replace(/_/g, " "),
  accuracy: accuracyRate, count: interactionCount,
  due: nextReviewDate <= now, courseId }

// Edges: concepts in the same course get connected
// Node size: mapData(count, 1, 50, 24, 64)
// Node color: mapData(accuracy, 0, 1, #f07178, #3ee0d0)  (red to green)
// Node border: 3px #f07178 if due, else 1px rgba(255,255,255,0.1)
// Layout: 'cose' (compound spring embedder)
```

**Interactivity:** Click node -> detail card (accuracy %, error type breakdown, next review, recent interactions). Double-click -> navigate to quiz for that concept.

**Dashboard layout:** CSS Grid: 240px sidebar + content area. Content area: 2-col grid with graph spanning full width, progress bars and drill queue side-by-side, session history and streak below.

**Data fetching:** REST polling every 30 seconds via the existing API endpoints. (Firestore real-time listeners would require adding the `firebase` client SDK at ~200KB -- defer this until needed.)

**Route:** Add to `web/src/App.tsx`: `<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />`

#### 2.4 Backend: Events Endpoint + Streak Calculation
**Owner:** Person 3 (Backend)

- `GET /api/v1/events` -- paginated session history (see 1.5 above)
- Add `streakDays` calculation: count consecutive days backward from today where at least one event exists. Could be computed on-the-fly from events query or stored/cached in user doc.

---

### Phase 3: Polish (Weeks 5-6) [DONE]

**Goal:** Landing page redesign, math rendering, error handling, testing.

#### 3.1 Landing Page Redesign [DONE]**Owner:** Person 1 (Web) + Person 4 (Design) | **Files:** `web/src/pages/Home.tsx` + all page CSS

**Full copy rewrite with anti-cognitive-debt positioning:**

Hero headline: **"Stop re-learning what you already forgot"**
Hero subtext: *"Study Flow is the only AI study tool that remembers your mistakes across sessions. It builds a persistent map of what you misunderstand, then uses spaced repetition to make sure those concepts resurface before your next exam -- not after."*
CTAs: "Add to Chrome -- free" | "Sign in to dashboard"
Meta chips: "Built on Google: Gemini AI + Firestore + Cloud Vision" | "Works with: Brightspace, Gradescope"

**Zero-setup panel:**
*"The extension activates the moment you open Brightspace or Gradescope. It silently ingests your course materials -- lecture notes, syllabi, returned assignments -- so when you ask a question, the answer is grounded in what your professor actually taught."*

**Feature cards (4):**
1. **Automatic course ingestion** -- "Opens Brightspace? Ingested. Opens Gradescope? Rubric deductions logged."
2. **Explanations from your actual course** -- "Step-by-step answer grounded in your professor's lectures -- not Wikipedia."
3. **Professor-style quizzes** -- "Practice problems weighted toward concepts you struggle with most, scheduled using SM-2."
4. **Student Misconception Graph** -- "A persistent model of your conceptual gaps. Tracks which topics, how often, and what type of error."

**Comparison section (NEW):**

| Feature | NotebookLM | StudyFetch | Anki | Study Flow |
|---------|-----------|-----------|------|-----------|
| Remembers mistakes across sessions | No | No | Manual only | Automatic (SMG) |
| Ingests from LMS | No | Upload only | No | Auto from Brightspace/Gradescope |
| Spaced repetition | No | No | Yes (manual) | Yes (automatic, SM-2) |
| Grounded in course materials | Upload docs | Upload docs | No | Auto-ingested |
| Works inside your LMS tab | No | Separate app | Separate app | Floating widget + side panel |

**CTA section:**
Heading: *"Your misconception graph starts now"*
"Install the extension, sign in with Google, and open any Brightspace course. Study Flow handles the rest."

**Fix outdated references:** Remove all mentions of PostgreSQL, pgvector, JWT sessions, OAuth toward Canvas. Replace with Firestore, Firebase Auth, Gemini.

#### 3.2 KaTeX Math Rendering
**Owner:** Person 2 (Extension) + Person 1 (Web)

Already specified in 1.3 for extension. Replicate `MathRenderer` component in web app for dashboard (quiz history display). Import `katex/dist/katex.min.css`.

#### 3.3 Frontend Error Handling
**Owner:** Person 1 (Web) + Person 2 (Extension)

- Error boundaries around route components (React `ErrorBoundary`)
- Loading skeletons for all API-fetching components
- Toast/banner for network errors (non-blocking)
- 401 handling: auto-redirect to sign-in flow
- Offline detection: show "You're offline" banner

#### 3.4 Backend Hardening
**Owner:** Person 3 (Backend)

- **Input validation:** Add `zod` for request body validation on all POST routes
- **Rate limiting:** 30 req/min per user (use `express-rate-limit` keyed by `req.user.uid`)
- **Gemini JSON resilience:** Try/catch with retry (see 0.4 above)
- **Request logging:** Log method, path, uid, response time
- **Health check:** Expand `/health` to include Firestore connectivity check

#### 3.5 Tests + CI/CD
**Owner:** Person 4 (AI/Docs)

**Unit tests (server/tests/):**
- SM-2 algorithm: test `sm2()` with various quality scores, verify intervals and ease factors
- `toQuality()` mapping: test all branches (correct/incorrect, confidence levels)
- `chunkText()`: verify 500-char chunks with 50-char overlap and sentence boundary detection
- Gemini prompt JSON parsing: mock responses, verify parse + fallback behavior

**Integration tests:**
- API routes with mocked Firestore and Gemini services
- Auth middleware with valid/invalid/missing tokens

**CI (`.github/workflows/ci.yml`):**
- On PR: `npm install`, lint all workspaces, run server tests
- On merge to main: build web + extension, deploy server to Railway/Render

---

### Phase 4: Growth (Weeks 7-8, if time permits)

- Multi-course support (course picker dropdown, scoped SMG views)
- Chat mode (multi-turn conversation UI in side panel, session persistence)
- Gradescope rubric auto-parsing refinement (extract specific deductions as concept-level error signals)
- Context menu: right-click selected text -> "Explain with [Product]"
- Study session scheduling: push notification "You should review derivatives in 2 days"
- Mobile-responsive web dashboard
- PDF annotation: highlight lecture PDFs with misconception-tagged sections

---

## Team Assignment

| Person | Workspace | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|--------|-----------|---------|---------|---------|---------|
| **Person 1** | Web | README, TS setup, shared workspace | Auth (web), Login/SignUp rewrite | Dashboard + cytoscape graph | Landing page redesign, error handling |
| **Person 2** | Extension | Manifest permissions | Auth (ext), Ask wiring, Quiz wiring, KaTeX | Floating widget, content script, progress bars | KaTeX (web), error handling |
| **Person 3** | Backend | Remove dead code, Gemini SDK migration | Events endpoint | Streak calculation | Zod validation, rate limiting, hardening |
| **Person 4** | AI/Docs | Design doc consolidation | Prompt engineering (tune explain/quiz/classify for math) | Brightspace/Gradescope DOM extraction research | Tests + CI/CD |

---

## Naming Brainstorm

"Study Flow" is generic. Directions to discuss with team:
- **Misconception-focused**: BlindSpot, GapTrack, KnowGap, MisMap
- **Graph/network-focused**: ConceptWeb, NodeLearn, Synapse
- **Anti-cognitive-debt**: ThinkDeep, CortexAI
- **Math-specific**: StepWise, ProofPath, MathMind
- **Memorable**: Synapse, Dendrite, Axon

---

## Verification Plan

### Phase 0
1. `npm install` from clean clone succeeds
2. `npm run dev:all` starts all three services without errors
3. README renders correctly on GitHub (no encoding issues)
4. Design doc is a single coherent document at `docs/DESIGN.md`
5. No PostgreSQL references remain in active code (`grep -r "pg\|postgres\|DATABASE_URL" server/src/` returns nothing)
6. `server/src/services/gemini.js` imports from `@google/genai`, model is `gemini-3.1-pro-preview`

### Phase 1
7. Sign in with Google on web app -> token persists across refresh, redirects to /dashboard
8. Sign in with Google in extension -> token in `chrome.storage.session`, side panel shows Hub
9. Extension Ask: type "What is the chain rule?" -> get structured response with solution card, concept badge, key formulas (LaTeX rendered via KaTeX)
10. Extension Quiz: "Generate question" -> MCQ with 4 options -> select answer -> green/red feedback + explanation -> score updates
11. `GET /api/v1/graph` returns user's SMG data after ask/quiz interactions
12. Quiz answers update SMG: verify in Firestore console that `smg/{conceptNode}` document has updated `reviewIntervalDays`, `easeFactor`, `nextReviewDate`

### Phase 2
13. Visit a Brightspace lecture page -> floating widget appears (bottom-right pill)
14. Widget shows "Ingested" status -> verify in Firestore that `courses/{id}/chunks/` has new documents
15. Click "Explain this page" -> side panel opens with pre-filled question from page content
16. Visit Gradescope returned assignment -> widget parses rubric deductions -> SMG updated with error signals
17. Extension "My Graph" tab: shows progress bars for all concepts, sorted by weakness, color-coded red/yellow/green
18. Web dashboard `/dashboard`: interactive network graph renders with nodes colored by accuracy, drill queue list populated, session history shows recent events

### Phase 3
19. Landing page loads with new copy: "Stop re-learning what you already forgot", comparison table, anti-cognitive-debt messaging
20. All math expressions render correctly via KaTeX in explain/quiz responses
21. Invalid API requests (missing fields, bad types) return proper 400 error with zod validation messages
22. Rate limiting: >30 requests/min from same user returns 429
23. `npm test` passes all unit tests (SM-2, chunking, quality mapping)
24. GitHub Actions CI pipeline passes on PR

---

## Sources (from market research)

- [Best AI tools for students 2026](https://monday.com/blog/ai-agents/best-ai-tools-for-students/)
- [12 Best AI Study Tools 2026](https://mystudylife.com/the-12-best-ai-study-tools-students-are-using-in-2026-and-how-they-actually-help-you-learn-faster/)
- [NotebookLM vs StudyFetch Comparison](https://www.cuflow.ai/blog/best-google-notebooklm-alternatives)
- [StudyFetch Alternatives 2026](https://www.cramberry.study/blog/studyfetch-alternatives-2026/)
- [AI Chatbots and Cognitive Debt](https://www.edweek.org/technology/ai-chatbots-tend-toward-flattery-why-thats-bad-for-students/2026/03)
- [Students Can't Reason - Fortune](https://fortune.com/2026/02/24/students-cant-reason-teachers-warn-ai-fueling-crisis-in-kids-ability-to-think/)
- [AI in Schools Risks - NPR](https://www.npr.org/2026/01/14/nx-s1-5674741/ai-schools-education)
- [Spaced Repetition + AI Research](https://journals.zeuspress.org/index.php/IJASSR/article/view/425)
- [Simplify Copilot Review](https://jobright.ai/blog/simplify-copilot-review-2026-features-pricing-and-top-alternatives/)
- [How Students Use AI to Study 2026](https://www.cuflow.ai/blog/how-students-use-ai-to-study-2026)
- [Best README Practices](https://www.makeareadme.com/))