import { useMemo, useState } from "react";
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
  <defs>
    <linearGradient id="g" x1="0" x2="1">
      <stop offset="0" stop-color="#5eead4"/>
      <stop offset="1" stop-color="#60a5fa"/>
    </linearGradient>
  </defs>
  <circle cx="300" cy="200" r="118" fill="none" stroke="url(#g)" stroke-width="10"/>
  <circle cx="180" cy="110" r="24" fill="#5eead4"/>
  <circle cx="420" cy="110" r="24" fill="#60a5fa"/>
  <circle cx="180" cy="290" r="24" fill="#60a5fa"/>
  <circle cx="420" cy="290" r="24" fill="#5eead4"/>
  <g stroke="#94a3b8" stroke-width="6" opacity=".75">
    <path d="M198 122 L282 182"/>
    <path d="M402 122 L318 182"/>
    <path d="M198 278 L282 218"/>
    <path d="M402 278 L318 218"/>
  </g>
</svg>`;

const svgToDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export default function App() {
  const [svg, setSvg] = useState(DEFAULT_SVG);
  const [background, setBackground] = useState("transparent");
  const [status, setStatus] = useState("Ready");
  const [progress, setProgress] = useState(0);
  const [rendering, setRendering] = useState(false);
  const src = useMemo(() => svgToDataUrl(svg), [svg]);

  const props: StockVideoProps = { src, background };

  const uploadSvg = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      setSvg(value);
      setStatus("SVG loaded");
    };
    reader.readAsText(file);
  };

  const renderVideo = async () => {
    if (rendering) return;

    setRendering(true);
    setProgress(0);
    setStatus("Checking browser encoder…");

    try {
      const capability = await canRenderMediaOnWeb({
        width: STOCK_WIDTH,
        height: STOCK_HEIGHT,
        container: "mp4",
        videoCodec: "h264",
        muted: true,
      });

      if (!capability.canRender) {
        throw new Error(
          capability.issues.map((issue) => issue.message).join(" "),
        );
      }

      setStatus("Rendering in your browser…");

      const result = await renderMediaOnWeb({
        composition: {
          id: "StockVideo",
          component: StockVideo,
          durationInFrames: STOCK_DURATION,
          fps: STOCK_FPS,
          width: STOCK_WIDTH,
          height: STOCK_HEIGHT,
          defaultProps: props,
          calculateMetadata: null,
        },
        inputProps: props,
        container: "mp4",
        videoCodec: "h264",
        muted: true,
        onProgress: (info) => {
          setProgress(Math.round(info.progress * 100));
        },
      });

      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "remotion-stock-generator-test.mp4";
      anchor.click();
      URL.revokeObjectURL(url);

      setProgress(100);
      setStatus("Render complete — MP4 downloaded");
    } catch (error) {
      console.error(error);
      setStatus(
        `Render failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setRendering(false);
    }
  };

  return (
    <main className="shell">
      <header>
        <div>
          <span className="eyebrow">REMOTION STOCK GENERATOR</span>
          <h1>SVG → Stock Video</h1>
          <p className="subtitle">
            MVP: animate one SVG and render an MP4 directly in the browser.
          </p>
        </div>
        <div className="badge">MVP 0.1</div>
      </header>

      <section className="workspace">
        <div className="preview-card">
          <Player
            component={StockVideo}
            inputProps={props}
            durationInFrames={STOCK_DURATION}
            fps={STOCK_FPS}
            compositionWidth={STOCK_WIDTH}
            compositionHeight={STOCK_HEIGHT}
            controls
            style={{ width: "100%", aspectRatio: "16 / 9" }}
          />
        </div>

        <aside className="panel">
          <label className="field">
            <span>SVG asset</span>
            <input
              type="file"
              accept=".svg,image/svg+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadSvg(file);
              }}
            />
          </label>

          <label className="field">
            <span>Background</span>
            <select
              value={background}
              onChange={(event) => setBackground(event.target.value)}
            >
              <option value="transparent">Transparent</option>
              <option value="#0b1020">Dark</option>
              <option value="#ffffff">White</option>
            </select>
          </label>

          <div className="specs">
            <div><b>Duration</b><span>5 sec</span></div>
            <div><b>FPS</b><span>30</span></div>
            <div><b>Preview</b><span>1280×720</span></div>
            <div><b>Output</b><span>MP4 / H.264</span></div>
          </div>

          <button onClick={renderVideo} disabled={rendering}>
            {rendering ? `Rendering ${progress}%` : "Generate MP4"}
          </button>

          <div className="status">
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            <span>{status}</span>
          </div>

          <p className="note">
            This first version renders locally in the browser. No server or API
            key is required for the render.
          </p>
        </aside>
      </section>
    </main>
  );
}