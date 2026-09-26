import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { Pool } from 'pg';
import { auth } from './auth.js';

// Load Railway/local environment variables before auth/database are used.
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

function normalizeDatabaseUrl(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    // Neon/Railway currently accept sslmode=require, but node-postgres is
    // warning that its interpretation will change in a future major release.
    // Normalize to the explicit libpq-compatible verify-full mode while
    // preserving channel_binding=require and every other query parameter.
    if (url.searchParams.get('sslmode') === 'require') {
      url.searchParams.set('sslmode', 'verify-full');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
let pool: Pool | null = null;
if (databaseUrl) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  } catch (err) {
    console.warn('[AI Studio] Could not initialize PostgreSQL pool:', err);
  }
}

/**
 * Ensure the Better Auth + RextFlex application schema exists before the
 * HTTP server starts accepting requests. This keeps Railway deployments
 * self-healing when the Neon database has not been initialized yet.
 */
async function ensureDatabaseSchema() {
  if (!pool) return;

  await pool.query('select 1');

  // Let Better Auth apply its own canonical core schema/migrations first.
  // This keeps the auth database synchronized with the installed Better Auth version.
  try {
    const { getMigrations } = await import('better-auth/db/migration');
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    console.log('[AI Studio] Better Auth migrations verified.');
  } catch (error: any) {
    console.warn('[AI Studio] Better Auth migration check skipped:', error?.message || error);
  }

  await pool.query(`
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
    create table if not exists chat_messages (
      id text primary key,
      session_id text not null references chat_sessions(id) on delete cascade,
      role text not null,
      message jsonb not null,
      created_at timestamptz not null default now()
    );
    create table if not exists user_settings (
      user_id text primary key references "user"(id) on delete cascade,
      model_tier text not null default 'titan',
      updated_at timestamptz not null default now()
    );
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
    create index if not exists chat_sessions_user_id_idx on chat_sessions(user_id);
    create index if not exists chat_messages_session_id_idx on chat_messages(session_id);
  `);

  // Repair older installations that have the tables but are missing newer
  // nullable/core columns. ADD COLUMN IF NOT EXISTS is idempotent in Postgres.
  await pool.query(`
    alter table "user" add column if not exists "emailVerified" boolean not null default false;
    alter table "user" add column if not exists image text;
    alter table "user" add column if not exists "createdAt" timestamp not null default now();
    alter table "user" add column if not exists "updatedAt" timestamp not null default now();
    alter table "session" add column if not exists "ipAddress" text;
    alter table "session" add column if not exists "userAgent" text;
    alter table "session" add column if not exists "createdAt" timestamp not null default now();
    alter table "session" add column if not exists "updatedAt" timestamp not null default now();
    alter table "account" add column if not exists "accessToken" text;
    alter table "account" add column if not exists "refreshToken" text;
    alter table "account" add column if not exists "idToken" text;
    alter table "account" add column if not exists "accessTokenExpiresAt" timestamp;
    alter table "account" add column if not exists "refreshTokenExpiresAt" timestamp;
    alter table "account" add column if not exists scope text;
    alter table "account" add column if not exists password text;
    alter table "account" add column if not exists "createdAt" timestamp not null default now();
    alter table "account" add column if not exists "updatedAt" timestamp not null default now();
  `);

  console.log('[AI Studio] Database schema verified.');
}

// In-memory data store fallback when PostgreSQL database is not connected
interface MemorySession {
  id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface MemoryMessage {
  id: string;
  session_id: string;
  role: string;
  message: any;
  created_at: string;
}

const memoryUserSettings = new Map<string, string>();
const memorySessions = new Map<string, MemorySession>();
const memoryMessages: MemoryMessage[] = [];

const MODEL_TIERS = {
  silicon: { id: 'silicon', name: 'Silicon', provider: 'groq', modelId: 'openai/gpt-oss-20b', supportsReasoning: true },
  titan: { id: 'titan', name: 'Titan', provider: 'groq', modelId: 'openai/gpt-oss-120b', supportsReasoning: true },
  apex: { id: 'apex', name: 'Apex', provider: 'pollinations', modelId: 'qwen-coder', supportsReasoning: false },
} as const;

type ModelTier = keyof typeof MODEL_TIERS;

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}


const WORKSPACE_ROOT = path.join(process.cwd(), 'data', 'workspaces');
const MAX_WORKSPACE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function safeWorkspacePath(relativePath: string) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) throw new Error('Invalid workspace path.');
  const cleaned = normalized.split('/').filter((segment) => segment && segment !== '.').join('/');
  if (!cleaned || cleaned.length > 240) throw new Error('Invalid workspace path.');
  return cleaned;
}

function workspaceDir(userId: string, sessionId: string) {
  const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const safeSession = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return path.join(WORKSPACE_ROOT, safeUser, safeSession);
}

