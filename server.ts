import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { Pool } from '@neondatabase/serverless';
import { auth } from './auth.js';

// Load Railway/local environment variables before auth/database are used.
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

const MODEL_TIERS = {
  silicon: { id: 'silicon', name: 'Silicon', provider: 'groq', modelId: 'openai/gpt-oss-20b', supportsReasoning: true },
  titan: { id: 'titan', name: 'Titan', provider: 'groq', modelId: 'openai/gpt-oss-120b', supportsReasoning: true },
  apex: { id: 'apex', name: 'Apex', provider: 'pollinations', modelId: 'qwen-coder', supportsReasoning: false },
} as const;

type ModelTier = keyof typeof MODEL_TIERS;

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function requireDb() {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return pool;
}

async function getSessionUser(req: express.Request) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user ?? null;
}

async function ensureUserSettings(userId: string) {
  const db = requireDb();
  await db.query(
    'insert into user_settings (user_id, model_tier) values ($1, \'titan\') on conflict (user_id) do nothing',
    [userId],
  );
}

async function getModelTier(userId: string): Promise<ModelTier> {
  const db = requireDb();
  await ensureUserSettings(userId);
  const result = await db.query('select model_tier from user_settings where user_id=$1', [userId]);
  const value = result.rows[0]?.model_tier as string | undefined;
  return value && value in MODEL_TIERS ? (value as ModelTier) : 'titan';
}

function textFromMessage(message: any) {
  if (!message) return '';
  if (typeof message.text === 'string') return message.text;
  if (Array.isArray(message.parts)) {
    return message.parts.filter((p: any) => p?.type === 'text' && typeof p.text === 'string').map((p: any) => p.text).join(' ');
  }
  if (typeof message.content === 'string') return message.content;
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

async function callProvider(tier: ModelTier, messages: any[], systemPrompt: string) {
  const info = MODEL_TIERS[tier];
  const isPollinations = info.provider === 'pollinations';
  const url = isPollinations ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
  const key = isPollinations ? process.env.POLLINATIONS_API_KEY : process.env.GROQ_API_KEY;
  if (!key && !isPollinations) throw new Error('GROQ_API_KEY is not configured.');

  const body: any = {
    model: info.modelId,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature: 0.5,
    max_tokens: 4096,
  };
  if (info.supportsReasoning) body.reasoning_effort = 'low';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `Provider returned ${response.status}`;
    throw new Error(detail);
  }
  return data?.choices?.[0]?.message?.content || '';
}

function extractHtml(raw: string) {
  const match = raw.match(/```html\s*([\s\S]*?)```/i);
  if (!match) return { reply: raw.trim(), html: '' };
  return { reply: raw.replace(/```html[\s\S]*?```/gi, '').trim(), html: match[1].trim() };
}

