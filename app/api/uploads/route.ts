import { nanoid } from "nanoid";
import { buildS3ObjectKey, getPublicS3Url, getS3ObjectUrl, putS3Object, s3Configured } from "@/lib/s3-storage";
import { getUserFromRequest } from "@/lib/session";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!s3Configured) return Response.json({ error: "S3-compatible storage is not configured on the server." }, { status: 503 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was provided." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File must be between 1 byte and 20 MB." }, { status: 413 });
  const mediaType = file.type || "application/octet-stream";
  if (!mediaType.startsWith("image/")) return Response.json({ error: "Feature 2 currently supports image uploads first (JPG, PNG, WEBP, GIF, etc.)." }, { status: 415 });
  const id = nanoid(18);
  const key = buildS3ObjectKey("uploads", user.id, id, file.name);
  await putS3Object({ contentType: mediaType, data: new Uint8Array(await file.arrayBuffer()), key });
  return Response.json({ fileName: file.name, key, mediaType, size: file.size, url: getPublicS3Url(key) ?? getS3ObjectUrl(key, 604800) });
}
