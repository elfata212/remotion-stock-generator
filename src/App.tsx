import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import {
  STOCK_DURATION,
  STOCK_FPS,
  STOCK_HEIGHT,
  STOCK_WIDTH,
  StockVideo,
  type StockVideoProps,
} from "./video/StockVideo";

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <defs><linearGradient id="g" x1="0" x2="1">
    <stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#60a5fa"/>
  </linearGradient></defs>
  <circle cx="300" cy="200" r="118" fill="none" stroke="url(#g)" stroke-width="10"/>
  <circle cx="180" cy="110" r="24" fill="#5eead4"/><circle cx="420" cy="110" r="24" fill="#60a5fa"/>
  <circle cx="180" cy="290" r="24" fill="#60a5fa"/><circle cx="420" cy="290" r="24" fill="#5eead4"/>
  <g stroke="#94a3b8" stroke-width="6" opacity=".75">
    <path d="M198 122 L282 182"/><path d="M402 122 L318 182"/>
    <path d="M198 278 L282 218"/><path d="M402 278 L318 218"/>
  </g>
</svg>`;

const dataUrl = (text: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Asset could not be decoded."));
    img.src = src;
  });

const removeNearWhiteBackground = async (src: string) => {
  const image = await loadImage(src);
  const naturalWidth = image.naturalWidth || 1600;
  const naturalHeight = image.naturalHeight || 900;
  const maxDimension = 4096;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable.");

  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  const { data } = pixels;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  // Distance from pure white. 42 allows white / near-white paper-like backgrounds,
  // while the flood-fill constraint prevents interior white details from being removed.
  const nearWhite = (index: number) => {
    if (data[index + 3] < 8) return true;
    const distance = Math.max(
      255 - data[index],
      255 - data[index + 1],
      255 - data[index + 2],
    );
    return distance <= 42;
  };

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p] || !nearWhite(p * 4)) return;
    visited[p] = 1;
    queue[tail++] = p;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = Math.floor(p / width);
    data[p * 4 + 3] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
};

export default function App() {
  const [source, setSource] = useState(dataUrl(DEFAULT_SVG));
  const [assetSrc, setAssetSrc] = useState(dataUrl(DEFAULT_SVG));
  const [assetName, setAssetName] = useState("default-network.svg");
  const [removeWhite, setRemoveWhite] = useState(false);
  const [background, setBackground] = useState<"transparent" | "#0b1020" | "#ffffff">("transparent");
  const [resolution, setResolution] = useState("1280x720");
  const [duration, setDuration] = useState(5);
  const [fps, setFps] = useState(30);
  const [output, setOutput] = useState<"mp4" | "alpha">("mp4");
  const [status, setStatus] = useState("Ready");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [alphaPreview, setAlphaPreview] = useState(false);

  const [width, height] = resolution.split("x").map(Number);
  const durationInFrames = duration * fps;
  const alpha = output === "alpha";
  const effectiveBackground = alpha ? null : background;
  const props: StockVideoProps = {
    src: assetSrc,
    background: effectiveBackground,
    transparent: alpha,
  };

  useEffect(() => {
    let cancelled = false;
    setPreparing(true);

    const prepared = removeWhite
      ? removeNearWhiteBackground(source)
      : Promise.resolve(source);

    prepared
      .then((value) => {
        if (!cancelled) {
          setAssetSrc(value);
          setStatus(removeWhite ? "Background removed — alpha preview ready" : "Asset ready");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(`Asset preparation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source, removeWhite]);

  const uploadAsset = (file: File) => {
    if (!/\.(svg|png|jpe?g|webp)$/i.test(file.name)) {
      setStatus("Supported: SVG, PNG, JPG/JPEG and WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSource(String(reader.result ?? ""));
      setAssetName(file.name);
      setStatus("Asset loaded");
    };
    reader.readAsDataURL(file);
  };

  const previewProps = useMemo<StockVideoProps>(() => ({
    ...props,
    transparent: alphaPreview,
    background: alphaPreview ? null : background,
  }), [assetSrc, background, alphaPreview, alpha]);

  const renderVideo = async () => {
    if (busy || preparing) return;

    setBusy(true);
    setProgress(0);
    setStatus("Checking browser encoder…");

    const container = alpha ? "webm" : "mp4";
    // VP9 is used for alpha output. Remotion/Mediabunny keeps the alpha plane
    // when transparent=true; software encoding avoids browser hardware paths that
    // may fall back to opaque YUV output on some devices.
    const videoCodec = alpha ? "vp9" : "h264";

    try {
      const capability = await canRenderMediaOnWeb({
        width,
        height,
        container,
        videoCodec,
        transparent: alpha,
        muted: true,
      });

      if (!capability.canRender) {
        throw new Error(capability.issues.map((issue) => issue.message).join(" "));
      }

      setStatus(`Rendering ${width}×${height}…`);

      const result = await renderMediaOnWeb({
        composition: {
          id: "StockVideo",
          component: StockVideo,
          durationInFrames,
          fps,
          width,
          height,
          defaultProps: props,
          calculateMetadata: null,
        },
        inputProps: props,
        container,
        videoCodec,
        transparent: alpha,
        muted: true,
        hardwareAcceleration: alpha ? "prefer-software" : "no-preference",
        onProgress: (info) => setProgress(Math.round(info.progress * 100)),
      });

      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `stock-${width}x${height}-${duration}s-${alpha ? "alpha.webm" : "h264.mp4"}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setProgress(100);
      setStatus(alpha
        ? "Render complete — transparent WebM downloaded"
        : "Render complete — MP4 downloaded");
    } catch (error) {
      console.error(error);
      setStatus(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <header>
        <div>
          <span className="eyebrow">REMOTION STOCK GENERATOR</span>
          <h1>Vector / Image → Stock Video</h1>
          <p className="subtitle">
            SVG, PNG, JPG/JPEG and WebP are supported. White backgrounds can be removed before alpha rendering.
          </p>
        </div>
        <div className="badge">PHASE 2.1</div>
      </header>

      <section className="workspace">
        <div className={`preview-card ${alphaPreview ? "checker-preview" : ""}`}>
          <Player
            component={StockVideo}
            inputProps={previewProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={STOCK_WIDTH}
            compositionHeight={STOCK_HEIGHT}
            controls
            style={{ width: "100%", aspectRatio: "16 / 9" }}
          />
        </div>

        <aside className="panel">
          <label className="field">
            <span>Vector / image asset</span>
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAsset(f);
              }}
            />
            <small>{assetName}</small>
          </label>

          <label className="field">
            <span>Background removal</span>
            <select
              value={removeWhite ? "remove" : "keep"}
              onChange={(e) => setRemoveWhite(e.target.value === "remove")}
            >
              <option value="keep">Keep original background</option>
              <option value="remove">Remove connected white / near-white</option>
            </select>
          </label>

          <label className="field">
            <span>Alpha preview</span>
            <select
              value={alphaPreview ? "on" : "off"}
              onChange={(e) => setAlphaPreview(e.target.value === "on")}
            >
              <option value="off">Normal background</option>
              <option value="on">Checkerboard transparency</option>
            </select>
          </label>

          <label className="field">
            <span>Background</span>
            <select
              value={background}
              disabled={alpha}
              onChange={(e) => setBackground(e.target.value as typeof background)}
            >
              <option value="transparent">Transparent</option>
              <option value="#0b1020">Dark</option>
              <option value="#ffffff">White</option>
            </select>
          </label>

          <label className="field">
            <span>Resolution</span>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="1280x720">HD 1280×720</option>
              <option value="1920x1080">Full HD 1920×1080</option>
              <option value="3840x2160">4K 3840×2160</option>
            </select>
          </label>

          <label className="field">
            <span>Duration</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} sec</option>)}
            </select>
          </label>

          <label className="field">
            <span>FPS</span>
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              {[30, 60].map((n) => <option key={n} value={n}>{n} FPS</option>)}
            </select>
          </label>

          <label className="field">
            <span>Output</span>
            <select value={output} onChange={(e) => setOutput(e.target.value as typeof output)}>
              <option value="mp4">MP4 / H.264</option>
              <option value="alpha">WebM / VP9 + Alpha</option>
            </select>
          </label>

          <div className="specs">
            <div><b>Render</b><span>{width}×{height} · {duration}s · {fps} FPS</span></div>
            <div><b>Output</b><span>{alpha ? "WebM / VP9 + Alpha" : "MP4 / H.264"}</span></div>
          </div>

          <button onClick={renderVideo} disabled={busy || preparing}>
            {preparing ? "Preparing asset…" : busy ? `Rendering ${progress}%` : alpha ? "Generate Alpha WebM" : "Generate MP4"}
          </button>

          <div className="status">
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            <span>{status}</span>
          </div>

          <p className="note">
            Alpha export uses VP9 WebM with the transparent render path. The checkerboard preview is a visual verification aid.
          </p>
        </aside>
      </section>
    </main>
  );
}
