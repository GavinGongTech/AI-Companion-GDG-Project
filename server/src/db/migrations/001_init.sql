-- Migration 001: initial schema
-- Run with: psql $DATABASE_URL -f server/src/db/migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Courses ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  lms_type   TEXT,          -- "brightspace" | "canvas" | "manual"
  lms_id     TEXT,          -- external course ID from the LMS
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Content chunks (pgvector) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chunks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  embedding  vector(768),   -- Gemini text-embedding-004 dimension
  metadata   JSONB,         -- { source, page, week, type }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── Interactions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,  -- "ask" | "quiz"
  question   TEXT NOT NULL,
  response   JSONB,
  chunk_ids  UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Misconception graph ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS misconceptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept    TEXT NOT NULL,
  weight     REAL NOT NULL DEFAULT 1.0,  -- higher = weaker understanding
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concept)
);