async function main() {
  const app = express();

  // Better Auth MUST be mounted before express.json() so it can read request bodies itself.
  app.all('/api/auth/*', toNodeHandler(auth));

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: Boolean(pool), models: Object.values(MODEL_TIERS).map((m) => m.id) });
  });

  app.get('/api/me', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const tier = pool ? await getModelTier(user.id) : 'titan';
      res.json({ user, modelTier: tier });
    } catch (error: any) {
      console.error('GET /api/me', error);
      res.status(500).json({ error: error?.message || 'Failed to load profile' });
    }
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
      res.json({ user: updated?.user ?? updated });
    } catch (error: any) {
      console.error('POST /api/profile', error);
      res.status(400).json({ error: error?.message || 'Failed to update profile' });
    }
  });

  app.get('/api/models', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const current = pool ? await getModelTier(user.id) : 'titan';
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
      const db = requireDb();
      await ensureUserSettings(user.id);
      await db.query('update user_settings set model_tier=$1, updated_at=now() where user_id=$2', [tier, user.id]);
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
      const db = requireDb();
      const result = await db.query(
        'select id,title,created_at,updated_at from chat_sessions where user_id=$1 order by updated_at desc limit 50',
        [user.id],
      );
      res.json({ sessions: result.rows });
    } catch (error: any) {
      console.error('GET /api/sessions', error);
      res.status(500).json({ error: error?.message || 'Failed to load conversations' });
    }
  });

  app.post('/api/sessions', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const db = requireDb();
      const sessionId = id('chat');
      const title = String(req.body?.title || 'New conversation').slice(0, 120);
      await db.query('insert into chat_sessions (id,user_id,title) values ($1,$2,$3)', [sessionId, user.id, title]);
      res.json({ session: { id: sessionId, title } });
    } catch (error: any) {
      console.error('POST /api/sessions', error);
      res.status(500).json({ error: error?.message || 'Failed to create conversation' });
    }
  });

  app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const db = requireDb();
      const session = await db.query('select id,title,created_at,updated_at from chat_sessions where id=$1 and user_id=$2', [req.params.sessionId, user.id]);
      if (!session.rows[0]) return res.status(404).json({ error: 'Conversation not found' });
      const messages = await db.query('select id,role,message,created_at from chat_messages where session_id=$1 order by created_at asc', [req.params.sessionId]);
      res.json({ session: session.rows[0], messages: messages.rows });
    } catch (error: any) {
      console.error('GET /api/sessions/:sessionId', error);
      res.status(500).json({ error: error?.message || 'Failed to load conversation' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const db = requireDb();
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const requestedTier = String(req.body?.modelTier || '') as ModelTier;
      const tier = requestedTier in MODEL_TIERS ? requestedTier : await getModelTier(user.id);
      const title = String(req.body?.title || textFromMessage(messages.at(-1)) || 'New conversation').slice(0, 120);
      let sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';

      if (sessionId) {
        const owned = await db.query('select id from chat_sessions where id=$1 and user_id=$2', [sessionId, user.id]);
        if (!owned.rows[0]) return res.status(403).json({ error: 'Forbidden' });
      } else {
        sessionId = id('chat');
        await db.query('insert into chat_sessions (id,user_id,title) values ($1,$2,$3)', [sessionId, user.id, title]);
      }

      const last = messages.at(-1);
      if (last) {
        await db.query('insert into chat_messages (id,session_id,role,message) values ($1,$2,$3,$4::jsonb)', [id('msg'), sessionId, last.role === 'model' ? 'assistant' : last.role, JSON.stringify(last)]);
        await db.query('update chat_sessions set title=coalesce(nullif(title,\'New conversation\'),$1),updated_at=now() where id=$2', [title, sessionId]);
      }

      const systemPrompt = `You are RextFlex Ai, a premium AI website builder and full-stack engineering assistant. Reply in friendly Hinglish when the user speaks Hinglish, otherwise match their language. Be useful and direct. When the user asks to build/design/create/update a website, return a short explanation followed by a COMPLETE standalone HTML document inside an html fenced code block. Use polished responsive CSS and JavaScript. Do not invent API keys or claim an action happened when it did not.`;
      const historyRows = await db.query('select role,message from chat_messages where session_id=$1 order by created_at desc limit 20', [sessionId]);
      const history = historyRows.rows.reverse().map((row: any) => {
        const message = typeof row.message === 'object' ? row.message : JSON.parse(row.message);
        return { role: row.role, text: textFromMessage(message) };
      });
      const cleanHistory = modelMessages(history.slice(-20));
      const raw = await callProvider(tier, cleanHistory, systemPrompt);
      const parsed = extractHtml(raw);
      const assistantMessage = { id: id('msg'), role: 'assistant', text: parsed.reply || raw, timestamp: new Date().toISOString(), generatedWebsiteHtml: parsed.html || undefined };
      await db.query('insert into chat_messages (id,session_id,role,message) values ($1,$2,$3,$4::jsonb)', [assistantMessage.id, sessionId, 'assistant', JSON.stringify(assistantMessage)]);
      await db.query('update chat_sessions set updated_at=now() where id=$1', [sessionId]);

      res.json({ reply: assistantMessage.text, generatedWebsiteHtml: parsed.html || undefined, sessionId, modelTier: tier });
    } catch (error: any) {
      console.error('POST /api/chat', error);
      res.status(500).json({ error: error?.message || 'AI request failed' });
    }
  });

  app.get('/api/share/:sessionId', async (req, res) => {
    try {
      const db = requireDb();
      const session = await db.query('select id,title from chat_sessions where id=$1 and is_public=true', [req.params.sessionId]);
      if (!session.rows[0]) return res.status(404).json({ error: 'Shared conversation not found' });
      const messages = await db.query('select id,role,message,created_at from chat_messages where session_id=$1 order by created_at asc', [req.params.sessionId]);
      res.json({ session: session.rows[0], messages: messages.rows });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load shared conversation' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
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
