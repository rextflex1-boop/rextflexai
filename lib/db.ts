import { neon } from "@neondatabase/serverless";
import type { UIMessage } from "ai";

const connectionString = process.env.DATABASE_URL;

/**
 * True once DATABASE_URL is set. Everything in this file degrades
 * gracefully when it isn't: chat still works, it just won't persist yet.
 */
export const dbConfigured = Boolean(connectionString);

export const sql = connectionString ? neon(connectionString) : undefined;

export type SessionSummary = {
  readonly id: string;
  readonly title: string | null;
  readonly updatedAt: string;
  readonly isPinned: boolean;
  readonly isFavorite: boolean;
};

export type Persona = {
  readonly id: string;
  readonly instructions: string;
  readonly name: string;
};

export async function ensureSession(sessionId: string, userId: string): Promise<void> {
  if (!sql) return;
  await sql`
    insert into chat_sessions (id, user_id) values (${sessionId}, ${userId})
    on conflict (id) do nothing
  `;
}

export async function getSessionOwner(sessionId: string): Promise<string | null> {
  if (!sql) return null;
  const rows = await sql`select user_id from chat_sessions where id = ${sessionId}`;
  return (rows[0]?.user_id as string | null) ?? null;
}

/** Bumps updated_at, and sets the title the first time only (never overwrites a later rename). */
export async function touchSessionTitle(sessionId: string, firstLineOfText: string): Promise<void> {
  if (!sql) return;
  const title = firstLineOfText.trim().slice(0, 60) || null;
  await sql`
    update chat_sessions
    set title = coalesce(title, ${title}), updated_at = now()
    where id = ${sessionId}
  `;
}

export async function saveMessage(sessionId: string, message: UIMessage): Promise<void> {
  if (!sql) return;
  await sql`
    insert into chat_messages (id, session_id, role, message)
    values (${message.id}, ${sessionId}, ${message.role}, ${JSON.stringify(message)})
    on conflict (id) do nothing
  `;
}

export async function getSessionMessages(sessionId: string, userId: string): Promise<UIMessage[]> {
  if (!sql) return [];
  const rows = await sql`
    select m.message
    from chat_messages m
    join chat_sessions s on s.id = m.session_id
    where m.session_id = ${sessionId} and s.user_id = ${userId}
    order by m.created_at asc, m.id asc
  `;
  return rows.map((row) => row.message as UIMessage);
}

export async function listSessions(userId: string): Promise<SessionSummary[]> {
  if (!sql) return [];
  const rows = await sql`
    select id, title, updated_at, is_pinned, is_favorite from chat_sessions
    where user_id = ${userId}
    order by updated_at desc
    limit 100
  `;
  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string | null,
    updatedAt: row.updated_at as string,
    isPinned: Boolean(row.is_pinned),
    isFavorite: Boolean(row.is_favorite),
  }));
}


export async function setSessionPinned(sessionId: string, userId: string, isPinned: boolean): Promise<void> {
  if (!sql) return;
  await sql`
    update chat_sessions set is_pinned = ${isPinned}, updated_at = now()
    where id = ${sessionId} and user_id = ${userId}
  `;
}

export async function setSessionFavorite(sessionId: string, userId: string, isFavorite: boolean): Promise<void> {
  if (!sql) return;
  await sql`
    update chat_sessions set is_favorite = ${isFavorite}, updated_at = now()
    where id = ${sessionId} and user_id = ${userId}
  `;
}

export async function renameSession(sessionId: string, userId: string, title: string): Promise<void> {
  if (!sql) return;
  await sql`
    update chat_sessions set title = ${title.trim().slice(0, 60)}
    where id = ${sessionId} and user_id = ${userId}
  `;
}

export async function deleteSession(sessionId: string, userId: string): Promise<void> {
  if (!sql) return;
  await sql`delete from chat_sessions where id = ${sessionId} and user_id = ${userId}`;
}

export async function setSessionPublic(
  sessionId: string,
  userId: string,
  isPublic: boolean,
): Promise<void> {
  if (!sql) return;
  await sql`
    update chat_sessions set is_public = ${isPublic}
    where id = ${sessionId} and user_id = ${userId}
  `;
}

// Deliberately NOT scoped to a user — this is what makes a share link work
// for anyone who has it, logged in or not.
export async function getPublicSession(
  sessionId: string,
): Promise<{ messages: UIMessage[]; title: string | null } | undefined> {
  if (!sql) return undefined;
  const sessionRows = await sql`
    select title from chat_sessions where id = ${sessionId} and is_public = true
  `;
  if (sessionRows.length === 0) return undefined;

  const messageRows = await sql`
    select message from chat_messages where session_id = ${sessionId} order by created_at asc, id asc
  `;
  return {
    messages: messageRows.map((row) => row.message as UIMessage),
    title: sessionRows[0].title as string | null,
  };
}

