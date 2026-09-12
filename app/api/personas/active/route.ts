import { setActivePersona } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function PUT(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { personaId }: { personaId: string | null } = await req.json();
  await setActivePersona(user.id, personaId);
  return Response.json({ ok: true });
}
