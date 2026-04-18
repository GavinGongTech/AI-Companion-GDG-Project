# API Reference

Base URL: `http://localhost:3000`  
All `/api/v1/*` routes require a Firebase ID token unless noted otherwise.

## Authentication

Every protected route requires:

```
Authorization: Bearer <firebase-id-token>
```

Missing or invalid tokens return `401`. All `/api/v1` routes pass through a shared rate limiter before reaching route handlers.

## Error Format

All errors share the same shape:

```json
{ "error": "Human-readable message" }
```

5xx errors always return the generic message `"Internal server error"` — the real error is logged server-side only.

---

## Health

### `GET /health`

Liveness + Firestore reachability check. Not under `/api/v1`. No auth required.

**Response `200` (Firestore reachable)**

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` |
| `service` | string | `"study-flow-api"` |
| `env` | string | Present in non-production only |
| `firestore` | boolean | Present in non-production only |

**Response `503` (Firestore unreachable)** — same shape with `ok: false`.

---

## Analyze

### `POST /api/v1/analyze`

Full AI pipeline: RAG retrieval → Gemini explanation → concept classification → SMG update → gamification. Awards 5 XP.

**Auth required:** Yes

**Request body** (`Content-Type: application/json`, max 1 MB)

| Field | Type | Required | Constraints |
|---|---|---|---|
| `content` | string | Conditional | 1–5000 chars. Required if `imageBase64` absent. |
| `imageBase64` | string | Conditional | Max 5,000,000 chars. Required if `content` absent. OCR'd server-side. |
| `courseId` | string | No | Max 100 chars. Scopes RAG retrieval to one course. |

At least one of `content` or `imageBase64` must be present; the validate middleware returns `400` if both are absent.

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `question` | string | The text that was analyzed (after OCR if image was submitted) |
| `solution` | string | Gemini's explanation |
| `mainConcept` | string | Primary concept identified |
| `relevantLecture` | string | Source lecture or topic from course material |
| `keyFormulas` | string[] | Relevant formulas extracted |
| `personalizedCallout` | string | Personalized note based on student history |
| `classifierTag.conceptNode` | string | snake_case concept key used in SMG |
| `classifierTag.errorType` | string | One of `conceptual_misunderstanding`, `procedural_error`, `knowledge_gap`, `reasoning_error`, `none` |
| `classifierTag.confidence` | number | Classifier confidence, 0–1 |
| `eventId` | string | Firestore event document ID |

**Error codes**

| Code | Condition |
|---|---|
| `400` | Neither `content` nor `imageBase64` provided, or schema validation failed |
| `401` | Missing or invalid token |
| `500` | Gemini API failure or Firestore write failure |

---

## Explain

### `POST /api/v1/explain`

Lightweight explanation only — no SMG update, no gamification, no event saved.  
Use this for preview or non-tracked explanations. For full tracking, use `POST /api/v1/analyze`.

**Auth required:** Yes

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `question` | string | Yes | 1–5000 chars |
| `courseId` | string | No | Max 100 chars |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `question` | string | Echo of the input question |
| `solution` | string | Gemini's explanation |
| `mainConcept` | string | Primary concept identified |
| `relevantLecture` | string | Source lecture or topic |
| `keyFormulas` | string[] | Relevant formulas extracted |
| `personalizedCallout` | string | Personalized note |

**Error codes**

| Code | Condition |
|---|---|
| `400` | Schema validation failed |
| `401` | Missing or invalid token |

---

## Quiz

### `POST /api/v1/quiz`

Generate quiz questions. If `topic` is omitted, the server picks from the student's weakest SMG concepts. Answers are stored server-side; the client receives a `sessionId` for grading calls. Sessions expire after 30 minutes.

**Auth required:** Yes

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `topic` | string | No | Max 200 chars. If absent, picked from weakest SMG concepts. |
| `courseId` | string | No | Max 100 chars. Scopes RAG context. |
| `count` | integer | No | 1–10, default 1. Number of questions to generate. |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `topic` | string | The topic that was quizzed (may differ from input if auto-selected) |
| `courseId` | string \| null | Echoed from request |
| `sessionId` | string (UUID) | Session identifier required for `POST /api/v1/quiz/answer` |
| `questions` | object[] | Array of question objects (answers stripped) |
| `questions[].question` | string | Question text |
| `questions[].options` | string[] | Answer choices |
| `questions[].conceptNode` | string | snake_case concept this question targets |
| `questions[].difficulty` | string | Difficulty level |

**Error codes**

| Code | Condition |
|---|---|
| `400` | Schema validation failed |
| `401` | Missing or invalid token |

---

### `POST /api/v1/quiz/answer`

Submit one answer for server-side grading. The server validates the `sessionId`, looks up the stored correct answer, updates the SMG, and awards 10 XP for correct answers.

**Auth required:** Yes

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `sessionId` | string (UUID) | Yes | From the `POST /api/v1/quiz` response |
| `questionIndex` | integer | Yes | 0–9. Index into the session's question array. |
| `conceptNode` | string | Yes | 1–200 chars. Must match the stored question's `conceptNode`. |
| `selectedAnswer` | integer | Yes | 0–9. Index of the chosen option. |
| `courseId` | string | No | Max 100 chars. Recorded with the event. |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `isCorrect` | boolean | Whether the submitted answer was correct |
| `correctAnswer` | integer | Index of the correct option |
| `eventId` | string | Firestore event document ID |

**Error codes**

| Code | Condition |
|---|---|
| `400` | Session not found, session expired, mismatched `conceptNode`, or schema validation failed |
| `401` | Missing or invalid token |

---

### `GET /api/v1/quiz/queue`

Return the spaced repetition drill queue for the authenticated user, ordered by urgency. Urgency score: `(overdueDays * 2) + ((1 - accuracyRate) * 5)`.

**Auth required:** Yes

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `queue` | object[] | Ordered list of concepts due for review |
| `queue[].conceptNode` | string | snake_case concept key |
| `queue[].urgencyScore` | number | Higher = more urgent |
| `queue[].accuracyRate` | number | 0–1 |
| `queue[].nextReviewDate` | string (ISO 8601) | Scheduled review date |

---

## Graph (Student Misconception Graph)

### `GET /api/v1/graph`

Return all SMG nodes for the authenticated user. Cached in-process for 60 seconds.

**Auth required:** Yes

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `nodes` | object[] | All concept nodes |
| `nodes[].conceptNode` | string | snake_case concept key |
| `nodes[].accuracyRate` | number | 0–1 |
| `nodes[].easeFactor` | number | SM-2 ease factor |
| `nodes[].reviewIntervalDays` | number | Current SM-2 interval |
| `nodes[].nextReviewDate` | string (ISO 8601) | Next scheduled review |
| `nodes[].errorTypeMap` | object | Counts by error type |
| `nodes[].interactionCount` | integer | Total interactions recorded |

**Error codes**

| Code | Condition |
|---|---|
| `404` | No SMG data exists yet for this user |
| `401` | Missing or invalid token |

---

### `GET /api/v1/graph/drill`

Return the spaced repetition drill queue. Identical payload to `GET /api/v1/quiz/queue`. Cached in-process for 60 seconds. Both this endpoint and `GET /api/v1/quiz/queue` call the same underlying `getDrillQueue` function.

**Auth required:** Yes

**Response `200`** — same shape as `GET /api/v1/quiz/queue`.

---

### `GET /api/v1/graph/course/:courseId`

Return SMG nodes filtered to a specific course. Not cached.

**Auth required:** Yes

**Path parameter:** `courseId` — the course to filter by.

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `nodes` | object[] | Concept nodes where `courseId` matches |

---

## Courses

### `GET /api/v1/courses`

List all courses for the authenticated user. Cached in-process.

**Auth required:** Yes

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `courses` | object[] | All courses |
| `courses[].courseId` | string | Course identifier |

Additional fields from the Firestore course document are included as-is.

---

### `GET /api/v1/courses/:courseId`

Get details for a single course, including ingested files and chunk count. Cached in-process.

**Auth required:** Yes

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `courseId` | string | Course identifier |
| `ingestedDocs` | object[] | Ingested file records (`geminiFileUri` and `fileHash` are stripped) |
| `ingestedDocs[].fileId` | string | File document ID |
| `ingestedDocs[].filename` | string | Original filename |
| `chunkCount` | integer | Total embedded chunks in this course |

Additional fields from the Firestore course document are included as-is.

**Error codes**

| Code | Condition |
|---|---|
| `404` | Course not found |
| `401` | Missing or invalid token |

---

## Ingest

### `POST /api/v1/ingest/upload`

Upload a file (PDF, etc.) for chunking, embedding, and storage in Firestore. File is deleted from the server's temp directory after processing regardless of success or failure. Max file size: 20 MB.

**Auth required:** Yes

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | The file to ingest. Max 20 MB. |
| `courseId` | string | Yes | Course to associate the file with. |
| `sourcePlatform` | string | No | Defaults to `"upload"`. |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` |
| `filename` | string | Original filename |
| `courseId` | string | Course the file was ingested into |

