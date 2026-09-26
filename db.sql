-- RextFlex Ai production schema. Safe to run repeatedly.
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

create table if not exists chat_sessions (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  title text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_sessions_user_id_idx on chat_sessions(user_id);

create table if not exists chat_messages (
  id text primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  role text not null,
  message jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_id_idx on chat_messages(session_id);

create table if not exists user_settings (
  user_id text primary key references "user"(id) on delete cascade,
  model_tier text not null default 'titan',
  updated_at timestamptz not null default now()
);

-- RextFlex Ai v5 workspace files
create table if not exists workspace_files (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  session_id text not null references chat_sessions(id) on delete cascade,
  path text not null,
  mime text not null default 'application/octet-stream',
  size integer not null default 0,
  content bytea not null,
  updated_at timestamptz not null default now(),
  unique(user_id, session_id, path)
);
create index if not exists workspace_files_session_idx on workspace_files(user_id, session_id);


-- E2B sandbox mapping for agent projects
create table if not exists workspace_sandboxes (
  user_id text not null references "user"(id) on delete cascade,
  session_id text not null references chat_sessions(id) on delete cascade,
  sandbox_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, session_id),
  unique(sandbox_id)
);
create index if not exists workspace_sandboxes_session_idx on workspace_sandboxes(user_id, session_id);
