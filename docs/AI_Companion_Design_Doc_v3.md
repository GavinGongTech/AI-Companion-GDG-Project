**AI Companion (Study Flow)**

*The AI Study Companion That Knows Your Professor*

Design Document v3 (Updated) -- Team of 4 -- Built on Google

---

## 1. Overview

### What is AI Companion?

AI Companion is a Chrome browser extension backed by a Node.js/Express API and Google's Firebase + Gemini stack. It automatically builds a persistent model of each student's misconceptions across any subject and uses spaced repetition to fix them over time.

### Why does this matter?

Students today use ChatGPT, Gemini, or search tabs for homework help. The problem: these tools reset between conversations, don't know your syllabus, and can't tell you what you consistently get wrong. AI Companion solves this with three innovations:

1. **Zero-friction course ingestion** -- The extension activates automatically when a student opens Brightspace or Gradescope. No uploads, no manual setup. Course materials are chunked, embedded, and stored so every AI answer references what the professor actually taught.

2. **Student Misconception Graph (SMG)** -- A live data structure in Firestore that tracks which concepts a student misunderstands, how often, and in what way. Every interaction updates it using SM-2 spaced repetition scheduling.

3. **In-workflow assistance** -- Help lives in a Chrome side panel, not a separate tab. Students get structured explanations and quizzes without breaking their train of thought.

### Who is it for?

- University students taking math, CS, or STEM courses
- Students whose schools use Brightspace or Gradescope as their LMS
- Self-directed learners who want targeted review instead of generic AI chat

---

## 2. Functional Requirements

### Course Ingestion

- **Auto-activation**: Content script fires when student visits brightspace.*.edu or gradescope.com, detecting course pages and extracting text content
- **Text ingestion**: Raw page content is sent to the backend, chunked into ~500-character overlapping segments, embedded with Gemini's text-embedding-004, and stored as vectors in Firestore
- **File upload**: Students can also upload PDFs, images, or text files directly. Images and PDFs are OCR'd via Google Cloud Vision API
- **Gemini File API**: Uploaded documents are also sent to the Gemini File API for direct file context in LLM prompts
- **Deduplication**: Files are hashed by filename + courseId to prevent duplicate uploads on re-visits

### Active Assistant Modes

**Explain Mode** (Ask):
- Student types or pastes a question in the extension side panel
- Backend retrieves top-5 matching course chunks via vector similarity search (RAG)
- Gemini 2.0 Flash generates a structured JSON response: step-by-step solution, main concept identification, key formulas, relevant lecture reference, and personalized callout based on SMG history
- A second Gemini call classifies the interaction: identifies the concept node (e.g., "derivatives_chain_rule") and error type (conceptual misunderstanding, procedural error, knowledge gap, reasoning error)
- SM-2 algorithm updates the corresponding SMG node

**Quiz Mode**:
- Student can specify a topic or let the system pick from their weakest SMG concepts
- SM-2 scheduling prioritizes concepts that are due for review or have low accuracy
- Gemini generates 4-option MCQs styled like professor exam questions, using course material as context
- Difficulty auto-adjusts based on student accuracy (<30% = easy, 30-60% = medium, >60% = hard)
- Submitting an answer records the interaction and updates the SMG

**OCR Capture**:
- Students can send base64-encoded images (screenshots of handwritten work or textbook problems)
- Google Cloud Vision API extracts text, which then flows through the normal explain pipeline

### Student Misconception Graph (SMG)

- Every Explain and Quiz interaction is classified against a misconception taxonomy and updates the corresponding Firestore `smg/{conceptNode}` document in-place
- SM-2 spaced repetition scheduling determines quiz question priority based on:
  - Ease factor (starts at 2.5, minimum 1.3)
  - Review interval (grows on correct answers, resets to 1 day on incorrect)
  - Next review date
- Accuracy rate tracked as running correct/incorrect ratio
- Error type frequency map shows patterns (e.g., "procedural_error: 3, knowledge_gap: 1")
- Drill queue ranks concepts by urgency = (overdue days * 2) + ((1 - accuracy) * 5)

### Web App

- **Landing page**: Product description, feature highlights, comparison table vs alternatives, Chrome Web Store install CTA
- **Authentication**: Firebase Auth with Google SSO and email/password
- **Dashboard**: Network graph visualization of SMG concepts, drill queue, session history, course list

### Authentication

