-- Run this against your Neon database before using these features.
-- Easiest way: Neon Console → your project → SQL Editor → paste & run.
-- Or from a terminal with psql installed:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS everywhere).

-- ── better-auth tables ──────────────────────────────────────────────
-- This is a best-effort schema for better-auth 1.6.26's defaults
-- (email+password + Google OAuth, no extra plugins). If sign-in/sign-up
-- errors mention a missing column/table, the authoritative fix is to run
-- `npx @better-auth/cli generate` in the project (with DATABASE_URL and
-- BETTER_AUTH_SECRET set) and apply what it outputs instead.

create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create table if not exists "session" (
  id text primary key,
  "expiresAt" timestamp not null,
  token text not null unique,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user"(id) on delete cascade
);

create table if not exists "account" (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  scope text,
  password text,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create table if not exists "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamp not null,
  "createdAt" timestamp default now(),
  "updatedAt" timestamp default now()
);

-- ── RextFlex Ai tables ──────────────────────────────────────────────

create table if not exists chat_sessions (
  id text primary key,
  user_id text references "user"(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_sessions add column if not exists title text;
alter table chat_sessions add column if not exists updated_at timestamptz not null default now();
alter table chat_sessions add column if not exists user_id text references "user"(id) on delete cascade;
alter table chat_sessions add column if not exists is_public boolean not null default false;
alter table chat_sessions add column if not exists is_pinned boolean not null default false;
alter table chat_sessions add column if not exists is_favorite boolean not null default false;

create index if not exists chat_sessions_user_id_idx on chat_sessions(user_id);
create index if not exists chat_sessions_pinned_idx on chat_sessions(user_id, is_pinned desc, updated_at desc);

create table if not exists chat_messages (
  id text primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  role text not null,
  message jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on chat_messages(session_id);

-- Saved personas (named system-prompt presets), and which one is active.
create table if not exists personas (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  name text not null,
  instructions text not null,
  created_at timestamptz not null default now()
);

create index if not exists personas_user_id_idx on personas(user_id);

-- Per-user AI tone/behaviour setting (used when no persona is active).
create table if not exists user_settings (
  user_id text primary key references "user"(id) on delete cascade,
  tone text,
  active_persona_id text references personas(id) on delete set null,
  model_tier text not null default 'titan',
  updated_at timestamptz not null default now()
);

alter table user_settings add column if not exists active_persona_id text references personas(id) on delete set null;
alter table user_settings add column if not exists model_tier text not null default 'titan';

-- Zips produced by the buildProject sandbox tool (app/api/chat/route.ts +
-- lib/sandbox.ts). Binary data lives in Postgres as bytea so a download link
-- can be served later from app/api/files/[fileId]/route.ts without needing
-- separate object storage (S3/R2/etc).
create table if not exists generated_files (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  session_id text references chat_sessions(id) on delete cascade,
  file_name text not null,
  mime_type text not null default 'application/zip',
  size_bytes integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists generated_files_user_id_idx on generated_files(user_id);

-- If you previously ran an older version of this file, it created `sites`
-- and `site_pages` tables for a website-builder feature that's been
-- removed. They're unused now — drop them whenever you like:
--   drop table if exists site_pages;
--   drop table if exists sites;
