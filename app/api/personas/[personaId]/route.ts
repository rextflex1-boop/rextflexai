import { deletePersona } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { personaId } = await params;
  await deletePersona(personaId, user.id);
  return Response.json({ ok: true });
}