- Firebase Authentication shared across extension and web app
- Extension uses `chrome.identity.getAuthToken()` for Google SSO
- Web app uses Firebase client SDK (`signInWithPopup` or `signInWithEmailAndPassword`)
- Backend verifies Firebase ID tokens on every API call via `requireFirebaseAuth` middleware

---

## 3. Non-Functional Requirements

- **Performance**: Extension explain response targets <5 seconds. Dashboard loads via Firestore queries.
- **Security**: All Firestore data scoped to per-user subcollections. Firebase ID tokens required on all API calls. Gemini File API URIs stored server-side, never exposed to client. Extension uses browser's existing Brightspace session -- never stores passwords.
- **Scalability**: Firestore and Express can scale horizontally. No capacity planning needed for initial pilot.
- **Privacy**: No student data used for model training or shared with third parties. Full data deletion available.

---

## 4. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Extension Frontend | React 19, Chrome MV3, Side Panel API | Vite build, HashRouter |
| Web App Frontend | React 19, React Router 7 | Vite build, BrowserRouter |
| Backend | Node.js, Express 5 | ESM modules, JSON API |
| Database | Firestore | NoSQL, real-time capable, vector search |
| AI Model | Gemini 2.0 Flash | Structured JSON responses, temperature 0.4 (explain) / 0.7 (quiz) |
| Embeddings | Gemini text-embedding-004 | 768-dimension vectors for RAG |
| OCR | Google Cloud Vision API | Image + PDF text extraction |
| Auth | Firebase Authentication | Google SSO + email/password |
| File Context | Gemini File API | Course PDFs uploaded once, URI stored, attached to prompts |

### Google Products Used

| Product | Role |
|---------|------|
| Gemini 2.0 Flash | Core LLM for explain, classify, and quiz generation |
| Gemini text-embedding-004 | Embedding vectors for RAG retrieval |
| Gemini File API | Native document context for course materials |
| Google Cloud Vision API | OCR for handwritten and screenshot content |
| Firebase Authentication | Identity management (Google SSO) |
| Firestore | Primary database -- user data, SMG, course chunks, events |

---

## 5. Architecture

### System Flow

```
Brightspace/Gradescope page
    -> Content Script (extension)
    -> POST /api/v1/ingest/text
    -> Chunk + Embed + Store in Firestore

Student asks question (extension side panel)
    -> POST /api/v1/analyze
    -> RAG retrieval (vector search on course chunks)
    -> Gemini explain (structured JSON response)
    -> Gemini classify (concept node + error type)
    -> SM-2 update (SMG in Firestore)
    -> Response rendered in extension

Firestore SMG data
    -> GET /api/v1/graph
    -> Web dashboard visualization
```

### Backend Subsystems

- **Analyze route** (`routes/analyze.js`): Full pipeline -- RAG retrieval, Gemini explain with SMG history, classifier, event logging, SM-2 update
- **Quiz route** (`routes/quiz.js`): Reads weakest concepts from SMG, generates professor-style MCQs, records answers
- **Ingest route** (`routes/ingest.js`): File upload (with OCR) and text ingestion from content scripts
- **Explain route** (`routes/explain.js`): Lightweight explain without SMG update (for quick lookups)
- **Graph route** (`routes/graph.js`): Full SMG, drill queue, course-filtered graph
- **Course route** (`routes/course.js`): Course listing, details, ingested files, chunk counts
- **Events route** (`routes/events.js`): Paginated interaction history

### Services

- **gemini.js**: Three LLM functions -- `explainConcept` (RAG-grounded explanation), `classifyConcept` (misconception taxonomy), `generateQuiz` (weighted MCQs)
- **embeddings.js**: `embed` (single text) and `embedBatch` (multiple texts) using text-embedding-004
- **rag.js**: `retrieveChunks` (vector search with Firestore findNearest or cosine similarity fallback), `getCourseFileURIs`, `query` (full RAG pipeline)
- **ingestion.js**: `chunkText` (overlapping chunking), `ingestText` (chunk + embed + batch store), `ingestFile` (OCR + chunk + Gemini File API upload)
- **misconception.js**: SM-2 algorithm (`sm2`), quality mapping (`toQuality`), `recordInteraction`, `getWeakestConcepts`, `getGraph`, `getDrillQueue`
- **ocr.js**: `extractText` (image file), `extractTextFromBase64` (image data), `extractTextFromPDF` (PDF file)
- **firestore.js**: `saveInteraction` (event logging), `ensureUserDoc` (first-time user setup)

