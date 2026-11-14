"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  PenLine,
  Heart,
  Circle,
  Star,
  Flower2,
  Waypoints,
  Waves,
  HelpCircle,
  ArrowRight,
  Upload,
  FolderOpen,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronDown,
  Maximize2,
  Moon,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import katex from "katex";
import Graph, { colors } from "@/components/Graph";
import EquationPanel from "@/components/EquationPanel";
import {
  partialCurve,
  segmentCount,
  visibleModels,
  drawingSvg,
} from "@/lib/explorer";
import WorkspaceTabs, { type WorkspaceView } from "@/components/WorkspaceTabs";
import Studio from "@/components/Studio";
import Experiments from "@/components/Experiments";
import { Curve, Point, reconstruct, equations, download } from "@/lib/math";
type Contour = { points: Point[]; hole: boolean };
const examples = ["heart", "circle", "star", "butterfly", "flower", "abstract"];
const exampleIcons = [Heart, Circle, Star, Waypoints, Flower2, Waves];
function ExampleMark({ index }: { index: number }) {
  const Icon = exampleIcons[index];
  return <Icon size={25} />;
}
function MathText({ value }: { value: string }) {
  return (
    <div
      className="math"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          throwOnError: false,
          displayMode: true,
        }),
      }}
    />
  );
}
async function api(path: string, init?: RequestInit) {
  const r = await fetch("/engine" + path, init);
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: "Service unavailable" }));
    throw new Error(
      typeof e.detail === "string"
        ? e.detail
        : "Please check the input parameters.",
    );
  }
  return r.json();
}
export default function Home() {
  const [contours, setContours] = useState<Contour[]>([]),
    [models, setCurves] = useState<Curve[]>([]),
    [method, setMethod] = useState("fourier"),
    [harmonics, setHarmonics] = useState(12),
    [smoothing, setSmoothing] = useState(8),
    [tolerance, setTolerance] = useState(0.05),
    [selected, setSelected] = useState(0),
    [name, setName] = useState("Heart"),
    [busy, setBusy] = useState("Loading numerical engine…"),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState<WorkspaceView>("reconstruct"),
    [dark, setDark] = useState(false),
    [detected, setDetected] = useState(false),
    [reconstructed, setReconstructed] = useState(true),
    [image, setImage] = useState(""),
    [overlay, setOverlay] = useState(false),
    [grid, setGrid] = useState(2),
    [modal, setModal] = useState(""),
    [threshold, setThreshold] = useState(180),
    [bench, setBench] = useState<Curve[]>([]),
    [step, setStep] = useState<number | null>(null),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(2),
    [hidden, setHidden] = useState<number[]>([]),
    [hovered, setHovered] = useState<number | null>(null),
    [plane, setPlane] = useState(true),
    [focusRequest, setFocusRequest] = useState(0),
    [split, setSplit] = useState(40),
    [mobileView, setMobileView] = useState("graph"),
    [undoCount, setUndoCount] = useState(0),
    [examplesOpen, setExamplesOpen] = useState(false),
    [animationOpen, setAnimationOpen] = useState(false),
    [dragging, setDragging] = useState(false);
  function navigate(view: WorkspaceView) {
    setTab(view);
    setMessage("");
    setExamplesOpen(false);
    if (view !== "reconstruct") setPlaying(false);
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "instant" }),
    );
  }
  const history = useRef<Curve[][]>([]);
  const splitRef = useRef<HTMLDivElement>(null);
  const curves = useMemo(
    () => models.map((c) => partialCurve(c, step, harmonics)),
    [models, step, harmonics],
  );
  const maxStep =
    models[0]?.method === "fourier"
      ? harmonics
      : Math.max(0, ...models.map(segmentCount));
  useEffect(() => {
    if (!playing) return;
    if (step !== null && step >= maxStep) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(
      () => setStep((s) => Math.min(maxStep, (s ?? 0) + 1)),
      1000 / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, step, maxStep, speed]);
  function selectEquation(i: number) {
    setSelected(i);
    setFocusRequest((n) => n + 1);
  }
  function selectCurve(i: number) {
    setSelected(i);
    setMobileView("equations");
    requestAnimationFrame(() =>
      document
        .getElementById(`equation-${i}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }
  function editModel(i: number, c: Curve) {
    history.current = [...history.current.slice(-49), models];
    setUndoCount(history.current.length);
    setPlaying(false);
    setStep(null);
    setCurves((cs) => cs.map((old, j) => (j === i ? c : old)));
  }
  function undoEdit() {
    const previous = history.current.pop();
    if (previous) {
      setCurves(previous);
      setUndoCount(history.current.length);
      setPlaying(false);
      setStep(null);
    }
  }
  function resetModel(i: number) {
    const original = fitted.current[i];
    if (original) editModel(i, structuredClone(original));
  }
  function changeStep(n: number) {
    setPlaying(false);
    setReconstructed(true);
    setStep(Math.max(0, Math.min(maxStep, n)));
  }
  function compareView(mode: string) {
    setOverlay(mode === "original" || mode === "overlay");
    setDetected(mode === "contours" || mode === "overlay");
    setReconstructed(mode === "reconstruction" || mode === "overlay");
  }

  const file = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const curve = curves[selected];
  const fitted = useRef<Curve[]>([]);
  const harmonicRef = useRef(harmonics);
  harmonicRef.current = harmonics;
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal("");
      if (e.key === "Tab" && dialog) {
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>("button,a,input,select"),
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal]);
  async function loadExample(example: string) {
    setBusy("Sampling contour…");
    setMessage("");
    try {
      const data = await api("/examples/" + example);
      setContours(data.contours);
      setSelected(0);
      setImage("");
      setMobileView("graph");
      setOverlay(false);
      setDetected(false);
      setReconstructed(true);
      setExamplesOpen(false);
      navigate("reconstruct");
      setName(example[0].toUpperCase() + example.slice(1));
      setModal("");
    } catch (e) {
      setMessage(
        (e as Error).message +
          " Start the Python service using the README instructions.",
      );
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    loadExample("heart");
  }, []);
  useEffect(() => {
    if (!contours.length) return;
    const id = ++sequence.current;
    setBusy("Fitting mathematical curves…");
    const timer = setTimeout(() => {
      api("/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contours: contours.map((c) => c.points),
          method,
          harmonics: harmonicRef.current,
          smoothing,
          tolerance,
        }),
      })
        .then((data) => {
          if (id !== sequence.current) return;
          fitted.current = structuredClone(data.curves);
          setStep(null);
          setPlaying(false);
          setHidden([]);
          setHovered(null);
          history.current = [];
          setUndoCount(0);
          setCurves(
            method === "fourier"
              ? data.curves.map((c: Curve) =>
                  reconstruct(c, harmonicRef.current),
                )
              : data.curves,
          );
          setBench([]);
        })
        .catch((e) => {
          if (id === sequence.current) setMessage(e.message);
        })
        .finally(() => {
          if (id === sequence.current) setBusy("");
        });
    }, 120);
    return () => clearTimeout(timer);
  }, [contours, method, smoothing, tolerance]);
  useEffect(() => {
    if (method === "fourier" && models.every((c) => c.coefficients))
      setCurves((cs) => cs.map((c) => reconstruct(c, harmonics)));
    setStep(null);
    setPlaying(false);
  }, [harmonics]);
  async function upload(blob: Blob, label: string) {
    setBusy("Detecting image boundaries…");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", blob, label);
      const data = await api("/extract?threshold=" + threshold, {
        method: "POST",
        body: form,
      });
      setContours(data.contours);
      setSelected(0);
      setName(label.replace(/\.[^.]+$/, ""));
      setImage(URL.createObjectURL(blob));
      setDetected(false);
      setReconstructed(true);
      setOverlay(false);
      setMobileView("graph");
      setModal("");
      navigate("reconstruct");
      setMessage(
        `Found ${data.contours.length} ${data.contours.length === 1 ? "contour" : "contours"}. Your equations and graph are ready below.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function compare() {
    setBusy("Measuring all three methods…");
    try {
      const results = [];
      for (const m of ["fourier", "spline", "bezier"]) {
        const d = await api("/fit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contours: [contours[selected].points],
            method: m,
            harmonics,
            smoothing,
            tolerance,
          }),
        });
        results.push(d.curves[0]);
      }
      setBench(results);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function exportFile(kind: string) {
    if (!curves.length) return;
    const exported = visibleModels(curves, hidden);
    if (kind === "json")
      download(
        "mathsketch.json",
        JSON.stringify(
          {
            harmonics,
            playbackStep: step,
            hiddenContours: hidden,
            contourIndices: exported.map(({ index }) => index),
            curves: exported.map(({ curve }) => curve),
          },
          null,
          2,
        ),
        "application/json",
      );
    if (kind === "tex")
      download(
        "mathsketch.tex",
        exported
          .map(
            ({ curve: c, index: i }) =>
              `% Contour ${i + 1}\n` + equations(c, harmonics).join("\n"),
          )
          .join("\n\n"),
        "text/plain",
      );
    if (kind === "csv")
      download(
        "contours.csv",
        "contour,index,x,y\n" +
          contours
            .flatMap((c, i) =>
              hidden.includes(i)
                ? []
                : c.points.map((p, j) => `${i + 1},${j},${p[0]},${p[1]}`),
            )
            .join("\n"),
        "text/csv",
      );
    if (kind === "svg" || kind === "png") {
      const svg = drawingSvg(curves, hidden, colors);
      if (kind === "svg") download("mathsketch.svg", svg, "image/svg+xml");
      else {
        const im = new Image();
        im.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1200;
          canvas.getContext("2d")!.drawImage(im, 0, 0);
          canvas.toBlob((b) => {
            if (b) {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(b);
              a.download = "mathsketch.png";
              a.click();
            }
          });
        };
        im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      }
    }
    setModal("");
  }
  const errors = useMemo(
    () =>
      curve?.coefficients
        ? Array.from({ length: 32 }, (_, i) => ({
            n: i + 1,
            ...reconstruct(curve, i + 1),
          }))
        : [],
    [curve?.coefficients, curve?.source],
  );
  return (
    <div className={dark ? "app dark" : "app"}>
      <header className="app-header">
        <a className="brand" href="/" aria-label="MathSketch home">
          <Activity size={28} />
          MathSketch
        </a>
        <div className="app-header-description">
          From a drawing to an equation.
        </div>
        <div className="app-header-actions">
          <button aria-label="Help" onClick={() => setModal("about")}>
            <HelpCircle size={17} />
            <span>Help</span>
          </button>
          <button
            aria-label="Toggle theme"
            title="Switch light or dark theme"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="primary"
            onClick={() => setModal("export")}
            disabled={tab === "draw" || !curves.length || !!busy}
          >
            <ArrowDownToLine size={16} />
            Export
          </button>
        </div>
      </header>
      <main className="task-app">
        <WorkspaceTabs value={tab} onChange={navigate} />
        <div className="task-heading">
          <div>
            <h1>
              {tab === "draw"
                ? "Draw your sketch"
                : tab === "explore"
                  ? "Explore the mathematics"
                  : "Equations & graph"}
            </h1>
            <p>
              {tab === "draw"
                ? "Sketch a shape, then convert it into editable mathematical curves."
                : tab === "explore"
                  ? "Compare real fitting results and see how each method reconstructs your drawing."
                  : "Choose a fitting method. Inspect a curve. Change a number and see what happens."}
            </p>
          </div>
          <span className="workspace-saved">
            <span /> Local workspace
          </span>
        </div>
        <div
          className={"source-bar" + (dragging ? " is-dragging" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy) upload(f, f.name);
          }}
        >
          <div className="current-source">
            <span className="source-symbol">
              <FolderOpen size={19} />
            </span>
            <div>
              <strong>
                {dragging
                  ? "Drop image to upload"
                  : tab === "draw"
                    ? "Your sketch"
                    : name}
              </strong>
              <small>
                {tab === "draw"
                  ? "Convert your sketch to update the equations"
                  : `${image ? "Your drawing" : "Example drawing"} · ${contours.length} ${contours.length === 1 ? "contour" : "contours"}`}
              </small>
            </div>
          </div>
          <div className="source-actions">
            <button onClick={() => file.current?.click()} disabled={!!busy}>
              <Upload size={16} />
              Upload image
            </button>
            <button
              aria-expanded={examplesOpen}
              aria-controls="example-picker"
              onClick={() => setExamplesOpen((o) => !o)}
            >
              <FolderOpen size={16} />
              Examples
              <ChevronDown size={14} />
            </button>
            {tab !== "draw" && (
              <button onClick={() => navigate("draw")}>
                <PenLine size={16} />
                Draw a sketch
              </button>
            )}
          </div>
        </div>
        <input
          ref={file}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f, f.name);
            e.currentTarget.value = "";
          }}
        />
        {examplesOpen && (
          <div className="example-picker" id="example-picker">
            <div className="picker-heading">
              <div>
                <h2>Start with an example</h2>
                <p>
                  Each shape is fitted with the same numerical engine as your
                  own drawings.
                </p>
              </div>
              <button
                aria-label="Close examples"
                onClick={() => setExamplesOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="example-options">
              {examples.map((e, i) => (
                <button
                  key={e}
                  onClick={() => loadExample(e)}
                  disabled={!!busy}
                >
                  <ExampleMark index={i} />
                  <span>
                    {e === "abstract"
                      ? "Abstract curve"
                      : e[0].toUpperCase() + e.slice(1)}
                  </span>
                  {name.toLowerCase() === e && <small>Current</small>}
                </button>
              ))}
            </div>
          </div>
        )}
        <section
          id="view-draw"
          role="tabpanel"
          aria-labelledby="tab-draw"
          hidden={tab !== "draw"}
          className="draw-page"
        >
          <div className="draw-layout">
            <Studio busy={!!busy} convert={(b) => upload(b, "My sketch.png")} />
            <aside className="draw-guide">
              <h2>Draw. Convert. Explore.</h2>
              <ol>
                <li>
                  <strong>Make a simple drawing</strong>
                  <p>
                    Use the pen for bold lines. Switch to the eraser to tidy up.
                  </p>
                </li>
                <li>
                  <strong>Convert to equations</strong>
                  <p>
                    We detect the outlines and fit mathematical curves to your
                    sketch.
                  </p>
                </li>
                <li>
                  <strong>Make the math your own</strong>
                  <p>
                    Adjust detail, edit coefficients, or watch each curve take
                    shape.
                  </p>
                </li>
              </ol>
              <div className="draw-help">
                <p>
                  Your sketch stays on this canvas when you switch tabs.
                  Converting does not erase it.
                </p>
                <p>
                  Prefer a file?{" "}
                  <button onClick={() => file.current?.click()}>
                    Upload an image
                  </button>{" "}
                  instead.
                </p>
              </div>
            </aside>
          </div>
        </section>
        <section
          id="view-reconstruct"
          role="tabpanel"
          aria-labelledby="tab-reconstruct"
          hidden={tab !== "reconstruct"}
        >
          <div className="fit-settings">
            <label className="fit-method-label">
              Fitting method
              <select
                aria-label="Fitting method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="fourier">Fourier series</option>
                <option value="spline">Cubic splines</option>
                <option value="bezier">Bézier curves</option>
              </select>
            </label>
            <div className="fit-complexity">
              <div>
                <label htmlFor="complexity">
                  {method === "fourier"
                    ? "Detail · harmonics"
                    : method === "spline"
                      ? "Knot reduction"
                      : "Fit tolerance"}
                </label>
                <output>
                  {method === "fourier"
                    ? harmonics
                    : method === "spline"
                      ? smoothing
                      : tolerance}
                </output>
              </div>
              <input
                id="complexity"
                type="range"
                min={method === "bezier" ? 0.005 : 1}
                max={method === "fourier" ? 64 : method === "spline" ? 16 : 0.5}
                step={method === "bezier" ? 0.005 : 1}
                value={
                  method === "fourier"
                    ? harmonics
                    : method === "spline"
                      ? smoothing
                      : tolerance
                }
                onChange={(e) =>
                  method === "fourier"
                    ? setHarmonics(+e.target.value)
                    : method === "spline"
                      ? setSmoothing(+e.target.value)
                      : setTolerance(+e.target.value)
                }
              />
            </div>
            <p>
              {method === "fourier"
                ? "More harmonics add finer detail to the outline."
                : method === "spline"
                  ? "Fewer knots give a simpler, smoother approximation."
                  : "Lower tolerance follows the contour more closely."}
            </p>
            <details className="detection-settings">
              <summary>
                <SlidersHorizontal size={15} />
                Image settings
              </summary>
              <div>
                <label>
                  Detection threshold <output>{threshold}</output>
                  <input
                    aria-label="Detection threshold"
                    type="range"
                    min="20"
                    max="250"
                    value={threshold}
                    onChange={(e) => setThreshold(+e.target.value)}
                  />
                </label>
                <small>
                  Applies to your next PNG, JPG, or WebP upload. Maximum size:
                  10 MB.
                </small>
              </div>
            </details>
          </div>
          <div className="workspace">
            <div
              className="mobile-workspace-tabs"
              role="group"
              aria-label="Workspace view"
            >
              <button
                aria-pressed={mobileView === "equations"}
                onClick={() => setMobileView("equations")}
              >
                Equations
              </button>
              <button
                aria-pressed={mobileView === "graph"}
                onClick={() => setMobileView("graph")}
              >
                Graph
              </button>
            </div>
            <div
              ref={splitRef}
              className={"live-split mobile-" + mobileView}
              style={{ "--equation-width": split + "%" } as React.CSSProperties}
            >
              <EquationPanel
                curves={curves}
                models={models}
                baselines={fitted.current}
                harmonics={harmonics}
                selected={selected}
                hovered={hovered}
                hidden={hidden}
                onSelect={selectEquation}
                onHover={setHovered}
                onToggle={(i) =>
                  setHidden((h) =>
                    h.includes(i) ? h.filter((j) => j !== i) : [...h, i],
                  )
                }
                onEdit={editModel}
                onUndo={undoEdit}
                onReset={resetModel}
                canUndo={undoCount > 0}
              />
              <div
                className="split-handle"
                role="separator"
                tabIndex={0}
                aria-label="Resize equations and graph"
                aria-orientation="vertical"
                aria-valuenow={split}
                aria-valuemin={30}
                aria-valuemax={65}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    setSplit((n) =>
                      Math.max(
                        30,
                        Math.min(65, n + (e.key === "ArrowRight" ? 2 : -2)),
                      ),
                    );
                  }
                }}
                onPointerDown={(e) =>
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const r = splitRef.current!.getBoundingClientRect();
                  setSplit(
                    Math.max(
                      30,
                      Math.min(65, ((e.clientX - r.left) / r.width) * 100),
                    ),
                  );
                }}
              >
                <span />
              </div>
              <section className="center">
                <div className="canvas-toolbar">
                  <div className="file-title">
                    <Activity size={17} />
                    <strong>Coordinate plane</strong>
                  </div>
                  <div>
                    <button
                      aria-expanded={animationOpen}
                      onClick={() => {
                        setAnimationOpen((v) => !v);
                        if (animationOpen) setPlaying(false);
                      }}
                    >
                      <Play size={15} />
                      <span>
                        {animationOpen ? "Close animation" : "Animate curve"}
                      </span>
                    </button>
                    <button
                      title="Expand workspace"
                      aria-label="Expand workspace"
                      onClick={() =>
                        document
                          .querySelector(".workspace")
                          ?.requestFullscreen?.()
                      }
                    >
                      <Maximize2 size={15} />
                    </button>
                  </div>
                </div>
                <div
                  className="playback"
                  hidden={!animationOpen}
                  aria-label="Mathematical reconstruction playback"
                >
                  <div className="playback-buttons">
                    <button
                      aria-label="Restart reconstruction"
                      onClick={() => changeStep(0)}
                      disabled={!models.length}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      aria-label="Step backward"
                      onClick={() => changeStep((step ?? maxStep) - 1)}
                      disabled={!models.length || (step ?? maxStep) <= 0}
                    >
                      <SkipBack size={15} />
                    </button>
                    <button
                      className="play-toggle"
                      aria-label={
                        playing ? "Pause reconstruction" : "Play reconstruction"
                      }
                      disabled={!models.length}
                      onClick={() => {
                        setReconstructed(true);
                        if (playing) setPlaying(false);
                        else {
                          if (step === null || step >= maxStep) setStep(0);
                          setPlaying(true);
                        }
                      }}
                    >
                      {playing ? <Pause size={15} /> : <Play size={15} />}
                      <span>{playing ? "Pause" : "Play"}</span>
                    </button>
                    <button
                      aria-label="Step forward"
                      onClick={() => changeStep((step ?? 0) + 1)}
                      disabled={!models.length || (step ?? 0) >= maxStep}
                    >
                      <SkipForward size={15} />
                    </button>
                  </div>
                  <div className="playback-state" aria-live="polite">
                    <strong>
                      {models[0]?.method === "fourier"
                        ? `Partial sum · N = ${step ?? harmonics}`
                        : `Segments · ${step ?? maxStep} / ${maxStep}`}
                    </strong>
                    <span>
                      {step === null
                        ? "Complete fit"
                        : models[0]?.method === "fourier" && step === 0
                          ? "Constant term only"
                          : "Equation and graph advance together"}
                    </span>
                  </div>
                  <label>
                    Speed
                    <select
                      aria-label="Playback speed"
                      value={speed}
                      onChange={(e) => setSpeed(+e.target.value)}
                    >
                      <option value="1">1 step/s</option>
                      <option value="2">2 steps/s</option>
                      <option value="4">4 steps/s</option>
                    </select>
                  </label>
                  <button
                    className="small-action"
                    onClick={() => {
                      setStep(null);
                      setPlaying(false);
                    }}
                  >
                    Full fit
                  </button>
                </div>
                <div className="comparison-toolbar">
                  <label>
                    Compare
                    <select
                      aria-label="Comparison mode"
                      value={
                        overlay
                          ? reconstructed || detected
                            ? "overlay"
                            : "original"
                          : detected && !reconstructed
                            ? "contours"
                            : "reconstruction"
                      }
                      onChange={(e) => compareView(e.target.value)}
                    >
                      <option value="reconstruction">Reconstruction</option>
                      <option value="contours">Detected contours</option>
                      <option value="original" disabled={!image}>
                        Original image
                      </option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={plane}
                      onChange={(e) => setPlane(e.target.checked)}
                    />
                    Grid & axes
                  </label>
                  <label>
                    Spacing
                    <select
                      aria-label="Grid spacing"
                      value={grid}
                      onChange={(e) => setGrid(+e.target.value)}
                    >
                      <option value="1">1 unit</option>
                      <option value="2">2 units</option>
                      <option value="4">4 units</option>
                    </select>
                  </label>
                </div>
                <Graph
                  curves={curves}
                  contours={contours.map((c) => c.points)}
                  selected={selected}
                  onSelect={selectCurve}
                  grid={grid}
                  showContours={detected}
                  showCurves={reconstructed}
                  overlay={overlay ? image : ""}
                  hidden={hidden}
                  hovered={hovered}
                  onHover={setHovered}
                  focusRequest={focusRequest}
                  fittedCurves={fitted.current}
                  plane={plane}
                />
                <div className="metrics">
                  <div>
                    <span>RECONSTRUCTION ERROR</span>
                    <strong>
                      {curve?.source.length ? curve.error.toFixed(4) : "—"}
                      <small> units</small>
                    </strong>
                    <small>
                      Corresponding-point RMSE
                      {step !== null && method !== "fourier"
                        ? " · revealed portion"
                        : ""}
                    </small>
                  </div>
                  <div>
                    <span>PARAMETERS</span>
                    <strong>
                      {curve?.parameters ?? "—"}
                      <small> scalars</small>
                    </strong>
                    <small>
                      {method === "fourier"
                        ? `${2 * (curve?.harmonics ?? harmonics) + 1} complex coefficients`
                        : method === "bezier"
                          ? "Control-point coordinates"
                          : step !== null
                            ? "Visible polynomial scalars"
                            : "Interpolation knot coordinates"}
                    </small>
                  </div>
                  <div>
                    <span>COMPUTATION TIME</span>
                    <strong>
                      {curve ? curve.milliseconds.toFixed(2) : "—"}
                      <small> ms</small>
                    </strong>
                    <small>
                      {method === "fourier"
                        ? "Client curve evaluation"
                        : "Server fit + evaluation"}
                    </small>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
        <div aria-live="polite" className={"status " + (busy ? "working" : "")}>
          {busy ? (
            <>
              <span className="spinner" />
              {busy}
            </>
          ) : (
            message || (
              <>
                <i />{" "}
                {tab === "draw"
                  ? "Your sketch is kept while you switch tabs."
                  : `${curves.length} ${curves.length === 1 ? "curve" : "curves"} ready · ${method === "fourier" ? "Fourier series" : method === "spline" ? "Cubic splines" : "Bézier curves"}`}
              </>
            )
          )}
        </div>
        <section
          id="view-explore"
          role="tabpanel"
          aria-labelledby="tab-explore"
          hidden={tab !== "explore"}
          className="exploration-page"
        >
          <div className="explore-context">
            <strong>Experimenting with {name}</strong>
            <label>
              Contour
              <select
                aria-label="Experiment contour"
                value={selected}
                onChange={(e) => setSelected(+e.target.value)}
              >
                {contours.map((_, i) => (
                  <option key={i} value={i}>
                    Contour {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => navigate("reconstruct")}>
              Back to equations <ArrowRight size={15} />
            </button>
          </div>
          <section className="explore">
            <div className="experiment">
              <h2>Harmonics and accuracy</h2>
              <p>
                See how additional frequencies reduce the distance between the
                original contour and its approximation.
              </p>
              <div className="chart">
                <span className="chart-y">RMSE</span>
                <svg
                  viewBox="0 0 400 95"
                  role="img"
                  aria-label="Measured harmonic count versus corresponding-point RMSE"
                >
                  <path
                    d="M0 85H400 M0 5V85"
                    fill="none"
                    stroke="var(--border)"
                  />
                  <path
                    d={errors
                      .map(
                        (c, i) =>
                          `${i ? "L" : "M"}${(i / 31) * 395},${85 - (75 * c.error) / Math.max(0.001, ...errors.map((e) => e.error))}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#237d68"
                    strokeWidth="2"
                  />
                  {errors.length > 0 && (
                    <circle
                      cx={((Math.min(harmonics, 32) - 1) / 31) * 395}
                      cy={
                        85 -
                        (75 * errors[Math.min(harmonics, 32) - 1].error) /
                          Math.max(0.001, ...errors.map((e) => e.error))
                      }
                      r="4"
                      fill="#237d68"
                    />
                  )}
                </svg>
                <div className="chart-label">
                  <span>1 harmonic</span>
                  <span>32 harmonics</span>
                </div>
              </div>
              {!errors.length && (
                <small>
                  Switch to Fourier series in Equations & graph to see harmonic
                  results.
                </small>
              )}
            </div>
          </section>
          <section className="lab">
            <div>
              <h2>Compare the fits</h2>
              <p>
                Measure this contour using the current settings. Times include
                fitting and evaluation on the Python service.
              </p>
              <button
                className="primary"
                onClick={compare}
                disabled={!!busy || !contours.length}
              >
                Run measured comparison
              </button>
            </div>
            <div>
              {bench.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>RMSE</th>
                      <th>Scalars</th>
                      <th>Time (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bench.map((c) => (
                      <tr key={c.method}>
                        <td>{c.method}</td>
                        <td>{c.error.toFixed(5)}</td>
                        <td>{c.parameters}</td>
                        <td>{c.milliseconds.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No benchmarks run yet. Results are measured on demand.</p>
              )}
            </div>
            <Experiments
              key={selected + name}
              points={contours[selected]?.points || []}
            />
            <div className="lessons">
              <button className="learn-link" onClick={() => setModal("lesson")}>
                How a contour becomes an equation <ArrowUpRight size={14} />
              </button>
              <h3>Why parametric?</h3>
              <p>
                A circle has two y-values for most x-values. Instead of y =
                f(x), use a pair (x(t), y(t)) to trace the outline.
              </p>
              <h3>Interpolation & fitting</h3>
              <p>
                Splines interpolate selected knots with matching first and
                second derivatives. Bézier segments minimize squared point
                residuals with fixed endpoints, splitting when the maximum
                residual exceeds tolerance.
              </p>
              <h3>Complexity has a cost</h3>
              <p>
                Extra terms can reproduce noise. Prefer the smallest
                representation that preserves the features you care about.
              </p>
            </div>
          </section>
        </section>
        <footer>
          <span className="brand-small">∿ MathSketch</span>
          <span>A playground for the art of mathematics.</span>
          <span>Everything runs locally.</span>
        </footer>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close dialog"
              onClick={() => setModal("")}
            >
              <X size={18} />
            </button>
            {modal === "export" ? (
              <>
                <h2>Take your mathematics with you.</h2>
                <p>
                  Equations and coefficients describe the currently displayed
                  fit, including edits and the current animation step. Hidden
                  equations are excluded from every format. SVG and PNG sample
                  the visible curves; CSV contains their original contours.
                </p>
                {[
                  ["svg", "Vector drawing · SVG"],
                  ["png", "Reconstructed image · PNG"],
                  ["tex", "Full equations · LaTeX"],
                  ["json", "Parameters & coefficients · JSON"],
                  ["csv", "Original contour coordinates · CSV"],
                ].map(([key, label]) => (
                  <button
                    className="export-option"
                    key={key}
                    onClick={() => exportFile(key)}
                  >
                    {label}
                    <ArrowDownToLine size={16} />
                  </button>
                ))}
              </>
            ) : modal === "lesson" ? (
              <>
                <h2>A drawing is a moving point.</h2>
                <p>
                  Sample a closed contour at equal distances. Treat each
                  coordinate as a complex number z = x + iy. The discrete
                  Fourier transform measures how much of each rotating frequency
                  appears in this sequence.
                </p>
                <MathText
                  value={"c_k=\\frac1M\\sum_{j=0}^{M-1}z_j e^{-2\\pi i k j/M}"}
                />
                <p>
                  Keep the low frequencies for the broad shape. Add higher
                  frequencies for sharp turns and fine details. The harmonic
                  slider evaluates these same coefficients locally, without
                  processing the image again.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setMethod("fourier");
                    navigate("explore");
                    setModal("");
                  }}
                >
                  Explore the harmonics →
                </button>
              </>
            ) : (
              <>
                <h2>How to use MathSketch</h2>
                <p>
                  Start in Draw to make a sketch, or choose Upload image or
                  Examples from the source bar. Select Convert to equations to
                  see the result in Equations & graph.
                </p>
                <p>
                  In Equations & graph, choose a fitting method and adjust its
                  detail. Select an equation to focus its curve, or open Edit
                  numerical parameters to change its shape. Explore math
                  contains comparisons and experiments. Your sketch and equation
                  edits stay in place when you switch tabs.
                </p>
                <p>
                  Use Export for PNG, SVG, LaTeX, JSON, or CSV. Work stays in
                  this page until you refresh; export anything you want to keep.
                  Simple outlines work best. Pen strokes are converted into
                  closed outlines around the ink.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
