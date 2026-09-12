import { Sandbox } from "e2b";

export type BuildProjectResult =
  | {
      readonly ok: true;
      readonly fileName: string;
      readonly sizeBytes: number;
      readonly zipBytes: Uint8Array;
      readonly log: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly log: string;
    };

// Keep both limits conservative: E2B bills per second the sandbox is alive,
// and the zip ends up stored as a bytea row in Postgres (see
// generated_files in db/schema.sql) then streamed back on download — huge
// files make both of those slow and expensive.
const MAX_ZIP_BYTES = 8 * 1024 * 1024; // 8MB
// A build session can now span several model round-trips (one writeFile
// call per file, then one finishBuild call), not a single tool call, so it
// needs more headroom than a single-shot build did.
const SANDBOX_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes total sandbox lifetime
const COMMAND_TIMEOUT_MS = 90 * 1000; // per setup command
const PROJECT_DIR = "/home/user/project";
const ZIP_PATH = "/home/user/project.zip";

// If a build session is abandoned (the model never calls finishBuild — e.g.
// it errored out, or the user's request didn't actually need a build), this
// is how long its sandbox is allowed to sit idle before we kill it and free
// the slot. E2B will also auto-expire it on its own after SANDBOX_TIMEOUT_MS
// regardless, this just cleans up our bookkeeping Map sooner.
const SESSION_IDLE_MS = 10 * 60 * 1000;

type BuildSession = {
  sandbox: Sandbox;
  lastUsed: number;
  logs: string[];
};

// One build can now be spread across several tool calls (writeFile ×N, then
// finishBuild) within the same assistant turn. Rather than creating a new
// sandbox per file (slow, and loses everything written so far), each build
// gets a short-lived entry here — keyed by a per-request id the route
// generates once per turn — so every call in that turn reuses the same
// sandbox. Cleared as soon as finishBuild runs, or reaped if abandoned.
const sessions = new Map<string, BuildSession>();

function reapStaleSessions(exceptId?: string): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (id === exceptId) continue;
    if (now - session.lastUsed > SESSION_IDLE_MS) {
      sessions.delete(id);
      session.sandbox.kill().catch((error) => console.error("Failed to kill stale sandbox:", error));
    }
  }
}

async function getOrCreateSession(buildId: string): Promise<BuildSession> {
  reapStaleSessions(buildId);

  const existing = sessions.get(buildId);
  if (existing) {
    existing.lastUsed = Date.now();
    // Extend the sandbox's own kill timer so a build with many files (many
    // model round-trips) doesn't get cut off mid-way through.
    await existing.sandbox.setTimeout(SANDBOX_TIMEOUT_MS).catch((error) => {
      console.error("Failed to extend sandbox timeout:", error);
    });
    return existing;
  }

  const sandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });
  const session: BuildSession = { lastUsed: Date.now(), logs: [], sandbox };
  sessions.set(buildId, session);
  return session;
}

/** Kills and forgets a build session, if one exists. Always safe to call. */
export function resetBuildSession(buildId: string): void {
  const session = sessions.get(buildId);
  sessions.delete(buildId);
  if (session) {
    session.sandbox.kill().catch((error) => console.error("Failed to kill sandbox:", error));
  }
}

/**
 * Writes a single file into this build's sandbox, creating the sandbox on
 * first call. Meant to be called once per file — small, focused calls are
 * far less likely to trip up a model's JSON generation than one call
 * carrying every file's content at once.
 */
export async function writeSandboxFile({
  buildId,
  path,
  content,
}: {
  readonly buildId: string;
  readonly path: string;
  readonly content: string;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!process.env.E2B_API_KEY) {
    return { error: "E2B_API_KEY is not configured on the server.", ok: false };
  }

  try {
    const session = await getOrCreateSession(buildId);
    const normalizedPath = `${PROJECT_DIR}/${path.replace(/^\/+/, "")}`;
    await session.sandbox.files.write([{ data: content, path: normalizedPath }]);
    session.logs.push(`Wrote ${path}`);
    return { ok: true, path };
  } catch (error) {
    console.error("writeSandboxFile failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to write file.", ok: false };
  }
}

/**
 * Runs setup commands (if any) against a build's existing sandbox, zips the
 * result, and returns the zip bytes. Always ends the session — success or
 * failure — so nothing is left running (and billing) in the background.
 * Fails clearly if writeSandboxFile was never called first for this buildId.
 */
