"use client";

import type { UIMessage } from "ai";
import { CheckIcon, DownloadIcon, ExternalLinkIcon, FileIcon, GlobeIcon, ImageIcon, LoaderIcon, PencilIcon } from "lucide-react";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

type GenericToolPart = Extract<UIMessage["parts"][number], { type: `tool-${string}` }>;

type BuildProjectOutput =
  | { ok: true; downloadUrl: string; fileName: string; sizeBytes: number; log?: string }
  | { ok: false; error: string; log?: string };

type WriteFileOutput = { ok: true; path: string } | { ok: false; error: string };

type WebSearchResultItem = { title: string; url: string; snippet: string };
type WebSearchOutput = { results: WebSearchResultItem[]; note?: string } | { error: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Grabs the last non-empty line of in-progress reasoning text, trimmed to a
 * headline length, so the collapsed "thinking" trigger can show a live,
 * changing one-liner instead of a static "Thinking…" label while streaming.
 */
function liveReasoningHeadline(text: string): string | undefined {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const lastLine = lines.at(-1);
  if (!lastLine) return undefined;
  return lastLine.length > 70 ? `${lastLine.slice(0, 70)}…` : lastLine;
}

/**
 * Renders one chat message, walking its `parts` array (the standard AI SDK
 * UIMessage shape). Add new part types here as you add features.
 */
export function ChatMessage({
  isStreaming,
  message,
}: {
  readonly isStreaming: boolean;
  readonly message: UIMessage;
  readonly onEdit?: () => void;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => (
          <MessagePart
            key={`${message.id}-${part.type}-${index}`}
            part={part}
            showCaret={isStreaming && index === lastTextIndex}
          />
        ))}
      </MessageContent>
      {message.role === "user" && onEdit ? (
        <button
          aria-label="Edit and resend message"
          className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
          onClick={onEdit}
          type="button"
        >
          <PencilIcon className="size-3" /> Edit
        </button>
      ) : null}
    </Message>
  );
}

