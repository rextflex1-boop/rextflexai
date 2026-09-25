# RextFlex Ai — Railway Auth Setup

## Required Railway Variables

Set these on the `production` environment:

```text
BETTER_AUTH_SECRET=<long-random-secret>
BETTER_AUTH_URL=https://rextflexai.up.railway.app
DATABASE_URL=<your Neon PostgreSQL connection string>
GROQ_API_KEY=<your Groq key>
```

## Optional Google OAuth

Google sign-in is enabled only when both variables are present:

```text
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
```

Google callback URL:

```text
https://rextflexai.up.railway.app/api/auth/callback/google
```

When the Google variables are missing, the login screen disables the Google button instead of sending a request that produces `Provider not found`.

## Database

The server now checks and creates/repairs the Better Auth core tables and the RextFlex app tables during startup. This is idempotent and runs before the HTTP server begins accepting requests.

## After deploying

1. Open the Railway deployment.
2. Wait until the log shows `Database schema verified.` and `RextFlex Ai running on http://0.0.0.0:<port>`.
3. In the browser, clear the old RextFlex auth token/cookies by signing out or using a fresh private tab.
4. Use Email Login/Signup for the first verification. Enable Google OAuth variables separately when you are ready to use Google sign-in.