---

## 6. Components

### Chrome Extension

- **Content Script**: Detects Brightspace/Gradescope by hostname. Extracts page text. Sends to backend for ingestion. Shadow DOM widget with "Explain this" / "Quiz me" buttons (planned).
- **Side Panel -- Hub Tab**: Shows recommended topics from SMG, links to Ask and Quiz
- **Side Panel -- Ask Tab**: Text input + optional course ID. Calls POST /api/v1/analyze. Renders structured response cards: solution, concept badge, key formulas, relevant material, personalized callout.
- **Side Panel -- Quiz Tab**: Topic input or auto-select from weak areas. Generates MCQs. Color-coded answer feedback (green = correct, red = incorrect). Running score tracker.
- **Side Panel -- Auth**: Google SSO via chrome.identity API. Unauthenticated users see sign-in screen.

### Web App

- **Landing Page**: Hero section, 4-feature grid, how-it-works explainer, comparison table, install CTAs
- **Login/SignUp**: Firebase Auth with Google SSO button + email/password form
- **Dashboard**: Network graph of SMG concepts, drill queue ranked by urgency, session history timeline
- **Protected Routes**: Redirect to /login if not authenticated

---

## 7. API Design

All endpoints require `Authorization: Bearer <firebase-id-token>` except `/health`.

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/health` | GET | -- | `{ ok, service, env }` |
| `/api/v1/analyze` | POST | `{ content, courseId?, imageBase64? }` | `{ question, solution, mainConcept, relevantLecture, keyFormulas, personalizedCallout, classifierTag, eventId }` |
| `/api/v1/explain` | POST | `{ question, courseId? }` | `{ question, solution, mainConcept, relevantLecture, keyFormulas, personalizedCallout }` |
| `/api/v1/quiz` | POST | `{ topic?, courseId?, count? }` | `{ question, options[], answer, explanation, difficulty, conceptNode }` |
| `/api/v1/quiz/answer` | POST | `{ conceptNode, selectedAnswer, correctAnswer, courseId? }` | `{ isCorrect, eventId }` |
| `/api/v1/quiz/queue` | GET | -- | `{ queue: [{ conceptNode, accuracyRate, nextReviewDate, urgency }] }` |
| `/api/v1/ingest/upload` | POST | multipart: file + courseId + sourcePlatform | `{ ok, filename, courseId }` |
| `/api/v1/ingest/text` | POST | `{ courseId, rawContent, sourcePlatform?, filename? }` | `{ ok, courseId, ingestedAt }` |
| `/api/v1/graph` | GET | -- | `{ nodes: [{ conceptNode, accuracyRate, errorTypeMap, nextReviewDate, interactionCount }] }` |
| `/api/v1/graph/drill` | GET | -- | `{ queue: [{ conceptNode, accuracyRate, nextReviewDate, urgency }] }` |
| `/api/v1/graph/course/:courseId` | GET | -- | `{ nodes }` |
| `/api/v1/courses` | GET | -- | `{ courses: [{ courseId, platform, lastIngestedAt }] }` |
| `/api/v1/courses/:courseId` | GET | -- | `{ courseId, ingestedDocs, chunkCount }` |
| `/api/v1/events` | GET | `?limit=50&offset=0` | `{ events, count }` |

---

## 8. Data Models (Firestore)

All data lives under per-user subcollections. Users can only read/write their own data.

### users/{uid}
| Field | Type | Description |
|-------|------|-------------|
| email | string | User's email address |
| displayName | string | User's display name |
| createdAt | timestamp | Account creation time |

### users/{uid}/courses/{courseId}
| Field | Type | Description |
|-------|------|-------------|
| platform | string | "brightspace", "gradescope", "upload" |
| lastIngestedAt | timestamp | Last time materials were ingested |

### users/{uid}/courses/{courseId}/files/{fileId}
| Field | Type | Description |
|-------|------|-------------|
| geminiFileUri | string | Gemini File API URI for direct file context |
| filename | string | Original filename |
| fileHash | string | SHA-256 hash of filename + courseId (for dedup) |
| sourcePlatform | string | Origin platform |
| uploadedAt | timestamp | Upload time |

### users/{uid}/courses/{courseId}/chunks/{chunkId}
| Field | Type | Description |
|-------|------|-------------|
| content | string | ~500 char text chunk |
| embedding | vector | 768-dim float array (Firestore vector type) |
| metadata | map | { filename, source, page, week } |
| chunkIndex | number | Position in original document |
| createdAt | timestamp | Ingestion time |

### users/{uid}/events/{eventId}
| Field | Type | Description |
|-------|------|-------------|
| courseId | string | Associated course |
| eventType | string | "explain", "quiz_generated", "quiz_answer" |
| content | string | Original question/topic |
| response | map | Full Gemini response object |
| classifierTag | map | { conceptNode, errorType, confidence } |
| createdAt | timestamp | Event time |

### users/{uid}/smg/{conceptNode}
| Field | Type | Description |
|-------|------|-------------|
| courseId | string | Associated course |
| accuracyRate | number | Running correct/total ratio (0-1) |
| correctCount | number | Total correct answers |
| incorrectCount | number | Total incorrect answers |
| errorTypeMap | map | Error type frequencies |
| interactionCount | number | Total interactions with this concept |
| easeFactor | number | SM-2 ease factor (min 1.3, default 2.5) |
| reviewIntervalDays | number | Days until next review |
| nextReviewDate | timestamp | When to review this concept |
| lastInteractionAt | timestamp | Most recent interaction |
| lastErrorAt | timestamp | Most recent incorrect answer |

---

## 9. UI/UX Design

### Landing Page
Hero section with tagline: "Stop re-learning what you already forgot." Four feature cards: auto-ingestion, course-grounded explanations, professor-style quizzes, misconception graph. Comparison table vs NotebookLM, StudyFetch, ChatGPT, and Anki. CTA buttons for Chrome install and account creation.

### Extension Side Panel
Dark theme (background: #06080c, accent: #3ee0d0). Four tabs: Hub, Ask, Quiz, My Graph. Responsive to side panel width. Loading states with animated spinners. Error messages in red (#f07178). Auth gating: unauthenticated users see sign-in screen.

### Web Dashboard
Network graph visualization of SMG concepts using cytoscape.js. Nodes colored by mastery (red = struggling, yellow = mixed, green = strong). Drill queue ranked by urgency. Session history timeline.

---

## 10. Security Considerations

- **No stored credentials**: Extension operates within the student's existing Brightspace session. Never stores, reads, or transmits passwords or session cookies.
- **Firebase Security Rules**: All Firestore read/write gated by `request.auth.uid === userId`.
- **Token security**: All API calls require a valid Firebase ID token. Backend verifies with `firebase-admin`.
- **Gemini File URIs**: Stored in Firestore server-side. Extension receives processed responses, never raw file URIs.
- **Input validation**: Express JSON parser limits requests to 1MB. Route-level validation on required fields.

---

## 11. How It Compares

| Feature | AI Companion | ChatGPT/Gemini | NotebookLM | Anki |
|---------|-------------|---------------|------------|------|
| Knows your syllabus | Yes (auto-ingest) | No | Manual upload | No |
| Tracks misconceptions | Yes (SMG + SM-2) | No | No | Manual cards |
| Professor-style quizzes | Yes (weighted) | Generic | No | Manual |
| In-browser workflow | Side panel | Separate tab | Separate tab | Separate app |
| Grows smarter over time | Yes | Resets each chat | Static | Manual |
| Course-grounded answers | Yes (RAG) | No | Yes | No |

---

## 12. Testing Plan

- **Unit tests**: SM-2 algorithm (sm2, toQuality), chunkText overlapping behavior, cosine similarity
- **Integration tests**: API routes with mocked Firestore and Gemini responses
- **End-to-end**: Extension install -> sign in -> ask question -> verify SMG update -> quiz -> verify score tracking
- **Security**: Verify cross-user data access is rejected. Verify unauthenticated requests return 401.

---

## 13. Project Timeline

| Phase | Theme | Deliverables |
|-------|-------|-------------|
| 0 | Make it run | Firebase init, missing routes, dead code cleanup, server starts |
| 1 | Auth + wiring | Firebase Auth (web + extension), Ask page wired, Quiz page wired, events endpoint |
| 2 | Differentiation | Content script auto-ingest, My Graph tab, web dashboard with network graph |
| 3 | Polish | Landing page rewrite, KaTeX math rendering, error handling, rate limiting, tests + CI |
