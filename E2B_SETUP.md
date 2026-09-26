# E2B Agent Setup

RextFlex Ai Agent mode uses the Apex model for planning and executes project file creation/build commands inside an isolated E2B sandbox. E2B is an execution layer, not the language model. The JavaScript SDK uses `Sandbox.create()` with the `base` template and `Sandbox.connect()` for an existing project session. See E2B's current JavaScript SDK examples for the same lifecycle pattern.

## Railway variables

Add:

- `E2B_API_KEY` = your E2B API key
- `E2B_SANDBOX_TIMEOUT_MS` = `3600000` (one hour max on the supported hobby lifecycle)

Without `E2B_API_KEY`, the app falls back to the existing local workspace executor. Agent mode still works, but it is not isolated by E2B.

## Agent behavior

Agent mode is controlled from the keyboard composer. The visible app stays in chat mode while Apex runs in the background. The chat only shows progress such as `Creating App.jsx ✓` and does not expose raw terminal output.

## 3D

The 3D Studio uses Meshy's Image-to-3D and Text-to-3D APIs. Add `MESHY_API_KEY` to enable generation. Text-to-3D uses Meshy's preview/refine workflow; generated GLB files can be imported into the active project.
