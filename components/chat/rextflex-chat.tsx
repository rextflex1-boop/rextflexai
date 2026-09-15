"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircleIcon, PaperclipIcon, PlusIcon, XIcon } from "lucide-react";
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
import { GenerationStatus } from "./generation-status";
import { ModelPickerButton } from "./model-picker";
import { Sidebar } from "./sidebar";
import { VoiceButton } from "./voice-button";

const APP_NAME = "RextFlex Ai";
const CONTINUE_MARKER = "__REXTFLEX_CONTINUE_RESPONSE__";
const OPERATION_NORMAL = "normal";
const OPERATION_REGENERATE = "regenerate";
const OPERATION_CONTINUE = "continue";

type ChatOperation = typeof OPERATION_NORMAL | typeof OPERATION_REGENERATE | typeof OPERATION_CONTINUE;

export type ChatUser = {
  readonly email: string;
  readonly image?: string;
  readonly name: string;
};

function extractMessageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

function mergeAssistantMessages(base: UIMessage, continuation: UIMessage): UIMessage {
  return {
    ...base,
    id: base.id,
    parts: [...base.parts, ...continuation.parts],
  };
}

function isContinueMarker(message: UIMessage | undefined): boolean {
  return Boolean(message?.role === "user" && extractMessageText(message) === CONTINUE_MARKER);
}

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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editLabelVisible, setEditLabelVisible] = useState(false);
  const modelTierRef = useRef(modelTier);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  const thinkingEnabledRef = useRef(thinkingEnabled);
  const operationRef = useRef<ChatOperation>(OPERATION_NORMAL);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingRegenerateRef = useRef(false);
  const pendingEditTextRef = useRef<string | null>(null);
  const regenerateTargetIdRef = useRef<string | null>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          modelTier: modelTierRef.current,
          operation: operationRef.current,
          regenerateTargetId: regenerateTargetIdRef.current,
          sessionId,
          thinkingEnabled: thinkingEnabledRef.current,
          webSearchEnabled: webSearchEnabledRef.current,
        }),
      }),
  );

  const {
    error,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { modelTier?: string }) => {
        if (data.modelTier && isModelTier(data.modelTier)) setModelTierState(data.modelTier);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;

    if (pendingRegenerateRef.current) {
      pendingRegenerateRef.current = false;
      operationRef.current = OPERATION_REGENERATE;
      Promise.resolve(regenerate()).finally(() => {
        operationRef.current = OPERATION_NORMAL;
        regenerateTargetIdRef.current = null;
      });
      return;
    }

    const editText = pendingEditTextRef.current;
    if (editText !== null) {
      pendingEditTextRef.current = null;
      operationRef.current = OPERATION_NORMAL;
      Promise.resolve(sendMessage({ text: editText })).finally(() => {
        operationRef.current = OPERATION_NORMAL;
      });
    }
  }, [messages, regenerate, sendMessage, status]);

  useEffect(() => {
    if (status !== "ready") return;
    const markerIndex = messages.findIndex(isContinueMarker);
    if (markerIndex < 0) return;

    const previous = messages[markerIndex - 1];
    const generated = messages[markerIndex + 1];
    if (previous?.role !== "assistant" || generated?.role !== "assistant") return;

    const merged = mergeAssistantMessages(previous, generated);
    setMessages([...messages.slice(0, markerIndex - 1), merged, ...messages.slice(markerIndex + 2)]);
  }, [messages, setMessages, status]);

  const updateModelTier = (tier: ModelTier) => {
    setModelTierState(tier);
    modelTierRef.current = tier;
    fetch("/api/settings", {
      body: JSON.stringify({ modelTier: tier }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    }).catch(() => undefined);
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || isBusy) return;
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data: { messages?: UIMessage[] }) => {
          if (data.messages && data.messages.length > messages.length) setMessages(data.messages);
        })
        .catch(() => undefined);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isBusy, messages.length, sessionId, setMessages]);

  const isEmpty = messages.length === 0;
  const hasConversationContent = !isEmpty || error !== undefined || editingMessageId !== null;
  const lastMessage = messages.at(-1);

  const setComposerText = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.value = text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    setHasInputText(text.trim().length > 0);
    textarea.focus();
  };

  const clearComposerText = () => setComposerText("");

  const handleEdit = async (message: UIMessage) => {
    if (isBusy) return;
    const text = extractMessageText(message);
    if (!text) return;

    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        body: JSON.stringify({ messageId: message.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to prepare the message for editing.");
    } catch (editError) {
      console.error("Failed to edit message:", editError);
      return;
    }

    pendingEditTextRef.current = text;
    setMessages(messages.slice(0, index));
    setEditingMessageId(message.id);
    setEditLabelVisible(true);
    setComposerText(text);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditLabelVisible(false);
    clearComposerText();
  };

  const handleRegenerate = (message: UIMessage) => {
    if (isBusy) return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    if (message.role !== "assistant") return;

    regenerateTargetIdRef.current = message.id;
    setMessages(messages.slice(0, index));
    pendingRegenerateRef.current = true;
  };

  const handleContinue = (message: UIMessage) => {
    if (isBusy || message.role !== "assistant") return;
    operationRef.current = OPERATION_CONTINUE;
    Promise.resolve(sendMessage({ text: CONTINUE_MARKER })).finally(() => {
      operationRef.current = OPERATION_NORMAL;
    });
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (text.length === 0 && message.files.length === 0) return;

    setHasInputText(false);
    setEditingMessageId(null);
    setEditLabelVisible(false);

    if (!hasNavigated) {
      setHasNavigated(true);
      History.prototype.replaceState.call(window.history, window.history.state, "", `/s/${sessionId}`);
    }

    try {
      await sendMessage({ files: message.files, text });
    } finally {
      operationRef.current = OPERATION_NORMAL;
    }
  };

  const composer = (
    <div className="w-full">
      {editLabelVisible ? (
        <div className="mb-2 flex items-center justify-between rounded-lg border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <span className="font-medium text-foreground">Editing message</span>
          <button
            aria-label="Cancel edit"
            className="rounded-md p-1 hover:bg-muted hover:text-foreground"
            onClick={cancelEdit}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ) : null}
      <PromptInput maxFiles={4} maxFileSize={10 * 1024 * 1024} multiple onSubmit={handleSubmit}>
        <AttachmentChips />
        <PromptInputTextarea
          onChange={(event) => setHasInputText(event.currentTarget.value.trim().length > 0)}
          placeholder={editingMessageId ? "Edit your message…" : "Send a message…"}
          ref={textareaRef}
        />
        <PromptInputTools className="justify-between px-1 pb-1">
          <div className="flex items-center gap-1">
            <AttachButton onClick={() => setAttachSheetOpen(true)} />
            <VoiceButton
              onTranscript={(text) => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                const next = textarea.value ? `${textarea.value} ${text}` : text;
                textarea.value = next;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
                setHasInputText(true);
              }}
            />
            <ModelPickerButton onChange={updateModelTier} value={modelTier} />
          </div>
          <PromptInputSubmit
            disabled={!hasInputText && !isBusy}
            onStop={stop}
            status={status}
          />
        </PromptInputTools>
        <AttachSheet
          onOpenChange={setAttachSheetOpen}
          onThinkingChange={updateThinkingEnabled}
          onWebSearchChange={updateWebSearchEnabled}
          open={attachSheetOpen}
          thinkingEnabled={thinkingEnabled}
          webSearchEnabled={webSearchEnabled}
        />
      </PromptInput>
    </div>
  );

  const visibleMessages = messages.filter((message) => !isContinueMarker(message));
  const continuationMarkerIndex = messages.findIndex(isContinueMarker);
  const continuationPending = continuationMarkerIndex >= 0 && continuationMarkerIndex + 1 < messages.length;

  const continuationBase = continuationPending
    ? messages[continuationMarkerIndex - 1]
    : undefined;
  const continuationGenerated = continuationPending
    ? messages[continuationMarkerIndex + 1]
    : undefined;
  const continuationGeneratedId = continuationGenerated?.id;

  const renderedMessages = visibleMessages
    .filter((message) => message.id !== continuationGeneratedId)
    .map((message) => {
      const originalIndex = messages.findIndex((item) => item.id === message.id);
      const isContinuationBase =
        continuationBase?.id === message.id &&
        continuationBase.role === "assistant" &&
        continuationGenerated?.role === "assistant";
      const renderMessage = isContinuationBase
        ? mergeAssistantMessages(message, continuationGenerated)
        : message;
      return {
        message: renderMessage,
        isStreaming: status === "streaming" && (originalIndex === messages.length - 1 || isContinuationBase),
      };
    });

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Sidebar activeSessionId={sessionId} user={user} />

      {hasConversationContent ? <ChatHeader /> : null}

      {hasConversationContent ? (
        <Conversation className="min-h-0 flex-1">
          <ConversationTopFade className="top-14" />
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pt-20 pb-36 sm:px-6">
            {renderedMessages.map(({ isStreaming, message }) => (
              <ChatMessage
                isStreaming={isStreaming}
                key={message.id}
                message={message}
                onContinue={handleContinue}
                onEdit={handleEdit}
                onRegenerate={handleRegenerate}
              />
            ))}
            {error && status === "error" ? <ErrorMessage message={error.message} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : null}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          hasConversationContent
            ? "fixed bottom-0 left-1/2 z-20 max-w-3xl -translate-x-1/2 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            : "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]",
        )}
      >
        {hasConversationContent ? null : (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{APP_NAME}</h1>
          </div>
        )}
        {hasConversationContent && isBusy ? (
          <div className="mb-2 flex justify-center">
            <GenerationStatus message={lastMessage} status={status} />
          </div>
        ) : null}
        {hasConversationContent && status === "error" && !error ? null : null}
        {hasConversationContent && status === "ready" && error ? null : null}
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
