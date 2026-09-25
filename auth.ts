import dotenv from 'dotenv';
dotenv.config();
import { Pool } from '@neondatabase/serverless';
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

export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  secret: getSecret(),
  database: dbPool,
  trustedOrigins: async (request) => {
    const list = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://*.run.app',
      'https://*.aistudio.google.com',
      'https://ai.studio',
      'https://*.ai.studio',
      'https://*.google.com',
      'https://*',
    ];
    if (request && typeof request.headers?.get === 'function') {
      const origin = request.headers.get('origin') || request.headers.get('referer');
      if (origin) {
        try {
          list.push(new URL(origin).origin);
        } catch {}
      }
    }
    return list;
  },
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
    // Railway's edge proxy provides X-Real-IP as the authoritative client IP.
    // Using it avoids Better Auth treating the comma-separated X-Forwarded-For
    // chain as ambiguous and falling back to one shared rate-limit bucket.
    ipAddress: {
      ipAddressHeaders: ['x-real-ip'],
    },
    // When BETTER_AUTH_URL/APP_URL is not provided, trust Railway's forwarded
    // host/proto headers so OAuth callbacks and redirects use the public origin.
    ...(baseURL ? {} : { trustedProxyHeaders: true }),
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },
});
