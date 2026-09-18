import dotenv from 'dotenv';
dotenv.config();
import { Pool } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';

const databaseUrl = process.env.DATABASE_URL;

function getBaseUrl() {
  return process.env.BETTER_AUTH_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function getSecret() {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV !== 'production') return 'dev-only-secret-change-in-production';
  throw new Error('BETTER_AUTH_SECRET is required in production.');
}

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  secret: getSecret(),
  database: databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined,
  emailAndPassword: {
    enabled: true,
  },
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
  },
});
