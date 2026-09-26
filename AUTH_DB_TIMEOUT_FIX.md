# RextFlex Ai v7 — Better Auth DB timeout fix

Railway logs showed `AggregateError [ETIMEDOUT]` from `pg-pool` while Better Auth was loading a session. This release addresses that failure path.

Changes:
- Better Auth and application APIs share one PostgreSQL pool instead of creating two separate pools.
- Pool size/lifetime/idle/connection timeout settings are bounded and TCP keepalive is enabled.
- PostgreSQL channel binding is explicitly enabled for Neon URLs using `channel_binding=require`.
- Node DNS resolution prefers IPv4 first, avoiding long IPv6 connection stalls on runtimes without working IPv6 egress.
- Bearer-token application requests verify sessions directly against the shared database pool first, then fall back to Better Auth for cookie-based requests.
- Transient network errors (`ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, etc.) receive one short retry before failing.
- Email login no longer performs an immediate second Better Auth `getSession()` database read after a successful sign-in/sign-up response.
