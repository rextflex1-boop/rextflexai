import { getUserFromRequest } from "@/lib/session";

export const runtime = "nodejs";

// ImgBB accepts uploads up to 32 MB. Keep the app's own limit a little lower
// so unusually large mobile photos are rejected before they reach the provider.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ImgBB image storage is not configured on the server. Add IMGBB_API_KEY in Railway Variables." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No image was provided." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Image must be between 1 byte and 20 MB." }, { status: 413 });
  }

  const mediaType = file.type || "application/octet-stream";
  if (!mediaType.startsWith("image/")) {
    return Response.json({ error: "Only image uploads are supported here (JPG, PNG, WEBP, GIF, etc.)." }, { status: 415 });
  }

  // Keep the API key server-side. ImgBB's API accepts multipart/form-data and
  // a binary `image` part, so the browser never needs the secret key.
  const uploadForm = new FormData();
  uploadForm.append("image", file, file.name || "image");
  uploadForm.append("name", file.name || "image");

  try {
    const response = await fetch(`${IMGBB_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      body: uploadForm,
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          error?: { message?: string };
          data?: {
            url?: string;
            display_url?: string;
            delete_url?: string;
            image?: { url?: string; mime?: string };
          };
        }
      | null;

    if (!response.ok || !payload?.success || !payload.data?.url) {
      const providerMessage = payload?.error?.message;
      throw new Error(providerMessage || `ImgBB upload failed (${response.status}).`);
    }

    return Response.json({
      fileName: file.name,
      mediaType: payload.data.image?.mime ?? mediaType,
      size: file.size,
      url: payload.data.url,
      displayUrl: payload.data.display_url ?? payload.data.url,
      deleteUrl: payload.data.delete_url ?? null,
      storage: "imgbb",
    });
  } catch (error) {
    console.error("ImgBB upload failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Image upload failed. Please try again." },
      { status: 502 },
    );
  }
}