export async function getTone(userId: string): Promise<string | undefined> {
  if (!sql) return undefined;
  const rows = await sql`select tone from user_settings where user_id = ${userId}`;
  return (rows[0]?.tone as string | undefined) || undefined;
}

export async function setTone(userId: string, tone: string): Promise<void> {
  if (!sql) return;
  await sql`
    insert into user_settings (user_id, tone) values (${userId}, ${tone})
    on conflict (user_id) do update set tone = excluded.tone, updated_at = now()
  `;
}

export async function listPersonas(userId: string): Promise<Persona[]> {
  if (!sql) return [];
  const rows = await sql`
    select id, name, instructions from personas
    where user_id = ${userId}
    order by created_at asc
  `;
  return rows.map((row) => ({
    id: row.id as string,
    instructions: row.instructions as string,
    name: row.name as string,
  }));
}

export async function createPersona(
  id: string,
  userId: string,
  name: string,
  instructions: string,
): Promise<void> {
  if (!sql) return;
  await sql`
    insert into personas (id, user_id, name, instructions)
    values (${id}, ${userId}, ${name.trim().slice(0, 60)}, ${instructions.trim()})
  `;
}

export async function deletePersona(id: string, userId: string): Promise<void> {
  if (!sql) return;
  await sql`delete from personas where id = ${id} and user_id = ${userId}`;
}

export async function setActivePersona(userId: string, personaId: string | null): Promise<void> {
  if (!sql) return;
  await sql`
    insert into user_settings (user_id, active_persona_id) values (${userId}, ${personaId})
    on conflict (user_id) do update set active_persona_id = excluded.active_persona_id, updated_at = now()
  `;
}

export async function getActivePersonaId(userId: string): Promise<string | undefined> {
  if (!sql) return undefined;
  const rows = await sql`select active_persona_id from user_settings where user_id = ${userId}`;
  return (rows[0]?.active_persona_id as string | undefined) ?? undefined;
}

/** Which model tier (see MODEL_TIERS in app/api/chat/route.ts) this user has picked. */
export async function setModelTier(userId: string, modelTier: string): Promise<void> {
  if (!sql) return;
  await sql`
    insert into user_settings (user_id, model_tier) values (${userId}, ${modelTier})
    on conflict (user_id) do update set model_tier = excluded.model_tier, updated_at = now()
  `;
}

export async function getModelTier(userId: string): Promise<string | undefined> {
  if (!sql) return undefined;
  const rows = await sql`select model_tier from user_settings where user_id = ${userId}`;
  return (rows[0]?.model_tier as string | undefined) ?? undefined;
}

export type GeneratedFile = {
  readonly data: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
};

/** Stores a zip built by the finishBuild sandbox tool so it can be downloaded later. */
export async function saveGeneratedFile(params: {
  id: string;
  userId: string;
  sessionId: string | null;
  fileName: string;
  mimeType: string;
  data: Uint8Array;
}): Promise<void> {
  if (!sql) return;
  await sql`
    insert into generated_files (id, user_id, session_id, file_name, mime_type, size_bytes, data)
    values (
      ${params.id}, ${params.userId}, ${params.sessionId},
      ${params.fileName}, ${params.mimeType}, ${params.data.length}, ${Buffer.from(params.data)}
    )
  `;
}

/** Scoped to userId so one user can never download another user's generated file by guessing an id. */
export async function getGeneratedFile(id: string, userId: string): Promise<GeneratedFile | undefined> {
  if (!sql) return undefined;
  const rows = await sql`
    select file_name, mime_type, data from generated_files
    where id = ${id} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return undefined;
  return {
    data: row.data as Buffer,
    fileName: row.file_name as string,
    mimeType: row.mime_type as string,
  };
}

/** What to use as the chat's system prompt "extra" — the active persona's instructions, or the plain tone text. */
export async function getActiveSystemPrompt(userId: string): Promise<string | undefined> {
  if (!sql) return undefined;
  const rows = await sql`
    select
      p.instructions as persona_instructions,
      s.tone
    from user_settings s
    left join personas p on p.id = s.active_persona_id
    where s.user_id = ${userId}
  `;
  const row = rows[0];
  return (row?.persona_instructions as string | undefined) || (row?.tone as string | undefined) || undefined;
}
