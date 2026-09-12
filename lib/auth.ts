import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";

const connectionString = process.env.DATABASE_URL;

function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function requireSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "development") return "dev-only-secret-change-in-production";
  throw new Error("Missing required environment variable: BETTER_AUTH_SECRET");
}

export const auth = betterAuth({
  baseURL: resolveBaseUrl(),
  secret: requireSecret(),

  // Falls back to no persistent auth (sign-in will error) until DATABASE_URL
  // is set — this only breaks auth specifically, not the rest of the app.
  database: connectionString ? new Pool({ connectionString }) : undefined,

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },

  // Vercel (and most reverse proxies) forward the real client IP in
  // `x-forwarded-for`. Without this, Better Auth can't resolve a per-client
  // IP and falls back to a single shared rate-limit bucket for everyone.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },
});
