# AI Companion (Study Flow)

A Chrome extension + web app that gives university math/STEM students **contextual study help grounded in their actual course materials**. Instead of generic AI answers that reset every session, Study Flow builds a persistent model of what each student misunderstands and uses spaced repetition to fix it.

---

## Why This Exists

Students juggle search tabs, calculators, ChatGPT, and Anki -- none of which know what their professor actually taught. Study Flow solves three problems:

1. **Context loss** -- AI tools don't know your syllabus. Study Flow auto-ingests your Brightspace/Gradescope materials so every answer is grounded in what your professor actually covered.
2. **Cognitive debt** -- Students re-learn the same concepts because nothing tracks what they misunderstand. The Student Misconception Graph (SMG) classifies every interaction and uses SM-2 spaced repetition to schedule targeted review.
3. **Workflow disruption** -- Switching to a separate study tool breaks focus. The Chrome extension side panel keeps help one click away without leaving the page.

---

## Who Is This For

- **University students** taking math, CS, or STEM courses that use Brightspace or Gradescope
- **Self-directed learners** who want structured review instead of generic AI chat
- **Study groups** where members can compare misconception patterns (future feature)

---

## What It Does

### Chrome Extension (Side Panel)

| Feature | What It Does | How It Works |
|---------|-------------|--------------|
| **Ask / Explain** | Type or paste a problem, get a structured explanation | RAG retrieves relevant chunks from your ingested course materials, Gemini generates a step-by-step solution with concept identification and key formulas |
| **Quiz** | Generate professor-style practice questions | SM-2 algorithm picks your weakest concepts, Gemini creates MCQs grounded in your course material, answers update your misconception graph |
| **My Graph** | See your concept mastery at a glance | Progress bars colored red/yellow/green by accuracy, sorted by weakness and review urgency |
| **Auto-Ingestion** | Course materials sync automatically | Content script detects Brightspace/Gradescope pages, extracts text, chunks and embeds it into Firestore |

### Web App (Dashboard)

| Feature | What It Does |
|---------|-------------|
| **Landing page** | Product overview, feature highlights, install CTA |
| **Sign up / Log in** | Firebase Auth with Google SSO or email/password |
| **Dashboard** | Network graph of concepts, drill queue, session history |

### Backend (Express API)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/analyze` | Full pipeline: RAG + Gemini explain + classifier + SMG update |
| `POST /api/v1/explain` | Lightweight explain (no SMG update) |
| `POST /api/v1/quiz` | Generate quiz questions weighted by weak concepts |
| `POST /api/v1/quiz/answer` | Submit answer, update SMG via SM-2 |
| `GET /api/v1/quiz/queue` | Spaced repetition drill queue |
| `POST /api/v1/ingest/upload` | Upload and ingest a file (PDF, image, text) |
| `POST /api/v1/ingest/text` | Ingest raw text from content script |
| `GET /api/v1/graph` | Full misconception graph for the user |
| `GET /api/v1/graph/drill` | Drill queue ranked by urgency |
| `GET /api/v1/graph/course/:id` | Graph filtered by course |
| `GET /api/v1/courses` | List ingested courses |
| `GET /api/v1/courses/:id` | Course details + ingested files + chunk count |
| `GET /api/v1/events` | Paginated interaction history |

---

## How It Works (Architecture)

```
Chrome Extension                 Web App
     |                              |
     |  Firebase Auth (Google SSO)  |
     +----------+------------------+
                |
          Bearer Token
                |
        Express API Server
        (Node.js, port 3000)
                |
     +----------+----------+
     |          |          |
  Gemini    Firestore   Cloud Vision
  (LLM)    (Database)     (OCR)
```

### The AI Pipeline (Analyze Flow)

