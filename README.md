# Remotion Stock Generator

MVP for a browser-based stock video generator.

## Current flow

SVG upload → Remotion Player preview → client-side Remotion render → MP4 download.

The first version intentionally uses Remotion client-side rendering, so no render server or API key is required. Remotion documents this capability through `@remotion/web-renderer`.

## Roadmap

1. SVG animation presets
2. Transparent WebM / VP8 / VP9 output
3. 4K presets
4. Parameter controls and deterministic seeds
5. Render queue
6. 2–3 concurrent jobs when infrastructure supports it
7. Optional cloud rendering for heavier jobs
8. Stock-safe batch workflows

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
