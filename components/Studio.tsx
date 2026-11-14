"use client";
import { useRef, useState } from "react";
import {
  Eraser,
  PenLine,
  Undo2,
  Redo2,
  Trash2,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
export default function Studio({
  convert,
  busy = false,
}: {
  convert: (b: Blob) => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    active = useRef(false);
  const [eraser, setEraser] = useState(false),
    [width, setWidth] = useState(5),
    [hasInk, setHasInk] = useState(false),
    [undoCount, setUndoCount] = useState(0),
    [redoCount, setRedoCount] = useState(0);
  const history = useRef<ImageData[]>([]),
    redo = useRef<ImageData[]>([]);
  const snapshot = () => {
    const c = ref.current!;
    return c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  };
  function sync() {
    setUndoCount(history.current.length);
    setRedoCount(redo.current.length);
    const pixels = snapshot().data;
    setHasInk(pixels.some((n, i) => i % 4 === 3 && n > 0));
  }
  function save() {
    history.current = [...history.current.slice(-29), snapshot()];
    redo.current = [];
    setUndoCount(history.current.length);
    setRedoCount(0);
  }
  function restore(from: ImageData[], to: ImageData[]) {
    const image = from.pop();
    if (image) {
      to.push(snapshot());
      ref.current!.getContext("2d")!.putImageData(image, 0, 0);
      sync();
    }
  }
  function finish() {
    if (!active.current) return;
    active.current = false;
    sync();
  }
  return (
    <div className="studio drawing-studio">
      <div
        className="drawing-toolbar"
        role="toolbar"
        aria-label="Drawing tools"
      >
        <div className="drawing-tools">
          <button aria-pressed={!eraser} onClick={() => setEraser(false)}>
            <PenLine size={17} />
            Pen
          </button>
          <button aria-pressed={eraser} onClick={() => setEraser(true)}>
            <Eraser size={17} />
            Eraser
          </button>
        </div>
        <label className="stroke-control">
          Stroke
          <input
            aria-label="Stroke width"
            type="range"
            min="2"
            max="30"
            value={width}
            onChange={(e) => setWidth(+e.target.value)}
          />
          <output>{width} px</output>
        </label>
        <div className="drawing-history">
          <button
            aria-label="Undo drawing"
            disabled={!undoCount || busy}
            onClick={() => restore(history.current, redo.current)}
          >
            <Undo2 size={17} />
            <span>Undo</span>
          </button>
          <button
            aria-label="Redo drawing"
            disabled={!redoCount || busy}
            onClick={() => restore(redo.current, history.current)}
          >
            <Redo2 size={17} />
            <span>Redo</span>
          </button>
          <button
            aria-label="Clear drawing"
            disabled={!hasInk || busy}
            onClick={() => {
              save();
              ref.current!.getContext("2d")!.clearRect(0, 0, 700, 500);
              sync();
            }}
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
        </div>
      </div>
      <div className="drawing-paper">
        <canvas
          ref={ref}
          aria-label="Drawing canvas. Use the pen or eraser with your mouse, trackpad, or touch."
          width="700"
          height="500"
          onPointerDown={(e) => {
            if (busy) return;
            save();
            active.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect(),
              ctx = e.currentTarget.getContext("2d")!,
              x = ((e.clientX - r.left) * 700) / r.width,
              y = ((e.clientY - r.top) * 500) / r.height;
            ctx.globalCompositeOperation = eraser
              ? "destination-out"
              : "source-over";
            ctx.strokeStyle = "#172f28";
            ctx.fillStyle = "#172f28";
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.arc(x, y, width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x, y);
            setHasInk(true);
          }}
          onPointerMove={(e) => {
            if (!active.current) return;
            const r = e.currentTarget.getBoundingClientRect(),
              ctx = e.currentTarget.getContext("2d")!;
            ctx.lineTo(
              ((e.clientX - r.left) * 700) / r.width,
              ((e.clientY - r.top) * 500) / r.height,
            );
            ctx.stroke();
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
        {!hasInk && (
          <div className="drawing-empty" aria-hidden="true">
            <PenLine size={27} />
            <strong>Your next equation starts here.</strong>
            <span>Draw a simple shape with your mouse or finger.</span>
          </div>
        )}
      </div>
      <div className="drawing-bottom">
        <p>
          {hasInk
            ? "Ready when you are. Your sketch stays here as you switch tabs."
            : "Tip: start with a bold, simple outline."}
        </p>
        <button
          className="primary"
          disabled={!hasInk || busy}
          onClick={() => {
            const canvas = document.createElement("canvas");
            canvas.width = 700;
            canvas.height = 500;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, 700, 500);
            ctx.drawImage(ref.current!, 0, 0);
            canvas.toBlob((b) => b && convert(b), "image/png");
          }}
        >
          {busy ? <LoaderCircle size={17} className="spin-icon" /> : null}
          {busy ? "Converting…" : "Convert to equations"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </div>
    </div>
  );
}
