# RextFlex Ai — Apex Agent + E2B + 3D Studio

This release keeps the production authentication/database foundation and turns the workspace into a chat-first AI builder.

## UX changes

- The chat composer now has a `+` button for uploads, project files, web research, and 3D creation.
- Agent is controlled by a single keyboard toggle: `Agent ON/OFF`.
- Agent mode always uses **Apex**.
- Terminal is no longer exposed as a visible mode. Commands run in the background and the chat shows concise progress such as `Creating src/App.jsx ✓`.
- Live coding/build work happens in the background; the user stays in the chat.

## Agent execution

When `E2B_API_KEY` is configured, Apex uses an E2B isolated sandbox for project file creation and build commands. The active sandbox ID is associated with the user's chat project so the project workspace can be resumed across requests. E2B's current JavaScript SDK supports `Sandbox.create()` for new sandboxes, `Sandbox.connect()` to resume an existing sandbox, `sandbox.files.write()` for files, and `sandbox.commands.run()` for shell commands. See the included `E2B_SETUP.md`.

Without `E2B_API_KEY`, the app falls back to its existing local workspace executor.

## 3D Studio

`+` → `Image / Text → 3D` opens the 3D Studio.

- Image → 3D generates a GLB model from a PNG/JPEG input.
- Text → 3D generates a mesh, then runs the texture/refine stage automatically.
- The generated GLB can be previewed in-browser, downloaded, or imported into the current project.
- Set `MESHY_API_KEY` to enable the Meshy generation routes.

## Railway variables

Required:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GROQ_API_KEY`

Recommended for the new agent workflow:
- `E2B_API_KEY`

Optional:
- `E2B_SANDBOX_TIMEOUT_MS`
- `MESHY_API_KEY`
- `GEMINI_API_KEY`
- `POLLINATIONS_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Models

- Silicon → Groq `openai/gpt-oss-20b`
- Titan → Groq `openai/gpt-oss-120b`
- Apex → Pollinations `qwen-coder`

Agent mode intentionally overrides the selected chat model and uses Apex.
