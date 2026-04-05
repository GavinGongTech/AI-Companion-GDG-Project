# Architecture -- AI Companion (Study Flow)

System architecture for the AI study companion. All components are implemented and functional.

---

## High-Level Overview

```
+-------------------+     +-------------------+
|  Chrome Extension  |     |     Web App        |
|  (MV3 Side Panel)  |     |  (React + Vite)    |
|                    |     |                    |
|  - Ask/Explain     |     |  - Landing page    |
|  - Quiz            |     |  - Auth (login/    |
|  - My Graph        |     |    signup)         |
|  - Auto-Ingest     |     |  - Dashboard       |
+---------+----------+     +---------+----------+
          |                          |
          |    Firebase ID Token     |
          +----------+---------------+
                     |
              +------v------+
              | Express API  |
              | (Node.js)    |
              | Port 3000    |
              +------+------+
                     |
         +-----------+-----------+
         |           |           |
   +-----v----+ +---v----+ +---v-----------+
   | Gemini   | |Firestore| |Cloud Vision  |
   | 2.0 Flash| |(NoSQL)  | |(OCR)         |
   +----------+ +--------+ +--------------+
```

---

## Component Responsibilities

### Chrome Extension (`extension/`)

| Component | File | Role |
|-----------|------|------|
| Background worker | `src/background.js` | Opens side panel, handles message passing from content script |
| Content script | `src/content.js` | Detects Brightspace/Gradescope pages, extracts text for auto-ingestion |
| Side panel app | `src/sidepanel/` | React app with auth gating, Ask/Quiz/Hub pages |
| Auth | `src/sidepanel/lib/` | `chrome.identity` -> Google OAuth -> Firebase credential |
| API client | `src/sidepanel/lib/api.js` | Fetch wrapper injecting Bearer token for all backend calls |

### Web App (`web/`)

| Component | File | Role |
|-----------|------|------|
| Auth context | `src/lib/auth.jsx` | `AuthProvider` wrapping app, `onAuthStateChanged` listener |
| Firebase init | `src/lib/firebase.js` | Client SDK config from `VITE_FIREBASE_*` env vars |
| API wrapper | `src/lib/api.js` | Auto-attaches Bearer token to every fetch |
| Protected routes | `src/components/ProtectedRoute.jsx` | Redirects unauthenticated users to /login |
| Landing page | `src/pages/Home.jsx` | Product overview, feature cards, install CTA |
| Dashboard | `src/pages/Dashboard.jsx` | SMG visualization, drill queue, session history |

### Backend (`server/`)

| Subsystem | Files | Role |
|-----------|-------|------|
| **Auth middleware** | `middleware/auth.js` | Verifies Firebase ID token on every protected route |
| **Analyze pipeline** | `routes/analyze.js` | RAG -> Gemini explain -> classifier -> save event -> SM-2 update |
| **Quiz engine** | `routes/quiz.js` | Generates MCQs weighted by weakness, records answers |
| **Ingestion** | `routes/ingest.js`, `services/ingestion.js` | File upload + text ingestion -> chunk -> embed -> Firestore |
| **RAG** | `services/rag.js` | Vector similarity search across course chunks |
| **SMG engine** | `services/misconception.js` | SM-2 algorithm, concept tracking, drill queue |
| **Gemini** | `services/gemini.js` | LLM calls for explain, classify, quiz generation |
| **Embeddings** | `services/embeddings.js` | text-embedding-004 for chunk and query vectors |
| **OCR** | `services/ocr.js` | Cloud Vision API for image/PDF text extraction |
| **Firestore helpers** | `services/firestore.js` | saveInteraction, ensureUserDoc |

---

## Data Flow: Explain (Ask) Mode

```
Student types question
        |
        v
Extension sends POST /api/v1/analyze
  { content: "Why does L'Hopital's rule work?", courseId: "MATH201" }
        |
        v
1. retrieveChunks(uid, courseId, question)
   - Embed question with text-embedding-004
   - Firestore findNearest (cosine similarity) on course chunks
   - Return top-5 matching chunks
        |
        v
2. explainConcept(question, ragContext, smgHistory)
   - Gemini 2.0 Flash generates structured JSON:
     { solution, mainConcept, relevantLecture, keyFormulas, personalizedCallout }
        |
        v
3. classifyConcept(question, solution)
   - Second Gemini call classifies interaction:
     { conceptNode: "lhopitals_rule", errorType: "knowledge_gap", confidence: 0.85 }
        |
        v
4. saveInteraction(uid, { courseId, content, eventType, response, classifierTag })
   - Writes to users/{uid}/events/{auto-id}
        |
        v
5. recordInteraction(uid, "lhopitals_rule", { errorType, confidence, courseId })
   - SM-2 algorithm updates users/{uid}/smg/lhopitals_rule:
     easeFactor, reviewIntervalDays, nextReviewDate, accuracyRate
        |
        v
Response returned to extension with all fields
```

