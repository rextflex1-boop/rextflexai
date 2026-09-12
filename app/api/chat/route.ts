import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ensureSession, getActiveSystemPrompt, getSessionOwner, saveGeneratedFile, saveMessage, touchSessionTitle } from "@/lib/db";
import { DEFAULT_MODEL_TIER, getModelTierInfo, isModelTier } from "@/lib/models";
import { finishSandboxBuild, resetBuildSession, writeSandboxFile } from "@/lib/sandbox";
import { getUserFromRequest } from "@/lib/session";
import { webSearch } from "@/lib/web-search";

// Vercel Hobby plan caps a serverless function at 60s UNLESS you turn on
// "Fluid Compute" in the project's Vercel settings (free, still on Hobby),
// which raises the cap to 300s. If a reply takes longer than this number,
// Vercel kills the connection mid-stream and the answer just stops — that's
// almost certainly why replies were getting cut off partway through. If you
// enable Fluid Compute, you can safely raise this to e.g. 120–180.
export const maxDuration = 60;

// Groq's OpenAI-compatible API. Get a key (no card needed for Silicon/Titan —
// Apex is metered, see lib/models.ts): https://console.groq.com/keys
const groq = createOpenAICompatible({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  name: "groq",
});

// Groq's free tier is tight on tokens-per-minute for the free models (6,000
// TPM for openai/gpt-oss-120b) even though the daily request count is
// generous — keeping output shorter avoids a single long reply blowing the
// per-minute token budget by itself.
const MAX_OUTPUT_TOKENS = 4096;