1. Student types a question in the extension
2. **RAG retrieval**: question is embedded, top-5 matching course chunks are retrieved from Firestore
3. **Gemini explain**: chunks + question go to Gemini, which returns a structured JSON response (solution, main concept, key formulas, personalized callout)
4. **Classifier**: a second Gemini call classifies the interaction into a concept node + error type (conceptual misunderstanding, procedural error, knowledge gap, reasoning error)
5. **SMG update**: the SM-2 algorithm updates the concept's ease factor, review interval, and next review date
6. **Event log**: the full interaction is saved to Firestore for session history

### The Student Misconception Graph (SMG)

Each student has a collection of concept nodes at `users/{uid}/smg/{conceptNode}`. Each node tracks:

- **accuracyRate** -- running correct/incorrect ratio
- **errorTypeMap** -- frequency of each error type (e.g., `{ "procedural_error": 3, "knowledge_gap": 1 }`)
- **easeFactor** -- SM-2 ease factor (starts at 2.5, min 1.3)
- **reviewIntervalDays** -- days until next review (grows on correct, resets on incorrect)
- **nextReviewDate** -- when this concept should be reviewed
- **interactionCount** -- total times this concept has appeared

The drill queue ranks concepts by urgency = (overdue days * 2) + ((1 - accuracy) * 5).

### Course Ingestion

Materials are ingested two ways:

1. **File upload** (`POST /ingest/upload`): PDF, image, or text file -> OCR if needed -> chunk into ~500-char overlapping segments -> batch embed with Gemini text-embedding-004 -> store chunks with vectors in Firestore -> also upload to Gemini File API for direct file context
2. **Content script** (`POST /ingest/text`): extension detects Brightspace/Gradescope pages -> extracts page text -> sends to backend -> same chunk/embed pipeline

Chunks are stored at `users/{uid}/courses/{courseId}/chunks/{auto-id}` with vector embeddings for cosine similarity search.

---

## Data Model (Firestore)

```
users/{uid}
  ├── email, displayName, createdAt
  │
  ├── courses/{courseId}
  │   ├── platform, lastIngestedAt
  │   ├── files/{fileId}        -- geminiFileUri, filename, fileHash, uploadedAt
  │   └── chunks/{chunkId}      -- content, embedding (vector), metadata, chunkIndex
  │
  ├── events/{eventId}          -- courseId, eventType, content, response, classifierTag, createdAt
  │
  └── smg/{conceptNode}         -- accuracyRate, errorTypeMap, easeFactor, reviewIntervalDays,
                                   nextReviewDate, interactionCount, correctCount, incorrectCount
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Auth enabled
- A Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
- (Optional) Google Cloud Vision API enabled for OCR

### 1. Clone and install

```bash
git clone <repo-url>
cd AI-Companion-GDG-Project

# Install all workspaces (requires bun: https://bun.sh)
cd server && bun install && cd ../web && bun install && cd ../extension && bun install && cd ..
```

### 2. Configure the backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```
GEMINI_API_KEY=your-gemini-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json
FIREBASE_PROJECT_ID=your-project-id
```

### 3. Start the API server

```bash
cd server
bun run dev
```

The server starts at `http://localhost:3000`. Verify with `curl http://localhost:3000/health`.

### 4. Run the web app

```bash
cp web/.env.example web/.env.local
# Fill in VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID

cd web
bun run dev
```

Opens at `http://localhost:5173`.

### 5. Build the extension

```bash
cp extension/.env.example extension/.env
# Fill in VITE_FIREBASE_* and VITE_API_URL

cd extension
bun run build
```

Then in Chrome: Extensions -> Developer mode -> Load unpacked -> select `extension/dist`.

---

## Project Structure

