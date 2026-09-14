import { getModelTier, getTone, setModelTier, setTone } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";
import { isModelTier } from "@/lib/models";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [tone, modelTier] = await Promise.all([getTone(user.id), getModelTier(user.id)]);
  return Response.json({ modelTier: modelTier ?? "titan", tone: tone ?? "" });
}

export async function PUT(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { modelTier, tone }: { modelTier?: string; tone?: string } = await req.json();

  const updates: Promise<void>[] = [];
  if (tone !== undefined) updates.push(setTone(user.id, tone));
  if (modelTier !== undefined && isModelTier(modelTier)) updates.push(setModelTier(user.id, modelTier));
  await Promise.all(updates);

  return Response.json({ ok: true });
}
