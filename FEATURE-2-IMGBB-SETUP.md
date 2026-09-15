# RextFlex AI — Feature 2 Upload Storage

## Photos / Camera
- Images are uploaded through the server route `/api/uploads`.
- The server keeps `IMGBB_API_KEY` private and sends the image to ImgBB.
- The attachment is added to chat only after ImgBB returns a hosted URL, so the chip cannot remain stuck on `Uploading…`.

## Files
- General files are uploaded with the Bytescale Upload Widget.
- Put the public Bytescale key in `NEXT_PUBLIC_BYTESCALE_API_KEY`.
- The attachment is added to chat only after Bytescale reports the upload as complete.

## Generated files
- Generated ZIP files use the Bytescale JavaScript SDK with the same public upload-capable key.
- No Railway S3 Bucket or S3 environment variables are required by this feature.

## Railway Variables
```
IMGBB_API_KEY=your_imgbb_key
NEXT_PUBLIC_BYTESCALE_API_KEY=public_your_bytescale_key
```

Never paste the ImgBB secret API key into client-side code. The Bytescale key must be a `public_*` key for browser uploads.