```
AI-Companion-GDG-Project/
├── server/                 # Express API backend
│   ├── src/
│   │   ├── index.js        # App entry, Express setup, /health
│   │   ├── env.js          # Environment variable config
│   │   ├── db/
│   │   │   └── firebase.js # Firebase Admin SDK init (db + auth exports)
│   │   ├── middleware/
│   │   │   ├── auth.js     # requireFirebaseAuth middleware
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── index.js    # Router aggregator
│   │   │   ├── analyze.js  # Full RAG + explain + classify + SMG pipeline
│   │   │   ├── explain.js  # Lightweight explain (no SMG)
│   │   │   ├── quiz.js     # Quiz generation + answer submission
│   │   │   ├── ingest.js   # File upload + text ingestion
│   │   │   ├── graph.js    # SMG graph + drill queue
│   │   │   ├── course.js   # Course listing + details
│   │   │   └── events.js   # Interaction history
│   │   └── services/
│   │       ├── gemini.js       # Gemini LLM (explain, classify, quiz)
│   │       ├── embeddings.js   # text-embedding-004 (embed, embedBatch)
│   │       ├── rag.js          # Vector search + RAG pipeline
│   │       ├── ingestion.js    # Chunk, embed, store, Gemini File API
│   │       ├── misconception.js # SM-2 algorithm + SMG read/write
│   │       ├── firestore.js    # saveInteraction, ensureUserDoc
│   │       └── ocr.js          # Google Cloud Vision (image + PDF OCR)
│   └── package.json
│
├── web/                    # Marketing site + dashboard (Vite + React)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── lib/            # Firebase client, auth context, API wrapper
│   │   ├── components/     # Layout, ProtectedRoute
│   │   └── pages/          # Home, Login, SignUp, Welcome, Download, Dashboard
│   └── package.json
│
├── extension/              # Chrome extension (MV3, Vite + React)
│   ├── public/manifest.json
│   ├── src/
│   │   ├── background.js   # Service worker (panel setup, message passing)
│   │   ├── content.js      # Brightspace/Gradescope page detection + ingestion
│   │   └── sidepanel/
│   │       ├── main.jsx
│   │       ├── App.jsx     # Auth gating + routing
│   │       ├── Shell.jsx   # Navigation shell (Hub, Ask, Quiz tabs)
│   │       ├── lib/        # Firebase client, auth, API wrapper
│   │       └── pages/      # Hub, Ask, Quiz, SignIn, Loading
│   └── package.json
│
└── docs/                   # Design documents
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | React 19, Chrome MV3 Side Panel API, Vite |
| Web App | React 19, React Router 7, Vite |
| Backend | Node.js, Express 5 |
| Database | Firestore (NoSQL, real-time) |
| AI | Gemini 2.0 Flash (explain + quiz + classify), text-embedding-004 |
| OCR | Google Cloud Vision API |
| Auth | Firebase Authentication (Google SSO + email/password) |
| Vector Search | Firestore native vector search (findNearest) with cosine similarity fallback |

---

## Authentication Flow

### Web App
1. User clicks "Sign in with Google" or enters email/password
2. Firebase client SDK handles the auth flow
3. On success, `onAuthStateChanged` updates the React context
4. Every API call includes `Authorization: Bearer <firebase-id-token>`
5. Backend verifies token via `firebase-admin` `auth.verifyIdToken()`

### Chrome Extension
1. User clicks "Sign in with Google"
2. `chrome.identity.getAuthToken()` gets a Google OAuth token
3. `signInWithCredential()` exchanges it for a Firebase credential
4. Token is used for all API calls via the fetch wrapper

---

## Comparison to Alternatives

| | Study Flow | ChatGPT/Gemini | NotebookLM | Anki |
|---|---|---|---|---|
| Knows your syllabus | Yes (auto-ingest) | No | Manual upload | No |
| Tracks misconceptions | Yes (SMG + SM-2) | No | No | Manual cards |
| Professor-style quizzes | Yes (weighted by weakness) | Generic | No | Manual cards |
| In-browser workflow | Side panel | Separate tab | Separate tab | Separate app |
| Personalized over time | Yes (grows smarter) | Resets each chat | Static | Manual |

---

## License

Private team project.
