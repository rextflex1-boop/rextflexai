import { createHash, createHmac } from "node:crypto";

const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || "us-east-1";
const publicBaseUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");

export const s3Configured = Boolean(endpoint && accessKeyId && secretAccessKey && bucket);

function requireS3() {
  if (!s3Configured || !endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("S3-compatible storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET.");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket, region };
}

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Uint8Array | Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalKeyPath(key: string) {
  return key.split("/").filter(Boolean).map(awsEncode).join("/");
}

function encodeQuery(value: string) {
  return awsEncode(value);
}

function getBaseDate() {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, shortDate: amzDate.slice(0, 8) };
}

function signingKey(secret: string, shortDate: string, regionName: string, service: string) {
  const dateKey = hmac(`AWS4${secret}`, shortDate);
  const regionKey = hmac(dateKey, regionName);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function buildObjectUrl(base: string, bucketName: string, key: string) {
  return `${base}/${canonicalKeyPath(bucketName)}/${canonicalKeyPath(key)}`;
}

export async function putS3Object(params: { key: string; data: Uint8Array; contentType: string }) {
  const { endpoint: base, accessKeyId: access, secretAccessKey: secret, bucket: bucketName, region: regionName } = requireS3();
  const url = buildObjectUrl(base, bucketName, params.key);
  const parsed = new URL(url);
  const { amzDate, shortDate } = getBaseDate();
  const service = "s3";
  const payloadHash = sha256(params.data);
  const canonicalHeaders = [
    `content-type:${params.contentType}`,
    `host:${parsed.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", parsed.pathname, "", canonicalHeaders + "\n", signedHeaders, payloadHash].join("\n");
  const credentialScope = `${shortDate}/${regionName}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(secret, shortDate, regionName, service)).update(stringToSign).digest("hex");

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${access}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": params.contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: Buffer.from(params.data),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`S3-compatible upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return { key: params.key };
}

export function getPublicS3Url(key: string) {
  if (!publicBaseUrl) return null;
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function getS3ObjectUrl(key: string, expiresInSeconds = 604800) {
  const { endpoint: base, accessKeyId: access, secretAccessKey: secret, bucket: bucketName, region: regionName } = requireS3();
  const url = new URL(buildObjectUrl(base, bucketName, key));
  const { amzDate, shortDate } = getBaseDate();
  const service = "s3";
  const credentialScope = `${shortDate}/${regionName}/${service}/aws4_request`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${access}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(604800, Math.max(1, Math.floor(expiresInSeconds)))),
    "X-Amz-SignedHeaders": "host",
  };
  const query = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([keyName, value]) => `${encodeQuery(keyName)}=${encodeQuery(value)}`).join("&");
  const canonicalRequest = ["GET", url.pathname, query, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(secret, shortDate, regionName, service)).update(stringToSign).digest("hex");
  url.search = `${query}&X-Amz-Signature=${signature}`;
  return url.toString();
}

export function buildS3ObjectKey(prefix: "uploads" | "generated", userId: string, id: string, fileName?: string) {
  const safeName = (fileName ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${prefix}/${encodeURIComponent(userId)}/${encodeURIComponent(id)}/${safeName}`;
}