**Error codes**

| Code | Condition |
|---|---|
| `400` | `file` or `courseId` missing |
| `401` | Missing or invalid token |
| `413` | File exceeds 20 MB |

---

### `POST /api/v1/ingest/text`

Ingest raw text content (used by the browser extension's content scripts on Brightspace/Gradescope pages).

**Auth required:** Yes

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `courseId` | string | Yes | 1–100 chars |
| `rawContent` | string | Yes | 1–500,000 chars |
| `sourcePlatform` | string | No | Max 50 chars, defaults to `"brightspace"` |
| `filename` | string | No | Max 200 chars, defaults to `"content-script-capture"` |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` |
| `courseId` | string | Echoed from request |
| `ingestedAt` | string (ISO 8601) | Server timestamp of ingestion |

**Error codes**

| Code | Condition |
|---|---|
| `400` | Schema validation failed |
| `401` | Missing or invalid token |

---

## Events

### `GET /api/v1/events`

List recent interaction events for the authenticated user, ordered newest-first.

**Auth required:** Yes

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | integer | 50 | 1–100 |
| `offset` | integer | 0 | 0–1000 |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `events` | object[] | Event records |
| `events[].eventId` | string | Firestore document ID |
| `events[].eventType` | string | e.g. `"explain"`, `"quiz_generated"`, `"quiz_answer"` |
| `events[].content` | string | The question or topic |
| `events[].courseId` | string | Associated course, if any |
| `events[].createdAt` | timestamp | Firestore server timestamp |
| `count` | integer | Number of events returned in this response |

---

### `POST /api/v1/events/track`

Track a lightweight client-side action (e.g. `login`, `page_view`). Does not trigger SMG updates or gamification.

**Auth required:** Yes

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `eventType` | string | Yes | Action name, e.g. `"page_view"` |
| `content` | string | No | Optional context string |
| `meta` | object | No | Arbitrary metadata object |

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` |
| `eventId` | string | Firestore event document ID |

**Error codes**

| Code | Condition |
|---|---|
| `400` | `eventType` missing or not a string |
| `401` | Missing or invalid token |

---

## Gamification

### `GET /api/v1/gamification`

Return the authenticated user's XP, level, streak, and achievement status. Also runs a streak update on each call.

**Auth required:** Yes

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `xp` | integer | Total XP earned |
| `level` | integer | Current level (computed from XP) |
| `xpIntoLevel` | integer | XP accumulated into the current level |
| `nextLevelXP` | integer | XP required to complete the current level |
| `streak` | integer | Current daily activity streak in days |
| `achievements` | object[] | All defined achievements with unlock status |
| `achievements[].id` | string | Achievement identifier |
| `achievements[].name` | string | Display name |
| `achievements[].description` | string | Unlock condition description |
| `achievements[].icon` | string | Emoji icon |
| `achievements[].unlocked` | boolean | Whether the user has unlocked this achievement |
| `achievements[].unlockedAt` | string \| null | ISO 8601 timestamp, or `null` if not unlocked |

XP events: `POST /api/v1/analyze` awards 5 XP; a correct `POST /api/v1/quiz/answer` awards 10 XP; the first activity each day awards 20 XP (streak bonus).

**Defined achievements**

| ID | Condition |
|---|---|
| `first_quiz` | 1 quiz completed |
| `streak_7` | 7-day streak |
| `streak_30` | 30-day streak |
| `concepts_10` | 10 concepts tracked in SMG |
| `concepts_50` | 50 concepts tracked in SMG |
| `accuracy_90` | 90%+ accuracy on any concept |

---

## Streaming

### `POST /api/v1/stream/explain`

Streaming version of explain. Returns a Server-Sent Events (SSE) stream. RAG context is retrieved before streaming; if RAG fails the stream continues without context.

**Auth required:** Yes

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `question` | string | Yes | 1–2000 chars |
| `courseId` | string | No | No explicit max; passed to RAG retrieval |

**Response** — `Content-Type: text/event-stream`

The connection is kept alive with a `": ping"` comment every 20 seconds. Events:

| Event data | Description |
|---|---|
| `{"text": "..."}` | Incremental text chunk from Gemini |
| `[DONE]` | Stream complete |
| `{"error": "Stream interrupted"}` | Non-recoverable stream error |

The response never returns a non-200 status — the stream headers are flushed immediately. Errors are delivered as SSE data frames.

**Error codes**

| Code | Condition |
|---|---|
| `400` | Schema validation failed (returned before headers are flushed) |
| `401` | Missing or invalid token (returned before headers are flushed) |
