# RextFlex Ai — Railway Auth Setup

## Required Railway Variables
- `DATABASE_URL` — Neon/PostgreSQL connection string
- `BETTER_AUTH_URL=https://rextflexai.up.railway.app`
- `BETTER_AUTH_SECRET` — long random secret; keep stable across deployments

## Optional
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_DEBUG=1` only while diagnosing Better Auth; remove/disable after debugging.

The backend uses the standard `pg.Pool` driver for Better Auth and runs Better Auth's canonical migrations at startup. Custom RextFlex tables are also created idempotently.

Google sign-in is disabled in the UI when credentials are absent; email/password login remains available.


## PostgreSQL SSL configuration
Railway `DATABASE_URL` may still use `sslmode=require`; the application normalizes that value to `sslmode=verify-full` at runtime while preserving `channel_binding=require`. You do not need to put the database password into the repository or ZIP.
