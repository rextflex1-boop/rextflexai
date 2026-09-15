import { deleteSession, getSessionMessages, renameSession, setSessionPublic } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const messages = await getSessionMessages(sessionId, user.id);
  return Response.json({ messages });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const { isPublic, title }: { isPublic?: boolean; title?: string } = await req.json();

  if (typeof isPublic === "boolean") {
    await setSessionPublic(sessionId, user.id, isPublic);
  }

  if (title && title.trim().length > 0) {
    await renameSession(sessionId, user.id, title);
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  await deleteSession(sessionId, user.id);
  return Response.json({ ok: true });
}