---

## Data Flow: Quiz Mode

```
Student clicks "Generate question"
        |
        v
POST /api/v1/quiz { topic?: "integration", courseId?: "MATH201" }
        |
        v
1. If no topic: getWeakestConcepts(uid) picks from SM-2 due concepts
2. retrieveChunks for context
3. generateQuiz(topic, chunks, smgData, count)
   - Gemini generates MCQ with 4 options, correct answer, explanation
   - Difficulty auto-adjusted by student accuracy
        |
        v
Response: { question, options, answer, explanation, difficulty, conceptNode }
        |
        v
Student selects answer -> POST /api/v1/quiz/answer
  { conceptNode, selectedAnswer, correctAnswer, courseId }
        |
        v
recordInteraction updates SMG (SM-2):
  - Correct: ease factor increases, interval grows
  - Incorrect: interval resets to 1 day, ease factor decreases
```

---

## Data Flow: Ingestion

```
Option A: File Upload
  POST /api/v1/ingest/upload (multipart form)
    |
    v
  1. OCR if image/PDF (Cloud Vision API)
  2. chunkText(text) -> ~500 char overlapping chunks
  3. embedBatch(chunks) -> 768-dim vectors
  4. Batch write to Firestore: users/{uid}/courses/{courseId}/chunks/
  5. Upload to Gemini File API -> store URI in Firestore files subcollection

Option B: Content Script (Auto-Ingest)
  POST /api/v1/ingest/text
    { courseId, rawContent, sourcePlatform: "brightspace" }
    |
    v
  Same chunk -> embed -> store pipeline (steps 2-4 above)
```

---

## SM-2 Spaced Repetition Algorithm

The SM-2 algorithm (`services/misconception.js`) schedules concept review:

| Quality | Meaning | Effect on Interval |
|---------|---------|-------------------|
| 0-2 | Incorrect answer | Reset to 1 day |
| 3 | Hard correct / exposure | 1 -> 6 -> interval * easeFactor |
| 4 | Correct | Same growth |
| 5 | Easy (no error type) | Same growth, ease factor increases |

**Ease factor** adjusts: `EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))`, minimum 1.3.

**Drill queue urgency** = (overdue days * 2) + ((1 - accuracy) * 5). Higher = review first.

---

## Authentication

```
Extension:
  chrome.identity.getAuthToken() -> Google OAuth token
       -> GoogleAuthProvider.credential(null, token)
       -> signInWithCredential(auth, credential)
       -> Firebase ID token for API calls

Web App:
  signInWithPopup(auth, GoogleAuthProvider) -> Firebase ID token
  OR
  signInWithEmailAndPassword(auth, email, password) -> Firebase ID token

Backend:
  Authorization: Bearer <firebase-id-token>
       -> auth.verifyIdToken(token)
       -> req.user = { uid, email, name, ... }
```

---

## Security Model

- **Firestore access**: All data scoped to `users/{uid}/` -- users can only access their own data
- **Token verification**: Every API route uses `requireFirebaseAuth` middleware
- **No stored credentials**: Extension uses browser's existing Brightspace session, never stores passwords
- **Gemini File URIs**: Stored server-side in Firestore, never exposed to client
- **Input validation**: Content length limits on Express JSON parser (1MB)

---

## Environment Variables

### Backend (`server/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Gemini API key from AI Studio |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to Firebase service account JSON |
| `FIREBASE_PROJECT_ID` | Yes* | Firebase project ID (alternative to credentials file) |
| `PORT` | No | API port (default: 3000) |

*One of GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID is required.

### Web App (`web/.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_API_URL` | No | Backend URL (default: http://localhost:3000) |

### Extension (`extension/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Same as web app |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Same as web app |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Same as web app |
| `VITE_API_URL` | No | Backend URL (default: http://localhost:3000) |
