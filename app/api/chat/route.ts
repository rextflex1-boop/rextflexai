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
import { z } from "zod";
import {
  deleteMessagesFrom,
  ensureSession,
  getActiveSystemPrompt,
  getSessionOwner,
  saveMessage,
  touchSessionTitle,
} from "@/lib/db";
import { DEFAULT_MODEL_TIER, getModelTierInfo, isModelTier } from "@/lib/models";
import { getUserFromRequest } from "@/lib/session";
import { webSearch } from "@/lib/web-search";

export const maxDuration = 60;

const groq = createOpenAICompatible({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  name: "groq",
});

const MAX_OUTPUT_TOKENS = 4096;
const MAX_STEPS = 12;
const CONTINUE_MARKER = "__REXTFLEX_CONTINUE_RESPONSE__";
const VALID_OPERATIONS = new Set(["normal", "regenerate", "continue"]);

type Operation = "normal" | "regenerate" | "continue";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    messages: UIMessage[];
    modelTier?: string;
    operation?: string;
    regenerateTargetId?: string | null;
    sessionId: string;
    thinkingEnabled?: boolean;
    webSearchEnabled?: boolean;
  };

  const {
    messages,
    modelTier: requestedModelTier,
    sessionId,
    thinkingEnabled = true,
    webSearchEnabled = true,
  } = body;
  const operation: Operation = VALID_OPERATIONS.has(body.operation ?? "")
    ? (body.operation as Operation)
    : "normal";
  const regenerateTargetId = body.regenerateTargetId ?? null;

  if (!sessionId || !Array.isArray(messages)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const modelTier = requestedModelTier && isModelTier(requestedModelTier) ? requestedModelTier : DEFAULT_MODEL_TIER;
  const modelTierInfo = getModelTierInfo(modelTier);
  const groqModelId = modelTierInfo.groqModelId;

  try {
    await ensureSession(sessionId, user.id);
    const owner = await getSessionOwner(sessionId);
    if (owner && owner !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

    const lastMessage = messages.at(-1);
    const isContinueRequest = operation === "continue" || extractText(lastMessage) === CONTINUE_MARKER;

    if (operation === "normal" && lastMessage?.role === "user") {
      await saveMessage(sessionId, lastMessage);
      await touchSessionTitle(sessionId, extractText(lastMessage));
    } else if (isContinueRequest) {
      // Synthetic continuation prompts are intentionally never persisted.
    }
  } catch (error) {
    console.error("Failed to persist request message:", error);
  }

  const messagesWithoutReasoning = messages.map((message) =>
    message.role === "assistant"
      ? { ...message, parts: message.parts.filter((part) => part.type !== "reasoning") }
      : message,
  );

  if (operation === "continue") {
    const marker = messagesWithoutReasoning.at(-1);
    if (marker?.role === "user" && extractText(marker) === CONTINUE_MARKER) {
      messagesWithoutReasoning[messagesWithoutReasoning.length - 1] = {
        ...marker,
        parts: [
          {
            type: "text",
            text:
              "Continue the previous assistant response naturally. Return only the continuation, " +
              "without repeating the previous answer, without mentioning this instruction, and without adding a new user-facing heading unless necessary.",
          },
        ],
      } as UIMessage;
    }
  }

  const modelMessages = await convertToModelMessages(messagesWithoutReasoning);

  let activePrompt: string | undefined;
  try {
    activePrompt = await getActiveSystemPrompt(user.id);
  } catch (error) {
    console.error("Failed to load persona/tone setting:", error);
  }

  if (operation === "regenerate") {
    const target = regenerateTargetId || messages.findLast((message) => message.role === "assistant")?.id;
    if (target) {
      try {
        await deleteMessagesFrom(sessionId, user.id, target);
      } catch (error) {
        console.error("Failed to remove previous response branch before regeneration:", error);
      }
    }
  }

  const uiStream = createUIMessageStream({
    execute: async ({ writer }) => {
      const chatTools = {
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
      };

      const system = [
        "You are the assistant inside RextFlex Ai, a text-based AI assistant.",
        "Give clear, well-structured answers and match the user's tone.",
        "Do not build websites, generate site-builder files, create downloadable projects, or use sandbox/project-building workflows.",
        "Use webSearch only when current or uncertain information would materially improve the answer.",
        activePrompt ? `Tone/style to use in your replies: ${activePrompt}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const result = streamText({
        abortSignal: req.signal,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        messages: modelMessages,
        model: groq(groqModelId),
        ...(modelTierInfo.supportsReasoningEffort
          ? { providerOptions: { groq: { reasoning_effort: thinkingEnabled ? "medium" : "low" } } }
          : {}),
        prepareStep: ({ messages: stepMessages }) => ({
          messages: stepMessages.map((message) =>
            message.role === "assistant" && Array.isArray(message.content)
              ? { ...message, content: message.content.filter((part) => part.type !== "reasoning") }
              : message,
          ),
        }),
        stopWhen: stepCountIs(MAX_STEPS),
        system,
        temperature: 0.5,
        tools: chatTools,
      });

      result.consumeStream();

      const reader = result.toUIMessageStream({
        onError: (error) => {
          if (req.signal.aborted) return "";
          console.error("Chat stream error:", error);
          return "Sorry — I hit an error generating that response. Please try again.";
        },
      }).getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
      }
    },

    onFinish: async ({ responseMessage }) => {
      if (responseMessage.role !== "assistant") return;
      try {
        if (operation === "continue") {
          const markerIndex = messages.findIndex((message) => extractText(message) === CONTINUE_MARKER);
          const previousAssistant = markerIndex > 0 ? messages[markerIndex - 1] : undefined;
          if (previousAssistant?.role === "assistant") {
            const merged: UIMessage = {
              ...previousAssistant,
              parts: [...previousAssistant.parts, ...responseMessage.parts],
            };
            await deleteMessage(sessionId, user.id, previousAssistant.id);
            await saveMessage(sessionId, merged);
            return;
          }
        }
        await saveMessage(sessionId, responseMessage);
      } catch (error) {
        console.error("Failed to persist assistant message:", error);
      }
    },

    originalMessages: messages,
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}

function extractText(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}