function MessagePart({
  part,
  showCaret,
}: {
  readonly part: UIMessage["parts"][number];
  readonly showCaret: boolean;
}) {
  switch (part.type) {
    case "step-start":
      return null;

    case "text":
      return (
        <MessageResponse caret="block" isAnimating={showCaret}>
          {part.text}
        </MessageResponse>
      );

    case "reasoning": {
      const isStreamingReasoning = part.state === "streaming";
      const liveHeadline = isStreamingReasoning ? liveReasoningHeadline(part.text) : undefined;

      return (
        <Reasoning defaultOpen isStreaming={isStreamingReasoning}>
          <ReasoningTrigger
            getThinkingMessage={(streaming, duration) =>
              streaming ? (
                <Shimmer duration={1.2}>{liveHeadline ?? "Thinking…"}</Shimmer>
              ) : (
                <p>Thought for {duration ?? "a few"} seconds</p>
              )
            }
          />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    }

    case "file": {
      const label = part.filename ?? "Attachment";
      const isImage = part.mediaType?.startsWith("image/") && part.url !== undefined;
      const Icon = isImage ? ImageIcon : FileIcon;

      return (
        <a
          className="flex max-w-sm items-center gap-3 rounded-md border bg-background/60 p-2 text-sm"
          href={part.url}
          rel="noreferrer"
          target="_blank"
        >
          {isImage ? (
            <img alt={label} className="size-12 shrink-0 rounded-sm object-cover" src={part.url} />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{label}</span>
          </span>
          <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
        </a>
      );
    }

    case "tool-finishBuild": {
      const buildPart = part as GenericToolPart;
      const output =
        buildPart.state === "output-available" ? (buildPart.output as BuildProjectOutput) : undefined;

      return (
        <div className="flex flex-col gap-2">
          <Tool defaultOpen={!output?.ok}>
            <ToolHeader state={buildPart.state} title="Build project" type={buildPart.type} />
            <ToolContent>
              <ToolInput input={buildPart.input} />
              <ToolOutput errorText={buildPart.errorText} output={buildPart.output} />
            </ToolContent>
          </Tool>
          {output?.ok && output.downloadUrl && (
            <a
              className="flex max-w-sm items-center gap-3 rounded-md border bg-background/60 p-2 text-sm"
              download
              href={output.downloadUrl}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                <DownloadIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{output.fileName ?? "project.zip"}</span>
                {typeof output.sizeBytes === "number" && (
                  <span className="block text-xs text-muted-foreground">{formatBytes(output.sizeBytes)}</span>
                )}
              </span>
              <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
            </a>
          )}
        </div>
      );
    }

    // One writeFile call per file means several of these per build — kept
    // to a single quiet line each (not a full collapsible card) so a
    // multi-file build doesn't turn into a wall of identical-looking tools.
    case "tool-writeFile": {
      const writePart = part as GenericToolPart;
      const input = writePart.input as { path?: string } | undefined;
      const output = writePart.state === "output-available" ? (writePart.output as WriteFileOutput) : undefined;
      const errorMessage = output && !output.ok ? output.error : undefined;
      const path = input?.path ?? (output && output.ok ? output.path : undefined) ?? "file";

      return (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {writePart.state === "output-available" ? (
            errorMessage ? (
              <span className="text-destructive">✕</span>
            ) : (
              <CheckIcon className="size-3 shrink-0" />
            )
          ) : (
            <LoaderIcon className="size-3 shrink-0 animate-spin" />
          )}
          <span className="truncate font-mono">{path}</span>
          {errorMessage && <span className="truncate text-destructive">— {errorMessage}</span>}
        </div>
      );
    }

    case "tool-webSearch": {
      const searchPart = part as GenericToolPart;
      const input = searchPart.input as { query?: string } | undefined;
      const output =
        searchPart.state === "output-available" ? (searchPart.output as WebSearchOutput) : undefined;
      const results = output && "results" in output ? output.results : undefined;
      const errorText =
        searchPart.errorText ?? (output && "error" in output ? output.error : undefined);

      return (
        <Tool defaultOpen={false}>
          <ToolHeader
            state={searchPart.state}
            title={input?.query ? `Searched for "${input.query}"` : "Web search"}
            type={searchPart.type}
          />
          <ToolContent>
            {results && results.length > 0 ? (
              <div className="flex flex-col gap-2 p-1">
                {results.map((result, i) => (
                  <a
                    className="flex flex-col gap-0.5 rounded-md border bg-background/60 p-2 text-sm hover:bg-background"
                    href={result.url}
                    key={`${result.url}-${i}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground text-xs">
                      <GlobeIcon className="size-3 shrink-0" />
                      {hostnameOf(result.url)}
                    </span>
                    <span className="truncate font-medium">{result.title}</span>
                    {result.snippet && (
                      <span className="line-clamp-2 text-muted-foreground text-xs">{result.snippet}</span>
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <ToolOutput errorText={errorText} output={searchPart.output} />
            )}
          </ToolContent>
        </Tool>
      );
    }

    case "dynamic-tool":
      return (
        <Tool>
          <ToolHeader state={part.state} title={part.toolName} toolName={part.toolName} type="dynamic-tool" />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolOutput errorText={part.errorText} output={part.output} />
          </ToolContent>
        </Tool>
      );

    default:
      // Typed tool parts show up as "tool-<yourToolName>" once you add tools
      // on the server (see app/api/chat/route.ts). Render them generically.
      if (part.type.startsWith("tool-")) {
        const toolPart = part as GenericToolPart;
        return (
          <Tool>
            <ToolHeader state={toolPart.state} title={part.type.slice(5)} type={toolPart.type} />
            <ToolContent>
              <ToolInput input={toolPart.input} />
              <ToolOutput errorText={toolPart.errorText} output={toolPart.output} />
            </ToolContent>
          </Tool>
        );
      }
      return null;
  }
}
