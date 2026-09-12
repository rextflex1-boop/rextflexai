import { RextflexChat } from "@/components/chat/rextflex-chat";
import { getSessionMessages } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const initialMessages = await getSessionMessages(sessionId, user.id);

  return (
    <RextflexChat
      initialMessages={initialMessages}
      sessionId={sessionId}
      user={{ email: user.email, image: user.image ?? undefined, name: user.name }}
    />
  );
}