async function ensureWorkspace(userId: string, sessionId: string) {
  const dir = workspaceDir(userId, sessionId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function persistWorkspaceFile(userId: string, sessionId: string, relativePath: string, buffer: Buffer, mime = 'application/octet-stream') {
  const safePath = safeWorkspacePath(relativePath);
  if (buffer.byteLength > MAX_WORKSPACE_FILE_BYTES) throw new Error(`File exceeds ${MAX_WORKSPACE_FILE_BYTES / 1024 / 1024}MB limit.`);
  const dir = await ensureWorkspace(userId, sessionId);
  const abs = path.join(dir, safePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  if (pool) {
    try {
      await pool.query(
        `insert into workspace_files (id,user_id,session_id,path,mime,size,content,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (user_id,session_id,path)
         do update set mime=excluded.mime,size=excluded.size,content=excluded.content,updated_at=excluded.updated_at`,
        [id('file'), userId, sessionId, safePath, mime || 'application/octet-stream', buffer.byteLength, buffer, new Date()],
      );
    } catch (err) {
      console.warn('[AI Studio] DB workspace file persist failed:', err);
    }
  }
  return { path: safePath, mime, size: buffer.byteLength };
}

async function readWorkspaceBuffer(userId: string, sessionId: string, relativePath: string) {
  const safePath = safeWorkspacePath(relativePath);
  const dir = await ensureWorkspace(userId, sessionId);
  const abs = path.join(dir, safePath);
  try {
    return { path: safePath, buffer: await fs.readFile(abs) };
  } catch {
    if (pool) {
      const result = await pool.query('select path,mime,content from workspace_files where user_id=$1 and session_id=$2 and path=$3 limit 1', [userId, sessionId, safePath]);
      const row = result.rows[0];
      if (row?.content) {
        const buffer = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, buffer);
        return { path: safePath, buffer, mime: row.mime };
      }
    }
    return null;
  }
}

async function listWorkspaceFiles(userId: string, sessionId: string) {
  if (pool) {
    try {
      const result = await pool.query('select path,mime,size,updated_at from workspace_files where user_id=$1 and session_id=$2 order by path asc', [userId, sessionId]);
      if (result.rows.length) return result.rows;
    } catch (err) {
      console.warn('[AI Studio] DB workspace file list failed:', err);
    }
  }
  const dir = await ensureWorkspace(userId, sessionId);
  const results: Array<{ path: string; mime: string; size: number; updated_at: string }> = [];
  async function walk(current: string, prefix = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(child, rel);
      else {
        const stat = await fs.stat(child);
        results.push({ path: rel, mime: 'application/octet-stream', size: stat.size, updated_at: stat.mtime.toISOString() });
      }
    }
  }
  await walk(dir);
  return results;
}

async function deleteWorkspaceFile(userId: string, sessionId: string, relativePath: string) {
  const safePath = safeWorkspacePath(relativePath);
  const dir = await ensureWorkspace(userId, sessionId);
  const abs = path.join(dir, safePath);
  try { await fs.unlink(abs); } catch {}
  if (pool) {
    await pool.query('delete from workspace_files where user_id=$1 and session_id=$2 and path=$3', [userId, sessionId, safePath]).catch(() => {});
  }
}

function parseAllowedCommand(command: string) {
  const raw = String(command || '').trim();
  if (!raw) throw new Error('Command is required.');
  if (raw.length > 240) throw new Error('Command is too long.');
  const allowedExact = /^(pwd|ls|ls -la|node --version|node -v|npm --version|npm -v|python --version|git status --short)$/;
  if (allowedExact.test(raw)) return { kind: 'direct' as const, executable: raw.split(/\s+/)[0], args: raw.split(/\s+/).slice(1) };
  if (/^find \. -maxdepth 2 -type f$/.test(raw)) return { kind: 'find' as const };
  const cat = raw.match(/^cat\s+(.+)$/);
  if (cat) return { kind: 'cat' as const, target: safeWorkspacePath(cat[1]) };
  if (raw === 'npm install --ignore-scripts') return { kind: 'exec' as const, executable: 'npm', args: ['install', '--ignore-scripts'] };
  if (raw === 'npm run build') return { kind: 'exec' as const, executable: 'npm', args: ['run', 'build'] };
  if (raw === 'npm test') return { kind: 'exec' as const, executable: 'npm', args: ['test'] };
  throw new Error('Command not allowed. Supported: pwd, ls, find . -maxdepth 2 -type f, cat <file>, node -v, npm -v, npm install --ignore-scripts, npm run build, npm test, git status --short.');
}

async function executeWorkspaceCommand(userId: string, sessionId: string, command: string) {
  const parsed = parseAllowedCommand(command);
  const cwd = await ensureWorkspace(userId, sessionId);
  if (parsed.kind === 'cat') {
    const item = await readWorkspaceBuffer(userId, sessionId, parsed.target!);
    if (!item) throw new Error(`File not found: ${parsed.target}`);
    return { command, code: 0, stdout: item.buffer.toString('utf8').slice(0, 20000), stderr: '' };
  }
  if (parsed.kind === 'find') {
    const files = await listWorkspaceFiles(userId, sessionId);
    return { command, code: 0, stdout: files.map((f) => f.path).join('\n'), stderr: '' };
  }
  return await new Promise<{ command: string; code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(parsed.executable!, parsed.args || [], { cwd, env: { ...process.env, FORCE_COLOR: '0' }, shell: false });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); if (stdout.length > 20000) stdout = stdout.slice(-20000); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ command, code: code ?? -1, stdout, stderr }); });
    child.on('error', (error) => { clearTimeout(timer); resolve({ command, code: -1, stdout, stderr: error.message }); });
  });
}

