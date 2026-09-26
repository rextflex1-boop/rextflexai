# RextFlex Ai v5 — First 5 Features

This build adds the first five priority capabilities requested for RextFlex Ai:

1. **RextFlex AI Agent** — plans tasks, writes real workspace files, can delete files, run approved build commands, and returns a live preview when it creates `index.html`.
2. **Live Coding Workspace** — Chat, Agent, Files, Terminal, Research and Preview modes share the same project/session.
3. **AI Website/App Builder** — the existing chat builder remains available, while Agent can create a multi-file project instead of only returning code in chat.
4. **Web Search + Deep Research** — searches public web results and can turn them into a cited research brief.
5. **File Upload + AI Analysis** — upload up to 8MB into the project workspace and analyze supported text/code files directly; with `GEMINI_API_KEY`, binary/PDF/image files can be analyzed with Gemini multimodal input.

Workspace files are persisted to PostgreSQL when `DATABASE_URL` is available, and mirrored to the local workspace directory for terminal operations.

Terminal commands are intentionally allowlisted for safety. The allowed commands are documented in the Terminal UI and enforced server-side.
