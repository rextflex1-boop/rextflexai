import { MessageSquareOffIcon } from "lucide-react";
import { ChatMessage } from "@/components/chat/chat-message";
import { getPublicSession } from "@/lib/db";

export default async function SharedChatPage({
  params,
}: {
  readonly params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getPublicSession(sessionId);

  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center text-foreground">
        <MessageSquareOffIcon className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          This chat isn't shared (or doesn't exist).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 space-y-1 border-b pb-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">Shared chat</p>
        <h1 className="font-medium text-xl tracking-tight">{session.title || "Untitled chat"}</h1>
      </div>

      <div className="space-y-6">
        {session.messages.map((message) => (
          <ChatMessage isStreaming={false} key={message.id} message={message} />
        ))}
      </div>
    </main>
  );
}