function extractJsonObject(raw: string) {
  const cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Agent returned invalid JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function searchWeb(query: string) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query is required.');
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'RextFlexAi/1.0 research bot' } });
  if (!response.ok) throw new Error(`Search provider returned ${response.status}.`);
  const html = await response.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && results.length < 8) {
    const clean = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    let resultUrl = match[1];
    try {
      if (resultUrl.startsWith('//duckduckgo.com/l/?')) {
        const redirected = new URL(`https:${resultUrl}`);
        resultUrl = redirected.searchParams.get('uddg') || resultUrl;
      }
      resultUrl = decodeURIComponent(resultUrl);
    } catch {}
    results.push({ title: clean(match[2]), url: resultUrl, snippet: clean(match[3]) });
  }
  return results;
}

async function analyzeUploadedFile(buffer: Buffer, mime: string, name: string, question: string) {
  const prompt = `Analyze the uploaded file named ${name}. Answer the user's request: ${question || 'Summarize the file, explain key points, and identify useful next steps.'}\nBe accurate about what is and is not present in the file.`;
  if (process.env.GEMINI_API_KEY) {
    const contents = [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mime || 'application/octet-stream', data: buffer.toString('base64') } },
      ],
    }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.2, maxOutputTokens: 6000 } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Gemini file analysis failed (${response.status})`);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis returned.';
  }
  if (/^(text\/|application\/json|application\/javascript|application\/typescript|application\/xml|image\/svg\+xml)/i.test(mime || '') || /\.(txt|md|json|csv|js|ts|tsx|jsx|html|css|xml|sql|py|java|kt|tsx)$/i.test(name)) {
    const text = buffer.toString('utf8').slice(0, 50000);
    return `File: ${name}\nSize: ${buffer.byteLength} bytes\n\nContent preview:\n${text}`;
  }
  return `File uploaded: ${name} (${mime || 'unknown'}, ${buffer.byteLength} bytes). Set GEMINI_API_KEY to enable binary/PDF/image AI analysis.`;
}

function getBearerToken(req: express.Request): string | null {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getCookie(req: express.Request, name: string): string | null {
  const cookieHeader = String(req.headers.cookie || '');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

function getSessionToken(req: express.Request): string | null {
  return getBearerToken(req)
    || getCookie(req, 'better-auth.session_token')
    || getCookie(req, '__Secure-better-auth.session_token');
}

async function findUserFromDatabaseToken(token: string) {
  if (!pool) return null;
  try {
    const result = await pool.query(
      `select u.id,u.name,u.email,u.image
       from "session" s
       inner join "user" u on u.id=s."userId"
       where s.token=$1 and s."expiresAt" > now()
       limit 1`,
      [token],
    );
    return result.rows[0] ?? null;
  } catch (err: any) {
    console.warn('[AI Studio] Direct session lookup failed:', err?.message || err);
    return null;
  }
}

async function getSessionUser(req: express.Request) {
  // Use Better Auth's own session verifier as the source of truth. The
  // Bearer plugin is specifically designed to make auth.api.getSession()
  // accept the Authorization: Bearer <session-token> header, and it also
  // handles the normal Better Auth cookie session. This avoids duplicating
  // session validation logic and, importantly, avoids rejecting a valid
  // session when our raw SQL representation differs from Better Auth's
  // internal adapter behavior.
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableCookieCache: true },
    });
    if (session?.user) return session.user;
  } catch (error: any) {
    console.warn('[AI Studio] Better Auth session verification failed:', error?.message || error);
  }

  // Last-resort database lookup keeps existing sessions usable if a transient
  // Better Auth adapter error occurs, but it is no longer the primary path.
  const token = getSessionToken(req);
  if (token && pool) return findUserFromDatabaseToken(token);

  return null;
}

async function getUserModelTier(userId: string): Promise<ModelTier> {
  if (pool) {
    try {
      await pool.query(
        'insert into user_settings (user_id, model_tier) values ($1, \'titan\') on conflict (user_id) do nothing',
        [userId],
      );
      const result = await pool.query('select model_tier from user_settings where user_id=$1', [userId]);
      const value = result.rows[0]?.model_tier as string | undefined;
      if (value && value in MODEL_TIERS) return value as ModelTier;
    } catch (err) {
      console.warn('[AI Studio] DB getModelTier failed, falling back to memory store:', err);
    }
  }
  const mem = memoryUserSettings.get(userId);
  if (mem && mem in MODEL_TIERS) return mem as ModelTier;
  return 'titan';
}

async function setUserModelTier(userId: string, tier: ModelTier): Promise<void> {
  memoryUserSettings.set(userId, tier);
  if (pool) {
    try {
      await pool.query(
        'insert into user_settings (user_id, model_tier) values ($1, $2) on conflict (user_id) do update set model_tier=$2, updated_at=now()',
        [userId, tier],
      );
    } catch (err) {
      console.warn('[AI Studio] DB updateModelTier failed, stored in-memory:', err);
    }
  }
}

async function listUserSessions(userId: string) {
  if (pool) {
    try {
      const result = await pool.query(
        'select id,title,created_at,updated_at from chat_sessions where user_id=$1 order by updated_at desc limit 50',
        [userId],
      );
      return result.rows;
    } catch (err) {
      console.warn('[AI Studio] DB listUserSessions failed, falling back to memory store:', err);
    }
  }
  return Array.from(memorySessions.values())
    .filter((s) => s.user_id === userId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 50);
}

async function createChatSession(sessionId: string, userId: string, title: string) {
  const now = new Date().toISOString();
  memorySessions.set(sessionId, {
    id: sessionId,
    user_id: userId,
    title,
    is_public: false,
    created_at: now,
    updated_at: now,
  });
  if (pool) {
    try {
      await pool.query('insert into chat_sessions (id,user_id,title) values ($1,$2,$3)', [sessionId, userId, title]);
    } catch (err) {
      console.warn('[AI Studio] DB createChatSession failed, stored in-memory:', err);
    }
  }
  return { id: sessionId, title };
}

async function getChatSession(sessionId: string, userId?: string) {
  if (pool) {
    try {
      const query = userId
        ? 'select id,title,created_at,updated_at from chat_sessions where id=$1 and user_id=$2'
        : 'select id,title,created_at,updated_at from chat_sessions where id=$1';
      const params = userId ? [sessionId, userId] : [sessionId];
      const result = await pool.query(query, params);
      if (result.rows[0]) return result.rows[0];
    } catch (err) {
      console.warn('[AI Studio] DB getChatSession failed, falling back to memory store:', err);
    }
  }
  const s = memorySessions.get(sessionId);
  if (!s) return null;
  if (userId && s.user_id !== userId) return null;
  return s;
}

async function deleteChatSession(sessionId: string, userId: string) {
  const session = memorySessions.get(sessionId);
  if (session && session.user_id === userId) {
    memorySessions.delete(sessionId);
    for (let i = memoryMessages.length - 1; i >= 0; i--) {
      if (memoryMessages[i].session_id === sessionId) {
        memoryMessages.splice(i, 1);
      }
    }
  }
  if (pool) {
    try {
      await pool.query('delete from chat_messages where session_id=$1', [sessionId]);
      await pool.query('delete from chat_sessions where id=$1 and user_id=$2', [sessionId, userId]);
    } catch (err) {
      console.warn('[AI Studio] DB deleteChatSession failed:', err);
    }
  }
}

async function getChatSessionMessages(sessionId: string) {
  if (pool) {
    try {
      const result = await pool.query('select id,role,message,created_at from chat_messages where session_id=$1 order by created_at asc', [sessionId]);
      return result.rows;
    } catch (err) {
      console.warn('[AI Studio] DB getChatSessionMessages failed, falling back to memory store:', err);
    }
  }
  return memoryMessages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

async function insertChatMessage(msgId: string, sessionId: string, role: string, messageObj: any) {
  const now = new Date().toISOString();
  memoryMessages.push({
    id: msgId,
    session_id: sessionId,
    role,
    message: messageObj,
    created_at: now,
  });
  if (pool) {
    try {
      await pool.query(
        'insert into chat_messages (id,session_id,role,message) values ($1,$2,$3,$4::jsonb)',
        [msgId, sessionId, role, JSON.stringify(messageObj)],
      );
    } catch (err) {
      console.warn('[AI Studio] DB insertChatMessage failed, stored in-memory:', err);
    }
  }
}

async function updateSessionTitleAndTouch(sessionId: string, title?: string) {
  const s = memorySessions.get(sessionId);
  if (s) {
    if (title && s.title === 'New conversation') s.title = title;
    s.updated_at = new Date().toISOString();
  }
  if (pool) {
    try {
      if (title) {
        await pool.query('update chat_sessions set title=coalesce(nullif(title,\'New conversation\'),$1),updated_at=now() where id=$2', [title, sessionId]);
      } else {
        await pool.query('update chat_sessions set updated_at=now() where id=$1', [sessionId]);
      }
    } catch (err) {
      console.warn('[AI Studio] DB updateSessionTitleAndTouch failed:', err);
    }
  }
}

async function getRecentHistoryMessages(sessionId: string) {
  if (pool) {
    try {
      const historyRows = await pool.query('select role,message from chat_messages where session_id=$1 order by created_at desc limit 20', [sessionId]);
      return historyRows.rows.reverse().map((row: any) => {
        const message = typeof row.message === 'object' ? row.message : JSON.parse(row.message);
        return { role: row.role, text: textFromMessage(message) };
      });
    } catch (err) {
      console.warn('[AI Studio] DB getRecentHistoryMessages failed, using memory store:', err);
    }
  }
  const sessionMsgs = memoryMessages
    .filter((m) => m.session_id === sessionId)
    .slice(-20);
  return sessionMsgs.map((row) => {
    const message = typeof row.message === 'object' ? row.message : JSON.parse(row.message);
    return { role: row.role, text: textFromMessage(message) };
  });
}

function textFromMessage(message: any): string {
  if (!message) return '';
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);
      return textFromMessage(parsed);
    } catch {
      return message;
    }
  }
  if (typeof message.text === 'string' && message.text.trim() && message.text.trim() !== '```') {
    return message.text;
  }
  if (Array.isArray(message.parts)) {
    const combined = message.parts
      .filter((p: any) => p && (typeof p.text === 'string' || typeof p.content === 'string'))
      .map((p: any) => p.text || p.content)
      .join(' ')
      .trim();
    if (combined && combined !== '```') return combined;
  }
  if (typeof message.content === 'string' && message.content.trim() && message.content.trim() !== '```') {
    return message.content;
  }
  return '';
}

