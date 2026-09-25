import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';

const databaseUrl = process.env.DATABASE_URL;

let dbPool: Pool | undefined = undefined;
if (databaseUrl) {
  try {
    dbPool = new Pool({ connectionString: databaseUrl });
  } catch (err) {
    console.warn('[AI Studio] Could not initialize database pool, using in-memory auth store:', err);
  }
}

function getBaseUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return undefined;
}

function getSecret() {
  return process.env.BETTER_AUTH_SECRET || 'dev-only-secret-change-in-production-rextflex-ai';
}

const baseURL = getBaseUrl();

const productionOrigin = baseURL ? new URL(baseURL).origin : null;
const trustedOrigins = Array.from(new Set([
  productionOrigin,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://*.run.app',
  'https://*.aistudio.google.com',
  'https://ai.studio',
  'https://*.ai.studio',
].filter(Boolean) as string[]));

export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  secret: getSecret(),
  database: dbPool,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [bearer()],
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  user: {
    additionalFields: {},
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-real-ip'],
    },
    ...(baseURL ? {} : { trustedProxyHeaders: true }),
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  logger: {
    level: process.env.AUTH_DEBUG === '1' ? 'debug' : 'warn',
    log: (level, message, ...args) => {
      const safeArgs = args.map((arg) => {
        if (arg instanceof Error) return { name: arg.name, message: arg.message, stack: arg.stack };
        if (arg && typeof arg === 'object') {
          try { return JSON.parse(JSON.stringify(arg)); } catch { return String(arg); }
        }
        return arg;
      });
      console[level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error']('[Better Auth]', message, ...safeArgs);
    },
  },
});
