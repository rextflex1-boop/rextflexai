"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircleIcon, DownloadIcon, PaperclipIcon, PlusIcon, RotateCcwIcon, StopCircleIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationTopFade,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { DEFAULT_MODEL_TIER, isModelTier, type ModelTier } from "@/lib/models";
import { cn } from "@/lib/utils";
import { AttachSheet } from "./attach-sheet";
import { AttachmentChips } from "./attachment-chips";
import { ChatMessage } from "./chat-message";
import { ModelPickerButton } from "./model-picker";
import { Sidebar } from "./sidebar";
import { VoiceButton } from "./voice-button";

const APP_NAME = "RextFlex Ai";

export type ChatUser = {
  readonly email: string;
  readonly image?: string;
  readonly name: string;
};

/**
 * Standalone chat UI, no eve. Talks to your own backend at /api/chat (see
 * app/api/chat/route.ts), which persists to Neon. Gated behind auth — see
 * app/page.tsx.
 */
export function RextflexChat({
  initialMessages,
  sessionId: sessionIdProp,
  user,
}: {
  readonly initialMessages?: UIMessage[];
  readonly sessionId?: string;
  readonly user: ChatUser;
}) {
  const [sessionId] = useState(() => sessionIdProp ?? nanoid(12));
  const [hasNavigated, setHasNavigated] = useState(Boolean(sessionIdProp));
  const [hasInputText, setHasInputText] = useState(false);
  const [modelTier, setModelTierState] = useState<ModelTier>(DEFAULT_MODEL_TIER);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [temporaryChat, setTemporaryChat] = useState(false);
  const modelTierRef = useRef(modelTier);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  const thinkingEnabledRef = useRef(thinkingEnabled);
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          modelTier: modelTierRef.current,
          sessionId,
          thinkingEnabled: thinkingEnabledRef.current,
          webSearchEnabled: webSearchEnabledRef.current,
          temporaryChat,
        }),
      }),
  );
  const { error, messages, regenerate, sendMessage, setMessages, status, stop } = useChat({
    messages: initialMessages,
    transport,
  });

  // Loads the user's last-picked model tier once on mount, so the picker
  // shows the right thing immediately instead of always starting at the
  // default until Settings happens to be opened.
  useEffect(() => {
    const handleInsertPrompt = (event: Event) => {
      const custom = event as CustomEvent<string>;
      const prompt = custom.detail?.trim();
      if (!prompt) return;
      const textarea = document.querySelector<HTMLTextAreaElement>("[data-slot='input-group-control']");
      if (!textarea) return;
      textarea.value = textarea.value ? `${textarea.value} ${prompt}` : prompt;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
      setHasInputText(true);
    };
    window.addEventListener("rextflex:insert-prompt", handleInsertPrompt);
    return () => window.removeEventListener("rextflex:insert-prompt", handleInsertPrompt);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const stats = JSON.parse(localStorage.getItem("rextflex:usage") || "{}");
      const userCount = messages.filter((m) => m.role === "user").length;
      const assistantCount = messages.filter((m) => m.role === "assistant").length;
      localStorage.setItem("rextflex:usage", JSON.stringify({
        userMessages: userCount,
        assistantMessages: assistantCount,
        lastUpdated: Date.now(),
        totalChars: messages.reduce((sum, m) => sum + m.parts.reduce((n, part) => n + (part.type === "text" ? part.text.length : 0), 0), 0),
        ...stats,
      }));
    } catch {}
  }, [messages]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { modelTier?: string }) => {
        if (data.modelTier && isModelTier(data.modelTier)) setModelTierState(data.modelTier);
      })
      .catch(() => {
        // Best-effort — falls back to the default tier.
      });
  }, []);

  const updateModelTier = (tier: ModelTier) => {
    setModelTierState(tier);
    modelTierRef.current = tier;
    fetch("/api/settings", {
      body: JSON.stringify({ modelTier: tier }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    }).catch(() => {
      // Best-effort — the picker already reflects the choice locally.
    });
  };

  const updateWebSearchEnabled = (enabled: boolean) => {
    setWebSearchEnabled(enabled);
    webSearchEnabledRef.current = enabled;
  };

  const updateThinkingEnabled = (enabled: boolean) => {
    setThinkingEnabled(enabled);
    thinkingEnabledRef.current = enabled;
  };

  const isBusy = status === "submitted" || status === "streaming";

  const exportChat = (format: "json" | "md") => {
    const title = document.title || APP_NAME;
    const payload = format === "json"
      ? JSON.stringify({ title, sessionId, messages }, null, 2)
      : messages.map((message) => `## ${message.role === "user" ? "You" : "RextFlex Ai"}\n\n${message.parts.map((part) => part.type === "text" ? part.text : "").join("\n")}`).join("\n\n");
    const blob = new Blob([payload], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "chat"}.${format === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phones suspend the tab's JS (and often abort the in-flight request)
  // when the browser is backgrounded, which used to make a reply vanish.
  // The server keeps generating regardless (see consumeStream() in
  // app/api/chat/route.ts), so when you come back we just re-fetch this
  // session's saved messages and catch the UI up if it fell behind.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || isBusy) return;

      fetch(`/api/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data: { messages?: UIMessage[] }) => {
          if (data.messages && data.messages.length > messages.length) {
            setMessages(data.messages);
          }
        })
        .catch(() => {
          // Best-effort — just leave whatever's currently shown.
        });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isBusy, messages.length, sessionId, setMessages]);

  const isEmpty = messages.length === 0;
  const hasConversationContent = !isEmpty || error !== undefined;
  const lastMessage = messages.at(-1);
  const canRegenerate = status === "ready" && lastMessage?.role === "assistant";

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (text.length === 0 && message.files.length === 0) return;

    setHasInputText(false);

    if (!hasNavigated) {
      setHasNavigated(true);
      // Next patches window.history to navigate, which would detach the
      // active stream if we used the router — so we bypass it here.
      History.prototype.replaceState.call(
        window.history,
        window.history.state,
        "",
        `/s/${sessionId}`,
      );
    }

    await sendMessage({
      files: message.files,
      text,
    });
  };

  const composer = (
    <PromptInput globalDrop maxFiles={4} maxFileSize={10 * 1024 * 1024} multiple onSubmit={handleSubmit}>
      <AttachmentChips />
      <PromptInputTextarea
        onChange={(event) => setHasInputText(event.currentTarget.value.trim().length > 0)}
        placeholder="Send a message…"
      />
      <PromptInputTools className="justify-between px-1 pb-1">
        <div className="flex items-center gap-1">
          <AttachButton onClick={() => setAttachSheetOpen(true)} />
          <VoiceButton
            onTranscript={(text) => {
              setHasInputText(true);
              // Let PromptInputTextarea's own value stay the source of truth —
              // simplest is to just append via the DOM-driven onChange state
              // we already track; the textarea itself is uncontrolled here,
              // so we set it directly.
              const textarea = document.querySelector<HTMLTextAreaElement>(
                "[data-slot='input-group-control']",
              );
              if (textarea) {
                textarea.value = textarea.value ? `${textarea.value} ${text}` : text;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
              }
            }}
          />
          <ModelPickerButton onChange={updateModelTier} value={modelTier} />
        </div>
        <div className="flex items-center gap-1">
        {hasConversationContent ? (
          <Button aria-label="Export chat as Markdown" onClick={() => exportChat("md")} size="icon-sm" type="button" variant="ghost">
            <DownloadIcon className="size-4" />
          </Button>
        ) : null}
        <PromptInputSubmit disabled={!hasInputText && !isBusy} onStop={stop} status={status} />
      </div>
      </PromptInputTools>
      <AttachSheet
        onOpenChange={setAttachSheetOpen}
        onThinkingChange={updateThinkingEnabled}
        onWebSearchChange={updateWebSearchEnabled}
        open={attachSheetOpen}
        thinkingEnabled={thinkingEnabled}
        webSearchEnabled={webSearchEnabled}
        temporaryChat={temporaryChat}
        onTemporaryChatChange={setTemporaryChat}
      />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Sidebar activeSessionId={sessionId} user={user} />

      {hasConversationContent ? <ChatHeader /> : null}

      {hasConversationContent ? (
        <Conversation className="min-h-0 flex-1">
          <ConversationTopFade className="top-14" />
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pt-20 pb-36 sm:px-6">
            {messages.map((message, index) => (
              <ChatMessage
                isStreaming={status === "streaming" && index === messages.length - 1}
                key={message.id}
                message={message}
                onEdit={message.role === "user" && status === "ready" ? async () => {
                  const currentText = message.parts.map((part) => part.type === "text" ? part.text : "").join("\n").trim();
                  const edited = window.prompt("Edit your message", currentText);
                  if (!edited || edited.trim() === currentText) return;
                  const messageIndex = messages.findIndex((item) => item.id === message.id);
                  if (messageIndex < 0) return;
                  setMessages(messages.slice(0, messageIndex));
                  await sendMessage({ text: edited.trim() });
                } : undefined}
              />
            ))}
            {error ? <ErrorMessage message={error.message} /> : null}
            {canRegenerate ? (
              <button
                className="flex w-fit items-center gap-1.5 rounded-md px-1 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => regenerate()}
                type="button"
              >
                <RotateCcwIcon className="size-3.5" />
                Regenerate
              </button>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : null}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          hasConversationContent
            ? "fixed bottom-0 left-1/2 z-20 max-w-3xl -translate-x-1/2 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-6"
            : "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]",
        )}
      >
        {hasConversationContent ? null : (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{APP_NAME}</h1>
          </div>
        )}
        <div className="w-full">{composer}</div>
      </div>
    </main>
  );
}

function AttachButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <PromptInputButton onClick={onClick} tooltip="Add to chat" type="button">
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}

function ErrorMessage({ message }: { readonly message: string }) {
  return (
    <Message className="max-w-full" from="assistant">
      <MessageContent>
        <div
          className="flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
          role="alert"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Request failed</p>
            <p className="mt-0.5 text-muted-foreground">{message}</p>
          </div>
        </div>
      </MessageContent>
    </Message>
  );
}

function ChatHeader() {
  return (
    <header className="pointer-events-none fixed top-0 right-0 left-0 z-20 h-14">
      <div className="relative mx-auto flex h-full w-full max-w-3xl items-center justify-center bg-background px-24">
        <span className="truncate text-muted-foreground text-sm">{APP_NAME}</span>
        <Button
          aria-label="Start a new chat"
          className="pointer-events-auto fixed top-3 right-6 pr-4"
          onClick={() => window.location.assign("/")}
          size="sm"
          type="button"
          variant="ghost"
        >
          <PlusIcon className="size-4" />
          <span className="hidden font-normal text-sm sm:inline">New chat</span>
        </Button>
      </div>
    </header>
  );
}