export async function finishSandboxBuild({
  buildId,
  setupCommands = [],
  zipName = "project.zip",
  onTick,
}: {
  readonly buildId: string;
  readonly setupCommands?: readonly string[];
  readonly zipName?: string;
  /** Called roughly every 20s while setup commands run — a hook for the
   * caller to keep a streaming connection alive during a slow npm install. */
  readonly onTick?: (elapsedSeconds: number) => void;
}): Promise<BuildProjectResult> {
  if (!process.env.E2B_API_KEY) {
    return { error: "E2B_API_KEY is not configured on the server.", log: "", ok: false };
  }

  const session = sessions.get(buildId);
  if (!session) {
    return {
      error: "No files have been written yet for this build — call writeFile at least once before finishBuild.",
      log: "",
      ok: false,
    };
  }
  session.lastUsed = Date.now();
  const { sandbox, logs } = session;

  let elapsedSeconds = 0;
  const heartbeat = onTick
    ? setInterval(() => {
        elapsedSeconds += 20;
        onTick(elapsedSeconds);
      }, 20_000)
    : undefined;

  try {
    // Nothing runs here beyond what's explicitly listed — no forced Node
    // bootstrap, no implicit "npm install". If the model asks for a plain
    // zip with no commands, this loop simply doesn't run anything.
    for (const command of setupCommands.slice(0, 6)) {
      const ok = await runShell(sandbox, `cd ${PROJECT_DIR} && ${command}`, logs, command);
      if (!ok) {
        // Don't hard-abort on a failed setup command — still zip whatever
        // exists so the user can see partial output/errors, but flag it.
        logs.push(`⚠️ "${command}" failed — continuing anyway so you can see what was produced.`);
      }
    }

    // Try, in order: system `zip`, python3's stdlib zipfile, python's, then
    // sudo-install zip as a last resort. Each attempt echoes clearly which
    // path was taken (or that all of them failed and why).
    const zipScriptPath = "/home/user/_zip_helper.py";
    const zipRunnerPath = "/home/user/_zip_helper.sh";
    await sandbox.files.write([
      { data: PYTHON_ZIP_SCRIPT, path: zipScriptPath },
      { data: ZIP_RUNNER_SCRIPT(zipScriptPath), path: zipRunnerPath },
    ]);
    await runShell(sandbox, `bash ${zipRunnerPath}`, logs, "zip project");

    const info = await sandbox.files.getInfo(ZIP_PATH).catch(() => undefined);
    if (!info) {
      return { error: "Zipping failed — no archive was produced.", log: logs.join("\n\n"), ok: false };
    }
    if (info.size > MAX_ZIP_BYTES) {
      return {
        error:
          `The built project is ${(info.size / 1024 / 1024).toFixed(1)}MB, over the ` +
          `${MAX_ZIP_BYTES / 1024 / 1024}MB limit. Exclude large/generated folders and try again.`,
        log: logs.join("\n\n"),
        ok: false,
      };
    }

    const zipBytes = (await sandbox.files.read(ZIP_PATH, { format: "bytes" })) as Uint8Array;
    return { fileName: zipName, log: logs.join("\n\n"), ok: true, sizeBytes: zipBytes.length, zipBytes };
  } catch (error) {
    console.error("finishSandboxBuild failed:", error);
    return {
      error: error instanceof Error ? error.message : "Sandbox build failed.",
      log: logs.join("\n\n"),
      ok: false,
    };
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    resetBuildSession(buildId);
  }
}

// Pure-stdlib zip — no external `zip` binary or apt install required.
const PYTHON_ZIP_SCRIPT = `import os, zipfile
src = "${PROJECT_DIR}"
dst = "${ZIP_PATH}"
exclude = {"node_modules", ".git"}
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in exclude]
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, src)
            zf.write(full, rel)
print("zipped ok")
`;

// Bash script: try each zip strategy in order, echoing which one is used
// (or exactly why all of them failed) so the log is self-diagnosing.
const ZIP_RUNNER_SCRIPT = (pyScriptPath: string) => `#!/bin/bash
cd "${PROJECT_DIR}" || exit 1
rm -f "${ZIP_PATH}"

if command -v zip >/dev/null 2>&1; then
  echo "zip-method: system zip binary"
  zip -rq "${ZIP_PATH}" . -x "node_modules/*" -x ".git/*"
elif command -v python3 >/dev/null 2>&1; then
  echo "zip-method: python3 zipfile"
  python3 "${pyScriptPath}"
elif command -v python >/dev/null 2>&1; then
  echo "zip-method: python zipfile"
  python "${pyScriptPath}"
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  echo "zip-method: sudo apt-get install zip"
  sudo apt-get update -qq && sudo apt-get install -y -qq zip && zip -rq "${ZIP_PATH}" . -x "node_modules/*" -x ".git/*"
else
  echo "zip-method: none available — no zip binary, no python3/python, no passwordless sudo"
  exit 1
fi
`;

async function runShell(sandbox: Sandbox, command: string, logs: string[], label: string): Promise<boolean> {
  try {
    const result = await sandbox.commands.run(command, { timeoutMs: COMMAND_TIMEOUT_MS });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    logs.push(`$ ${label}${output ? `\n${truncate(output, 2000)}` : ""}`);
    return (result.exitCode ?? 0) === 0;
  } catch (error) {
    logs.push(`$ ${label}\n${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n… (truncated)` : text;
}
