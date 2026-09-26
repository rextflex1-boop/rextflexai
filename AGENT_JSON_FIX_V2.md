# Agent JSON Fix v2

## Production issue fixed
Railway was reporting `POST /api/agent/run Error: Agent returned invalid JSON` for Apex.

## Changes
- Apex/Pollinations requests now use OpenAI-compatible `response_format: { type: "json_object" }` when JSON mode is requested.
- JSON-mode temperature is lowered to 0.15 for more deterministic agent planning.
- The parser now repairs common model formatting errors such as literal newlines/tabs inside JSON strings, smart quotes, and trailing commas.
- Agent repair now has a second minimal salvage pass if the first strict repair still fails.
- Agent instructions explicitly forbid markdown/code fences around JSON and require JSON escaping.
- Existing direct-HTML salvage remains available for website-builder responses.

## Verification
- TypeScript source transpilation: PASS using TypeScript 7 `transpileModule`.
- Agent parser tests: PASS for raw JSON, fenced JSON, extra prose, trailing commas, literal newlines, and smart quotes.
- No secrets were added to the source package.
- Full npm install/production build was not available in this sandbox because npm registry access timed out.
