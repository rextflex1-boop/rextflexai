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
  return process.env.BETTER_AUTH_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function getSecret() {
  return process.env.BETTER_AUTH_SECRET || 'dev-only-secret-change-in-production-rextflex-ai';
}

export const auth = betterAuth({
  baseURL: getBaseUrl(),
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
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
    },
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },
});