function modelMessages(messages: Array<{ role: string; text?: string; content?: string }>) {
  return messages
    .filter((m) => ['user', 'assistant', 'model'].includes(m.role))
    .map((m) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: String(textFromMessage(m) || ''),
    }));
}

async function callGemini(messages: any[], systemPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured.');

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || `Gemini API returned ${response.status}`;
    throw new Error(detail);
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callProvider(tier: ModelTier, messages: any[], systemPrompt: string) {
  const info = MODEL_TIERS[tier];
  const isPollinations = info.provider === 'pollinations';
  const key = isPollinations ? process.env.POLLINATIONS_API_KEY : process.env.GROQ_API_KEY;

  if (key) {
    try {
      const url = isPollinations ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
      const body: any = {
        model: info.modelId,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.5,
        max_tokens: 8192,
      };
      if (info.supportsReasoning) body.reasoning_effort = 'low';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
      console.warn(`[AI Studio] Provider ${info.provider} response error:`, data?.error?.message || response.status);
    } catch (err) {
      console.warn(`[AI Studio] Provider ${info.provider} request failed:`, err);
    }
  }

  // Graceful fallback to Google Gemini when 3P provider keys are unavailable
  if (process.env.GEMINI_API_KEY) {
    return await callGemini(messages, systemPrompt);
  }

  if (!key && !isPollinations) throw new Error('GROQ_API_KEY is not configured and GEMINI_API_KEY is unavailable.');
  throw new Error('AI Provider key is not configured.');
}

function extractHtml(raw: string) {
  if (!raw || typeof raw !== 'string') {
    return { reply: '', html: '' };
  }

  let text = raw.trim();
  let html = '';

  // 1. Check for complete closed fenced code block (```html ... ``` or ```xml ... ``` or ```<!DOCTYPE ... ```)
  const closedFencedMatch =
    text.match(/```(?:html|xml)?\s*([\s\S]*?<!DOCTYPE[\s\S]*?)```/i) ||
    text.match(/```(?:html|xml)?\s*([\s\S]*?<html[\s\S]*?)```/i) ||
    text.match(/```html\s*([\s\S]*?)```/i) ||
    text.match(/```\s*(<!DOCTYPE[\s\S]*?)```/i);

  if (closedFencedMatch) {
    html = closedFencedMatch[1].trim();
    text = text.replace(closedFencedMatch[0], '');
  } else {
    // 2. Check for open-ended fenced code blocks (when large output reaches limit or omits trailing ```)
    const openFencedMatch =
      text.match(/```(?:html|xml)?\s*([\s\S]*?(?:<!DOCTYPE|<html)[\s\S]*)$/i) ||
      text.match(/```html\s*([\s\S]*)$/i);

    if (openFencedMatch) {
      html = openFencedMatch[1].trim();
      text = text.replace(openFencedMatch[0], '');
    } else {
      // 3. Check for raw HTML directly in text (<!DOCTYPE html ... </html> or <html ... </html>)
      const rawHtmlMatch =
        text.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/i) ||
        text.match(/(<html[\s\S]*?<\/html>)/i) ||
        text.match(/(<!DOCTYPE\s+html[\s\S]*)/i) ||
        text.match(/(<html[\s\S]*)/i);

      if (rawHtmlMatch) {
        html = rawHtmlMatch[1].trim();
        text = text.replace(rawHtmlMatch[0], '');
      }
    }
  }

  // Clean trailing backticks from extracted HTML if any
  html = html.replace(/```+\s*$/g, '').trim();

  // Repair missing closing tags if output was cut off so iframe can parse smoothly
  if (html) {
    if (!/<\/body>/i.test(html) && /<body/i.test(html)) {
      html += '\n</body>';
    }
    if (!/<\/html>/i.test(html) && /<html/i.test(html)) {
      html += '\n</html>';
    }
  }

  // Remove empty code blocks or stray backticks left over in text
  text = text.replace(/```(?:html|xml|css|js)?\s*```/gi, '');
  text = text.replace(/```+\s*$/g, '');
  text = text.replace(/^\s*```+/g, '');
  text = text.trim();

  // If the model provided code only without text explanation, supply a clear helpful message
  if ((!text || text === '```') && html) {
    text = 'Maine aapka website layout aur code generate kar diya hai! Build tab me aapka live preview open ho gaya hai.';
  } else if (!text && !html) {
    text = raw.trim();
  }

  return { reply: text, html };
}

