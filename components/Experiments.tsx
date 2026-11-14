"use client";
import { useState } from "react";
import { Point } from "@/lib/math";
type Row = {
  method: string;
  parameters: number;
  segments: number;
  error: number;
  milliseconds: number;
};
export default function Experiments({ points }: { points: Point[] }) {
  const [rows, setRows] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/engine/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contours: [points] }),
      });
      if (!response.ok) throw new Error("Could not measure this contour.");
      setRows((await response.json()).measurements);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sweep">
      <div className="sweep-heading">
        <div>
          <h3>Accuracy, complexity & computation</h3>
          <p>
            Measure a range of harmonic counts and Bézier tolerances on the
            selected contour.
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || !points?.length}
          onClick={run}
        >
          {busy ? "Measuring…" : "Run complexity experiment"}
        </button>
      </div>
      {message && <p role="alert">{message}</p>}
      {rows.length > 0 && (
        <div className="sweep-charts">
          {[
            {
              title: "Harmonics vs RMSE",
              data: rows.filter((r) => r.method === "fourier"),
              x: (r: Row) => (r.parameters / 2 - 1) / 2,
              y: (r: Row) => r.error,
            },
            {
              title: "Bézier segments vs RMSE",
              data: rows.filter((r) => r.method === "bezier"),
              x: (r: Row) => r.segments,
              y: (r: Row) => r.error,
            },
            {
              title: "Scalar parameters vs time (ms)",
              data: rows,
              x: (r: Row) => r.parameters,
              y: (r: Row) => r.milliseconds,
            },
          ].map((chart) => {
            const xmax = Math.max(1, ...chart.data.map(chart.x)),
              ymax = Math.max(0.0001, ...chart.data.map(chart.y));
            return (
              <div key={chart.title}>
                <h4>{chart.title}</h4>
                <svg viewBox="0 0 300 140" role="img" aria-label={chart.title}>
                  <path d="M30 10V115H290" fill="none" stroke="var(--border)" />
                  {chart.data.map((r, i) => (
                    <circle
                      key={i}
                      cx={30 + (250 * chart.x(r)) / xmax}
                      cy={115 - (100 * chart.y(r)) / ymax}
                      r="3"
                      fill={r.method === "fourier" ? "#237d68" : "#da8660"}
                    >
                      <title>
                        {r.method}: x={chart.x(r)}, y=
                        {chart.y(r).toPrecision(5)}
                      </title>
                    </circle>
                  ))}
                  <g fontSize="8" fill="var(--muted)">
                    <text x="3" y="15">
                      {ymax.toPrecision(2)}
                    </text>
                    <text x="25" y="130">
                      0
                    </text>
                    <text x="260" y="130">
                      {xmax}
                    </text>
                  </g>
                </svg>
              </div>
            );
          })}
          <p>
            Green: Fourier · Orange: Bézier. Hover a point for measured values.
            Each fit is timed once; small timings are noisy.
          </p>
        </div>
      )}
    </div>
  );
}
