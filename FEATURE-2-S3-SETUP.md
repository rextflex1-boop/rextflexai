# Feature 2 — Image Upload + S3-compatible Object Storage

RextFlex runs on Railway, while uploaded and generated files live in an S3-compatible object store. No new database table is needed for file bytes.

## Railway Variables

Add these to your Railway service under **Variables**:

```text
S3_ENDPOINT=<your provider S3 endpoint>
S3_ACCESS_KEY_ID=<your access key>
S3_SECRET_ACCESS_KEY=<your secret key>
S3_BUCKET=rextflexai
S3_REGION=<your provider region, e.g. us-east-1>
S3_PUBLIC_URL=
```

Leave `S3_PUBLIC_URL` blank to keep objects private and let RextFlex return time-limited signed URLs.

## AWS S3 example

1. Create an S3 bucket named `rextflexai` (or another name).
2. Create an IAM user/access key with read/write object access limited to that bucket.
3. For a bucket in `us-east-1`, use `https://s3.us-east-1.amazonaws.com` as `S3_ENDPOINT` and `us-east-1` as `S3_REGION`.
4. Add the five variables above to Railway.
5. Redeploy the Railway service.

The implementation uses AWS Signature Version 4 and is intentionally provider-agnostic: any S3-compatible service can be used by changing the endpoint, credentials, bucket, and region.

## App behavior

- Large images are compressed in the browser before upload when appropriate.
- `/api/uploads` stores the optimized image in object storage.
- The AI receives the stored/signed image URL instead of the original large browser payload.
- AI-generated ZIP files from the existing build tool are stored in the same object store and returned as signed download URLs.
- There is no Cloudflare-specific dependency or environment variable.
