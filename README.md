# RextFlex Ai — Premium UI + Real Backend

This version keeps the premium Vite/React UI and connects it to real production-style services.

## Railway environment variables

Required:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GROQ_API_KEY`

Optional:
- `POLLINATIONS_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Database

Run `db.sql` once in the Neon SQL editor before first use.

## Models

- Silicon → Groq `openai/gpt-oss-20b`
- Titan → Groq `openai/gpt-oss-120b`
- Apex → Pollinations `qwen-coder`

## Google OAuth

Set the callback URL in Google Cloud Console to:
`<BETTER_AUTH_URL>/api/auth/callback/google`

The app no longer uses demo/fake login responses or fake local-storage identities.
