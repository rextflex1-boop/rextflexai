# Feature 2 — ImgBB image upload

RextFlex sends user-selected images to the server first. The server then uploads the image to ImgBB, returns the hosted image URL, and the chat message uses that URL as its image part.

## Railway Variables

Add this variable to the **RextFlex production service**:

```text
IMGBB_API_KEY=your_imgbb_api_key
```

Do not use a `NEXT_PUBLIC_` prefix. The key stays server-side.

Generated AI ZIP/files continue to use the existing S3-compatible storage variables because ImgBB is an image-hosting API, not a general file/object store.
