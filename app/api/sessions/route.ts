import { listSessions } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await listSessions(user.id);
  return Response.json({ sessions });
}
