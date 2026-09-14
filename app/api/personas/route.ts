import { nanoid } from "nanoid";
import { createPersona, getActivePersonaId, listPersonas } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [personas, activePersonaId] = await Promise.all([
    listPersonas(user.id),
    getActivePersonaId(user.id),
  ]);
  return Response.json({ activePersonaId: activePersonaId ?? null, personas });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { instructions, name }: { instructions?: string; name?: string } = await req.json();
  if (!name?.trim() || !instructions?.trim()) {
    return Response.json({ error: "Name and instructions are required." }, { status: 400 });
  }

  const id = nanoid(10);
  await createPersona(id, user.id, name, instructions);
  return Response.json({ id });
}
