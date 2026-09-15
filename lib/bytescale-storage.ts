import * as Bytescale from "@bytescale/sdk";

const apiKey = process.env.NEXT_PUBLIC_BYTESCALE_API_KEY;

export const bytescaleConfigured = Boolean(apiKey);

export async function uploadBytescaleFile(params: {
  data: Buffer | Uint8Array;
  contentType: string;
  fileName: string;
}) {
  if (!apiKey) {
    throw new Error("Bytescale storage is not configured. Add NEXT_PUBLIC_BYTESCALE_API_KEY in Railway Variables.");
  }

  const uploadManager = new Bytescale.UploadManager({
    apiKey,
    fetchApi: fetch,
  });

  return uploadManager.upload({
    data: Buffer.from(params.data),
    mime: params.contentType,
    originalFileName: params.fileName,
  });
}