// Upper bound on how many tool-call/response round-trips one reply can take.
// A build now happens as one writeFile call per file plus one final
// finishBuild call, instead of a single call carrying every file at once —
// this needs enough steps for a small multi-file project, plus normal
// webSearch usage, plus some headroom.
const MAX_STEPS = 20;

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    messages,
    modelTier: requestedModelTier,
    sessionId,
    thinkingEnabled = true,
    webSearchEnabled = true,
  }: {
    messages: UIMessage[];
    modelTier?: string;
    sessionId: string;
    thinkingEnabled?: boolean;
    webSearchEnabled?: boolean;
  } = await req.json();

  const modelTier = requestedModelTier && isModelTier(requestedModelTier) ? requestedModelTier : DEFAULT_MODEL_TIER;
  const modelTierInfo = getModelTierInfo(modelTier);
  const groqModelId = modelTierInfo.groqModelId;

  // Make sure this session belongs to the signed-in user before touching it.
  try {
    await ensureSession(sessionId, user.id);
    const owner = await getSessionOwner(sessionId);
    if (owner && owner !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "user") {
      await saveMessage(sessionId, lastMessage);
      await touchSessionTitle(sessionId, extractText(lastMessage));
    }
  } catch (error) {
    console.error("Failed to persist user message:", error);
  }

  // Groq's API rejects a `reasoning_content` field on assistant messages in
  // the conversation history (400: "property 'reasoning_content' is
  // unsupported") — but that's exactly what the AI SDK's openai-compatible
  // provider sends back for any prior turn that included reasoning output
  // (gpt-oss-120b is a reasoning model). We don't need that reasoning replayed
  // to the model anyway, so strip it from history before converting.
  const messagesWithoutReasoning = messages.map((message) =>
    message.role === "assistant"
      ? { ...message, parts: message.parts.filter((part) => part.type !== "reasoning") }
      : message,
  );

  // In this "ai" package version, convertToModelMessages returns a Promise
  // (it can resolve file parts asynchronously), so it must be awaited before
  // being handed to streamText.
  const modelMessages = await convertToModelMessages(messagesWithoutReasoning);

  let activePrompt: string | undefined;
  try {
    activePrompt = await getActiveSystemPrompt(user.id);
  } catch (error) {
    console.error("Failed to load persona/tone setting:", error);
  }

  // The whole response is built through createUIMessageStream (rather than
  // streamText(...).toUIMessageStreamResponse()) so that finishBuild — which
  // can sit silent for a minute or more while the sandbox runs npm
  // install/build — can access `writer` and emit periodic heartbeat chunks.
  // Railway's edge proxy drops a connection after ~60s with no bytes sent
  // (see docs.railway.com/networking/public-networking/specs-and-limits);
  // without a heartbeat, any build that quietly runs longer than that gets
  // its connection killed mid-request, which is what shows up in the
  // browser as "This page couldn't load".
  const uiStream = createUIMessageStream({
    execute: async ({ writer }) => {
      // One id per reply, shared by every writeFile/finishBuild call within
      // it (even across several tool-call steps) so they all land in the
      // same sandbox. Not tied to the chat's sessionId — a build is scoped
      // to a single reply, not the whole conversation.
      const buildId = nanoid();

      // Tools available to the model. Defined here (inside execute, after
      // sessionId/user/writer/buildId are known) rather than at module scope
      // so they can close over this request's state and the stream writer.
      const chatTools = {
        finishBuild: tool({
          description:
            "Call this once, after all writeFile calls are done, to actually run any " +
            "setup commands, zip everything written so far, and get a download link. " +
            "For a plain file/code drop with no run step, still call this with no " +
            "setupCommands — it just zips what's there. The sandbox is a bare Debian " +
            "environment with nothing preinstalled, so if the project needs npm, " +
            "include a Node install command first, e.g. 'curl -fsSL " +
            "https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs', " +
            "before 'npm install'/'npm run build'.",
          execute: async ({
            setupCommands,
            zipName,
          }: {
            setupCommands?: string[];
            zipName?: string;
          }) => {
            const result = await finishSandboxBuild({
              buildId,
              onTick: (elapsedSeconds) => {
                // Heartbeat: a harmless custom data chunk every ~20s while
                // setup commands run. The frontend doesn't render this type
                // (unknown "data-*" parts fall through to null — see
                // components/chat/chat-message.tsx), but the bytes going
                // over the wire are exactly what keeps Railway's proxy from
                // treating the connection as idle and killing it.
                try {
                  writer.write({
                    data: { message: `Still building… (${elapsedSeconds}s)` },
                    transient: true,
                    type: "data-buildStatus",
                  });
                } catch (error) {
                  console.error("Heartbeat write failed:", error);
                }
              },
              setupCommands,
              zipName,
            });

            if (!result.ok) {
              return { error: result.error, log: result.log, ok: false };
            }

            try {
              const fileId = nanoid(16);
              await saveGeneratedFile({
                data: result.zipBytes,
                fileName: result.fileName,
                id: fileId,
                mimeType: "application/zip",
                sessionId,
                userId: user.id,
              });
              return {
                downloadUrl: `/api/files/${fileId}`,
                fileName: result.fileName,
                log: result.log,
                ok: true,
                sizeBytes: result.sizeBytes,
              };
            } catch (error) {
              console.error("Failed to persist generated file:", error);
              return { error: "Built the project but failed to save the download.", log: result.log, ok: false };
            }
          },
          inputSchema: z.object({
            setupCommands: z
              .array(z.string())
              .max(6)
              .optional()
              .describe("Shell commands to run in order before zipping, e.g. ['npm install', 'npm run build']"),
            zipName: z.string().optional().describe("Download file name, e.g. 'my-app.zip'"),
          }),
        }),

        // Only registered when the user has the Web search toggle on (see
        // the "Add to chat" sheet) — a disabled tool just isn't offered to
        // the model at all, rather than being offered and told not to use it.
        ...(webSearchEnabled
          ? {
              webSearch: tool({
                description:
                  "Search the web for current information. Use for recent events, facts you're unsure about, or anything that could have changed.",
                execute: async ({ query }: { query: string }) => {
                  try {
                    const results = await webSearch(query);
                    if (results.length === 0) {
                      return { note: "No results found — try a different phrasing.", results: [] };
                    }
                    return { results };
                  } catch (error) {
                    console.error("Web search failed:", error);
                    return { error: "Search failed. Try again, or answer from what you already know." };
                  }
                },
                inputSchema: z.object({
                  query: z.string().describe("The search query"),
                }),
              }),
            }
          : {}),

        writeFile: tool({
          description:
            "Write ONE file into this reply's sandbox project. Call this once per file — " +
            "keep each call to a single file's content rather than batching many files " +
            "into one call, since a smaller call is much less likely to produce broken " +
            "JSON. After all files are written, call finishBuild once to zip everything " +
            "and get a download link.",
          execute: async ({ path, content }: { path: string; content: string }) => {
            const result = await writeSandboxFile({ buildId, content, path });
            return result;
          },
          inputSchema: z.object({
            content: z.string().describe("Full text content of the file"),
            path: z.string().describe("Relative path, e.g. 'src/index.js' or 'package.json'"),
          }),
        }),
      };

      const baseSystemLines = [
        "You are the assistant inside RextFlex Ai — a helpful, direct AI chat assistant.",
        "Give clear, well-structured answers and match the user's tone.",
        "Use the webSearch tool for anything time-sensitive, recent, or that you're" +
          " not confident about — don't guess when you can check." +
          " For anything the user wants to actually run or download (code, a small app," +
          " a project), write it into the sandbox with the writeFile tool — one call per" +
          " file — then call finishBuild once at the end to zip it and get a download" +
          " link. Don't just print code blocks for anything meant to run.",
        activePrompt ? `Tone/style to use in your replies: ${activePrompt}.` : "",
      ];

      // Groq's model occasionally emits malformed JSON for a tool call —
      // this got much rarer once big multi-file builds were split into one
      // writeFile call per file, but it can still happen (e.g. one very
      // large single file, or webSearch). Retry once with a lower
      // temperature and no fixed seed (a retry with the same seed can just
      // regenerate the exact same broken JSON) before giving up and telling
      // the user plainly what happened.
      const MAX_ATTEMPTS = 2;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        let sawToolJsonError = false;
        const isFinalAttempt = attempt === MAX_ATTEMPTS;

        if (attempt > 1) {
          // Clear out anything a failed attempt partially wrote, so a
          // retry starts from a clean sandbox instead of mixing leftover
          // files from the broken attempt into the new one.
          resetBuildSession(buildId);
        }

        const result = streamText({
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          messages: modelMessages,
          model: groq(groqModelId),

          onError: ({ error }) => {
            console.error(`streamText error (attempt ${attempt}):`, error);
          },

          // The Thinking toggle (see the "Add to chat" sheet) only applies
          // to gpt-oss tiers (Silicon/Titan) — Groq documents reasoning_effort
          // as safe for those. Apex (Qwen) uses a different, unconfirmed
          // mechanism for this on Groq, so it's left alone rather than
          // risking a rejected request over an unsupported field.
          ...(modelTierInfo.supportsReasoningEffort
            ? { providerOptions: { groq: { reasoning_effort: thinkingEnabled ? "medium" : "low" } } }
            : {}),

          // Only the first attempt is seeded, so a retry isn't forced to
          // reproduce the exact same output (and the exact same bug).
          ...(attempt === 1 ? { seed: 0 } : {}),

          // Strips reasoning content from messages before EVERY step of this
          // request's tool-calling loop (not just cross-turn history — see
          // messagesWithoutReasoning above). Multi-step tool calling
          // (stopWhen) feeds each step's own assistant output back in as
          // input for the next step, and Groq rejects reasoning_content on
          // ANY assistant message, including one this same request just
          // generated a moment ago.
          prepareStep: ({ messages: stepMessages }) => ({
            messages: stepMessages.map((message) =>
              message.role === "assistant" && Array.isArray(message.content)
                ? { ...message, content: message.content.filter((part) => part.type !== "reasoning") }
                : message,
            ),
          }),

          stopWhen: stepCountIs(MAX_STEPS),

          system: [
            ...baseSystemLines,
            attempt > 1
              ? "Your previous attempt produced invalid tool-call JSON and failed. This " +
                "time, keep any single file's content shorter and simpler, and be careful " +
                "to properly escape quotes and special characters inside file content."
              : "",
          ]
            .filter(Boolean)
            .join(" "),

          temperature: attempt === 1 ? 0.5 : 0.3,

          tools: chatTools,
        });

        // Keep the model generating (and the DB save inside onFinish)
        // running even if the client disconnects — e.g. the phone's
        // browser gets backgrounded mid-reply and the fetch gets cut off.
        // Without this, an abandoned connection can stop generation early
        // and nothing gets saved.
        result.consumeStream();

        const reader = result
          .toUIMessageStream({
            onError: (error) => {
              const message = error instanceof Error ? error.message : String(error);
              if (/tool_use_failed|parse tool call arguments/i.test(message)) {
                sawToolJsonError = true;
              }
              console.error(`Chat stream error (attempt ${attempt}):`, error);
              return isFinalAttempt || !sawToolJsonError
                ? "Sorry — I hit a formatting error generating that. Try asking for" +
                  " something a bit simpler, or fewer files at once."
                : message;
            },
          })
          .getReader();

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          writer.write(value);
        }

        if (!sawToolJsonError) break; // success, or a different error we've already surfaced

        if (!isFinalAttempt) {
          writer.write({ id: `retry-note-${attempt}`, type: "text-start" });
          writer.write({
            delta: "\n\n_That attempt hit a formatting hiccup — retrying with a simpler pass…_\n\n",
            id: `retry-note-${attempt}`,
            type: "text-delta",
          });
          writer.write({ id: `retry-note-${attempt}`, type: "text-end" });
        }
      }

      // Safety net: if the loop above ended without ever calling
      // finishBuild (model gave up, or the final attempt still failed),
      // don't leave a billed sandbox running in the background.
      resetBuildSession(buildId);
    },

    onFinish: async ({ responseMessage }) => {
      try {
        if (responseMessage.role === "assistant") {
          await saveMessage(sessionId, responseMessage);
        }
      } catch (error) {
        console.error("Failed to persist assistant message:", error);
      }
    },

    originalMessages: messages,
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}

function extractText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}