async function main() {
  await ensureDatabaseSchema();

  const app = express();
  app.set('trust proxy', true);

  // Better Auth MUST be mounted before express.json() so it can read request bodies itself.
  const authHandler = toNodeHandler(auth);

  // Let Better Auth handle get-session directly so its cookie/Bearer
  // session semantics stay identical to the sign-in flow.
  app.all('/api/auth/get-session', async (req, res, next) => {
    try {
      await authHandler(req, res, next);
    } catch (error: any) {
      console.error('[AI Studio] Better Auth get-session failure', {
        method: req.method,
        path: req.path,
        message: error?.message || String(error),
        code: error?.code,
      });
      if (!res.headersSent) res.status(500).json({ error: 'Authentication service error' });
    }
  });

  app.all('/api/auth/*', async (req, res, next) => {
    try {
      await authHandler(req, res, next);
    } catch (error: any) {
      console.error('[AI Studio] Better Auth route failure', {
        method: req.method,
        path: req.path,
        message: error?.message || String(error),
        code: error?.code,
        cause: error?.cause?.message || error?.cause,
      });
      if (!res.headersSent) res.status(500).json({ error: 'Authentication service error' });
    }
  });

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: Boolean(pool),
      models: Object.values(MODEL_TIERS).map((m) => m.id),
      geminiAvailable: Boolean(process.env.GEMINI_API_KEY),
      googleAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
  });

  app.get('/api/auth/config', (_req, res) => {
    res.json({
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
  });

  app.get('/api/me', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) {
        console.warn('[AI Studio] /api/me unauthorized', {
          hasBearer: Boolean(getBearerToken(req)),
          hasCookie: Boolean(getCookie(req, 'better-auth.session_token') || getCookie(req, '__Secure-better-auth.session_token')),
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const tier = await getUserModelTier(user.id);
      res.json({ user, modelTier: tier });
    } catch (error: any) {
      console.error('GET /api/me', error);
      res.status(500).json({ error: error?.message || 'Failed to load profile' });
    }
  });

  app.post('/api/logout', async (req, res) => {
    try {
      await auth.api.signOut({ headers: fromNodeHeaders(req.headers) });
    } catch (error: any) {
      // A stale/expired token is already logged out from the client's point of
      // view, so keep logout idempotent rather than surfacing a 500.
      console.warn('[AI Studio] Better Auth sign-out cleanup:', error?.message || error);
    }
    res.setHeader('Set-Cookie', [
      'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
      '__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
    ]);
    res.json({ success: true });
  });

  app.post('/api/profile', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const name = String(req.body?.name ?? '').trim().slice(0, 80);
      const image = typeof req.body?.image === 'string' ? req.body.image : undefined;
      if (!name && !image) return res.status(400).json({ error: 'Nothing to update.' });
      const updated = await auth.api.updateUser({
        headers: fromNodeHeaders(req.headers),
        body: {
          ...(name ? { name } : {}),
          ...(image ? { image } : {}),
        },
      });
      res.json({ user: (updated as any)?.user ?? updated });
    } catch (error: any) {
      console.error('POST /api/profile', error);
      res.status(400).json({ error: error?.message || 'Failed to update profile' });
    }
  });

  app.get('/api/models', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const current = await getUserModelTier(user.id);
      res.json({ current, models: Object.values(MODEL_TIERS) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load models' });
    }
  });

  app.post('/api/models', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const tier = String(req.body?.modelTier || 'titan') as ModelTier;
      if (!(tier in MODEL_TIERS)) return res.status(400).json({ error: 'Invalid model tier.' });
      await setUserModelTier(user.id, tier);
      res.json({ current: tier });
    } catch (error: any) {
      console.error('POST /api/models', error);
      res.status(500).json({ error: error?.message || 'Failed to save model' });
    }
  });

  app.get('/api/sessions', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessions = await listUserSessions(user.id);
      res.json({ sessions });
    } catch (error: any) {
      console.error('GET /api/sessions', error);
      res.status(500).json({ error: error?.message || 'Failed to load conversations' });
    }
  });

  app.post('/api/sessions', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = id('chat');
      const title = String(req.body?.title || 'New conversation').slice(0, 120);
      const session = await createChatSession(sessionId, user.id, title);
      res.json({ session });
    } catch (error: any) {
      console.error('POST /api/sessions', error);
      res.status(500).json({ error: error?.message || 'Failed to create conversation' });
    }
  });

  function sanitizeMessageRow(row: any) {
    let msgObj: any = {};
    if (typeof row.message === 'object' && row.message !== null) {
      msgObj = row.message;
    } else if (typeof row.message === 'string') {
      try {
        msgObj = JSON.parse(row.message);
      } catch {
        msgObj = { text: row.message };
      }
    }

    let extractedText = textFromMessage(msgObj);
    const role =
      row.role === 'assistant' || msgObj.role === 'assistant'
        ? 'assistant'
        : row.role === 'user' || msgObj.role === 'user'
          ? 'user'
          : row.role;

    // If an assistant message was stored with only stray backticks or blank text, provide a clean response
    if (role === 'assistant' && (!extractedText || extractedText.trim() === '```')) {
      if (msgObj.generatedWebsiteHtml) {
        extractedText =
          'Maine aapka website layout aur code complete build kar diya hai! Live Build tab me iska live preview check kar sakte hain.';
      } else {
        extractedText =
          'Main aapki website banane me help karne ke liye ready hoon! Aap batayein kaisa website design karna hai?';
      }
    }

    return {
      id: row.id,
      role,
      message: {
        id: msgObj.id || row.id,
        role,
        text: extractedText,
        timestamp: msgObj.timestamp || row.created_at,
        generatedWebsiteHtml: msgObj.generatedWebsiteHtml || undefined,
      },
      created_at: row.created_at,
    };
  }

  app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const session = await getChatSession(req.params.sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Conversation not found' });
      const rawMessages = await getChatSessionMessages(req.params.sessionId);
      const messages = rawMessages.map(sanitizeMessageRow);
      res.json({ session, messages });
    } catch (error: any) {
      console.error('GET /api/sessions/:sessionId', error);
      res.status(500).json({ error: error?.message || 'Failed to load conversation' });
    }
  });

  app.delete('/api/sessions/:sessionId', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const session = await getChatSession(req.params.sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found' });
      await deleteChatSession(req.params.sessionId, user.id);
      res.json({ success: true, deletedId: req.params.sessionId });
    } catch (error: any) {
      console.error('DELETE /api/sessions/:sessionId', error);
      res.status(500).json({ error: error?.message || 'Failed to delete project' });
    }
  });


  app.get('/api/workspace/files', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.query.sessionId || '');
      if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      res.json({ files: await listWorkspaceFiles(user.id, sessionId) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to list workspace files' });
    }
  });

  app.get('/api/workspace/file', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.query.sessionId || '');
      const filePath = String(req.query.path || '');
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      const file = await readWorkspaceBuffer(user.id, sessionId, filePath);
      if (!file) return res.status(404).json({ error: 'File not found.' });
      const mime = file.mime || 'text/plain';
      if (mime.startsWith('text/') || /\.(html?|css|js|jsx|ts|tsx|json|md|txt|csv|xml|svg|sql|py|java|kt)$/i.test(file.path)) {
        return res.json({ path: file.path, text: file.buffer.toString('utf8') });
      }
      res.setHeader('Content-Type', mime);
      res.send(file.buffer);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to read workspace file' });
    }
  });

  app.post('/api/workspace/file', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.body?.sessionId || '');
      const filePath = String(req.body?.path || '');
      const content = String(req.body?.content || '');
      const mime = String(req.body?.mime || 'text/plain');
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      const result = await persistWorkspaceFile(user.id, sessionId, filePath, Buffer.from(content, 'utf8'), mime);
      res.json({ file: result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to save workspace file' });
    }
  });

  app.post('/api/workspace/upload', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.body?.sessionId || '');
      const name = String(req.body?.name || 'upload.bin');
      const mime = String(req.body?.mime || 'application/octet-stream');
      const base64 = String(req.body?.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!sessionId || !base64) return res.status(400).json({ error: 'sessionId and dataBase64 are required.' });
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.byteLength > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'Upload exceeds 8MB limit.' });
      const safeName = safeWorkspacePath(name.replace(/^.*[\\/]/, ''));
      const result = await persistWorkspaceFile(user.id, sessionId, `uploads/${safeName}`, buffer, mime);
      res.json({ file: result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to upload file' });
    }
  });

  app.delete('/api/workspace/file', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.body?.sessionId || '');
      const filePath = String(req.body?.path || '');
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      await deleteWorkspaceFile(user.id, sessionId, filePath);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to delete workspace file' });
    }
  });

  app.post('/api/workspace/command', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.body?.sessionId || '');
      const command = String(req.body?.command || '');
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      const result = await executeWorkspaceCommand(user.id, sessionId, command);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Command failed' });
    }
  });

  app.post('/api/workspace/analyze-file', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.body?.sessionId || '');
      const filePath = String(req.body?.path || '');
      const question = String(req.body?.question || '');
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      const file = await readWorkspaceBuffer(user.id, sessionId, filePath);
      if (!file) return res.status(404).json({ error: 'File not found.' });
      const mime = file.mime || 'application/octet-stream';
      const analysis = await analyzeUploadedFile(file.buffer, mime, file.path, question);
      res.json({ analysis });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'File analysis failed' });
    }
  });

  app.post('/api/research', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const query = String(req.body?.query || '').trim();
      const deep = Boolean(req.body?.deepResearch);
      if (!query) return res.status(400).json({ error: 'Query is required.' });
      const results = await searchWeb(query);
      if (!deep) return res.json({ query, results });
      const researchPrompt = `You are RextFlex Ai Deep Research. Based only on the web results below, write a concise but useful research brief for the user's query. Cite sources inline as [1], [2] etc and include a Sources section with each URL. Clearly separate facts from uncertainty.\n\nUSER QUERY: ${query}\n\nRESULTS:\n${results.map((r, i) => `[${i+1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')}`;
      let summary = '';
      if (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.POLLINATIONS_API_KEY) {
        summary = await callProvider('titan', [{ role: 'user', content: researchPrompt }], 'You produce neutral web research summaries with citations. Do not invent facts or sources.');
      } else {
        summary = results.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}\n${r.url}`).join('\n\n');
      }
      res.json({ query, results, summary, deepResearch: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Research failed' });
    }
  });

  app.post('/api/agent/run', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.body?.sessionId || '');
      const prompt = String(req.body?.prompt || '').trim();
      const requestedTier = String(req.body?.modelTier || '') as ModelTier;
      const tier = requestedTier in MODEL_TIERS ? requestedTier : await getUserModelTier(user.id);
      const session = await getChatSession(sessionId, user.id);
      if (!session) return res.status(404).json({ error: 'Project not found.' });
      if (!prompt) return res.status(400).json({ error: 'Agent prompt is required.' });
      const fileSummary = (await listWorkspaceFiles(user.id, sessionId)).map((f: any) => `${f.path} (${f.size} bytes)`).slice(0, 100).join('\n');
      const agentSystem = `You are the RextFlex Ai autonomous software agent. Return ONLY valid JSON with this shape:
{"message":"friendly progress summary","actions":[{"type":"write_file","path":"index.html","content":"..."},{"type":"delete_file","path":"..."},{"type":"run_command","command":"npm run build"}],"previewHtml":"optional complete HTML string"}
Rules: paths must be relative; never use ..; keep each file under 200KB; prefer a complete static web project (index.html, styles.css, app.js) unless user explicitly requests another stack; do not invent unavailable secrets; only use allowed commands: npm install --ignore-scripts, npm run build, npm test, pwd, ls, find . -maxdepth 2 -type f, cat <file>, node -v, npm -v, python --version, git status --short. If user asks for a website/app, make real files rather than dumping code only. Use existing files when editing. Current workspace files:\n${fileSummary || '(empty)'}`;
      const raw = await callProvider(tier, [{ role: 'user', content: prompt }], agentSystem);
      const plan = extractJsonObject(raw);
      const actions = Array.isArray(plan.actions) ? plan.actions.slice(0, 40) : [];
      const events: any[] = [];
      let previewHtml = typeof plan.previewHtml === 'string' ? plan.previewHtml : '';
      let totalBytes = 0;
      for (const action of actions) {
        if (action.type === 'write_file') {
          const content = String(action.content || '');
          totalBytes += Buffer.byteLength(content, 'utf8');
          if (totalBytes > 4 * 1024 * 1024) throw new Error('Agent file output exceeded 4MB limit.');
          const saved = await persistWorkspaceFile(user.id, sessionId, String(action.path || ''), Buffer.from(content, 'utf8'), 'text/plain');
          events.push({ type: 'write_file', path: saved.path, size: saved.size });
          if (!previewHtml && saved.path.toLowerCase() === 'index.html') previewHtml = content;
        } else if (action.type === 'delete_file') {
          const filePath = safeWorkspacePath(String(action.path || ''));
          await deleteWorkspaceFile(user.id, sessionId, filePath);
          events.push({ type: 'delete_file', path: filePath });
        } else if (action.type === 'run_command') {
          const commandResult = await executeWorkspaceCommand(user.id, sessionId, String(action.command || ''));
          events.push({ type: 'run_command', ...commandResult });
          if (commandResult.code !== 0) break;
        }
      }
      res.json({ message: String(plan.message || 'Agent task completed.'), events, previewHtml, modelTier: tier });
    } catch (error: any) {
      console.error('POST /api/agent/run', error);
      res.status(500).json({ error: error?.message || 'Agent failed' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const requestedTier = String(req.body?.modelTier || '') as ModelTier;
      const tier = requestedTier in MODEL_TIERS ? requestedTier : await getUserModelTier(user.id);
      const title = String(req.body?.title || textFromMessage(messages.at(-1)) || 'New conversation').slice(0, 120);
      let sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';

      if (sessionId) {
        const owned = await getChatSession(sessionId, user.id);
        if (!owned) return res.status(403).json({ error: 'Forbidden' });
      } else {
        sessionId = id('chat');
        await createChatSession(sessionId, user.id, title);
      }

      const last = messages.at(-1);
      if (last) {
        const userText = textFromMessage(last);
        await insertChatMessage(
          id('msg'),
          sessionId,
          last.role === 'model' ? 'assistant' : last.role,
          { role: last.role, text: userText, timestamp: new Date().toISOString() },
        );
        await updateSessionTitleAndTouch(sessionId, title);
      }

      const systemPrompt = `You are RextFlex Ai, an expert AI website builder and full-stack software engineer.
Core Directives:
1. Communication & Language: If the user speaks Hindi or Hinglish, always reply in natural, friendly, conversational Hinglish. Otherwise, match their language.
2. Website & Web App Generation: Whenever the user asks to build, create, design, or update any website, page, or web app (no matter how big, complex, or detailed the request is):
   - First provide a concise, friendly explanation (1-3 sentences) outlining what you built, features included, and styling.
   - Then immediately output a COMPLETE, single-file, production-ready HTML document inside a \`\`\`html fenced code block.
   - The HTML MUST be self-contained: include <!DOCTYPE html>, <html lang="en">, <head> with responsive meta tags, Google Fonts, Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>), and Lucide icons (<script src="https://unpkg.com/lucide@latest"></script>).
   - Build rich, comprehensive, interactive layouts with hero sections, navbars, features, cards, interactive buttons, working JavaScript logic, and responsive design.
   - Do NOT truncate code, do NOT use placeholders like "<!-- add more items here -->", and always close the \`\`\` code block at the end.`;
      const history = await getRecentHistoryMessages(sessionId);
      const cleanHistory = modelMessages(history.slice(-20));
      const raw = await callProvider(tier, cleanHistory, systemPrompt);
      const parsed = extractHtml(raw);
      const assistantMessage = {
        id: id('msg'),
        role: 'assistant',
        text: parsed.reply || 'Maine aapka website code build kar diya hai!',
        timestamp: new Date().toISOString(),
        generatedWebsiteHtml: parsed.html || undefined,
      };
      await insertChatMessage(assistantMessage.id, sessionId, 'assistant', assistantMessage);
      await updateSessionTitleAndTouch(sessionId);

      res.json({ reply: assistantMessage.text, generatedWebsiteHtml: parsed.html || undefined, sessionId, modelTier: tier });
    } catch (error: any) {
      console.error('POST /api/chat', error);
      res.status(500).json({ error: error?.message || 'AI request failed' });
    }
  });

  app.get('/api/share/:sessionId', async (req, res) => {
    try {
      const session = await getChatSession(req.params.sessionId);
      if (!session || !session.is_public) return res.status(404).json({ error: 'Shared conversation not found' });
      const rawMessages = await getChatSessionMessages(req.params.sessionId);
      const messages = rawMessages.map(sanitizeMessageRow);
      res.json({ session, messages });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load shared conversation' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RextFlex Ai running on http://0.0.0.0:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
