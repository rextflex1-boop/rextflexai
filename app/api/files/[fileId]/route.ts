import { getGeneratedFile } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { fileId } = await params;
  const file = await getGeneratedFile(fileId, user.id);
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      "Content-Length": String(file.data.length),
      "Content-Type": file.mimeType,
    },
  });
}
