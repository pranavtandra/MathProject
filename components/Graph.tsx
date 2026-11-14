"use client";
import { useEffect, useRef, useState } from "react";
import { Curve, Point } from "@/lib/math";
export const colors = ["#237d68", "#da8660", "#7775ba", "#bf9d35", "#4e8eaf"];
export default function Graph({
  curves,
  contours,
  selected,
  onSelect,
  grid,
  showContours,
  showCurves,
  overlay,
  hidden = [],
  hovered = null,
  onHover,
  focusRequest = 0,
  plane = true,
  fittedCurves,
}: {
  curves: Curve[];
  contours: Point[][];
  selected: number;
  onSelect: (i: number) => void;
  grid: number;
  showContours: boolean;
  showCurves: boolean;
  overlay: string;
  hidden?: number[];
  hovered?: number | null;
  onHover?: (i: number | null) => void;
  focusRequest?: number;
  plane?: boolean;
  fittedCurves?: Curve[];
}) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  function fitPoints(points: Point[]) {
    if (!points.length) return;
    const x = points.map((p) => p[0]),
      y = points.map((p) => -p[1]);
    const minX = Math.min(...x),
      maxX = Math.max(...x),
      minY = Math.min(...y),
      maxY = Math.max(...y);
    const span = Math.max(2, maxX - minX, maxY - minY) * 1.3;
    setView({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      scale: Math.max(0.000001, Math.min(8, 24 / span)),
    });
  }
  useEffect(() => {
    if (fittedCurves?.length) fitPoints(fittedCurves.flatMap((c) => c.points));
  }, [fittedCurves]);
  useEffect(() => {
    if (focusRequest && curves[selected]) fitPoints(curves[selected].points);
  }, [focusRequest]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const extent = 12 / view.scale;
  const path = (p: Point[], closed = true) =>
    p.map((q, i) => `${i ? "L" : "M"}${q[0]},${-q[1]}`).join(" ") +
    (closed ? "Z" : "");
  const lines = [];
  const spacing = grid * Math.max(1, Math.ceil((extent * 2) / grid / 100));
  for (
    let i = Math.ceil((-extent + view.x) / spacing) * spacing;
    i < extent + view.x;
    i += spacing
  )
    lines.push(
      <line
        key={"v" + i}
        x1={i}
        x2={i}
        y1={-extent + view.y}
        y2={extent + view.y}
      />,
    );
  for (
    let i = Math.ceil((-extent + view.y) / spacing) * spacing;
    i < extent + view.y;
    i += spacing
  )
    lines.push(
      <line
        key={"h" + i}
        y1={i}
        y2={i}
        x1={-extent + view.x}
        x2={extent + view.x}
      />,
    );
  return (
    <div
      className="graph"
      onWheel={(e) =>
        setView((v) => ({
          ...v,
          scale: Math.max(
            0.000001,
            Math.min(8, v.scale * (e.deltaY > 0 ? 0.9 : 1.1)),
          ),
        }))
      }
    >
      <svg
        id="math-graph"
        role="group"
        aria-label="Interactive Cartesian reconstruction. Drag to pan and scroll to zoom."
        viewBox={`${-extent + view.x} ${-extent + view.y} ${extent * 2} ${extent * 2}`}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-curve]")) return;
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const factor = (extent * 2) / Math.min(rect.width, rect.height);
          setView((v) => ({
            ...v,
            x: v.x - (e.clientX - drag.current!.x) * factor,
            y: v.y - (e.clientY - drag.current!.y) * factor,
          }));
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {overlay && (
          <image
            href={overlay}
            x="-10"
            y="-10"
            width="20"
            height="20"
            preserveAspectRatio="xMidYMid meet"
            opacity={showCurves || showContours ? 0.2 : 1}
          />
        )}
        {plane && (
          <>
            <g stroke="var(--grid)" strokeWidth={0.018 / view.scale}>
              {lines}
            </g>
            <g stroke="var(--axis)" strokeWidth={0.035 / view.scale}>
              <line x1={-100} x2={100} y1={0} y2={0} />
              <line x1={0} x2={0} y1={-100} y2={100} />
            </g>
            <g
              fill="var(--muted)"
              fontSize={0.32 / view.scale}
              fontFamily="monospace"
            >
              {[-8, -4, 4, 8].map((n) => (
                <g key={n}>
                  <text x={n} y={0.5 / view.scale}>
                    {n}
                  </text>
                  <text x={0.2 / view.scale} y={-n}>
                    {n}
                  </text>
                </g>
              ))}
              <text
                x={extent + view.x - 0.6 / view.scale}
                y={-0.25 / view.scale}
              >
                x
              </text>
              <text
                x={0.25 / view.scale}
                y={-extent + view.y + 0.6 / view.scale}
              >
                y
              </text>
            </g>
          </>
        )}
        {showContours &&
          contours.map((p, i) => (
            <path
              key={i}
              d={path(p)}
              fill="none"
              stroke="#c3aaa0"
              strokeDasharray=".08 .1"
              strokeWidth={0.045 / view.scale}
            />
          ))}
        {showCurves &&
          curves.map((c, i) =>
            hidden.includes(i) || !c.points.length ? null : (
              <g key={i} opacity={hovered !== null && hovered !== i ? 0.28 : 1}>
                <path
                  key={i}
                  d={path(c.points, c.closed !== false)}
                  data-curve={i}
                  data-testid={`curve-${i}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select Contour ${String(i + 1).padStart(2, "0")}`}
                  aria-pressed={selected === i}
                  onMouseEnter={() => onHover?.(i)}
                  onMouseLeave={() => onHover?.(null)}
                  onFocus={() => onHover?.(i)}
                  onBlur={() => onHover?.(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(i);
                    }
                  }}
                  onClick={() => onSelect(i)}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth={
                    (hovered === i ? 0.13 : selected === i ? 0.085 : 0.05) /
                    view.scale
                  }
                  strokeLinejoin="round"
                />
                {c.method === "fourier" && c.harmonics === 0 && (
                  <circle
                    data-curve={i}
                    cx={c.points[0][0]}
                    cy={-c.points[0][1]}
                    r={0.12 / view.scale}
                    fill={colors[i % colors.length]}
                    onClick={() => onSelect(i)}
                  />
                )}
              </g>
            ),
          )}
        {showCurves &&
          !hidden.includes(selected) &&
          curves[selected]?.method === "bezier" &&
          curves[selected].segments?.map((s, i) => (
            <g
              key={i}
              stroke="#da8660"
              strokeWidth={0.02 / view.scale}
              fill="#da8660"
            >
              <path
                d={s.control
                  .map((p, j) => `${j ? "L" : "M"}${p[0]},${-p[1]}`)
                  .join(" ")}
                fill="none"
              />
              {s.control.map((p, j) => (
                <circle key={j} cx={p[0]} cy={-p[1]} r={0.07 / view.scale} />
              ))}
            </g>
          ))}
      </svg>
      <div className="graph-caption">
        <span>
          <i /> {curves.length - hidden.length}{" "}
          {curves.length - hidden.length === 1 ? "curve" : "curves"} on the
          plane
        </span>
        <span>
          Drag to pan · Scroll to zoom{" "}
          <button
            onClick={() =>
              fitPoints(
                curves
                  .filter((_, i) => !hidden.includes(i))
                  .flatMap((c) => c.points),
              )
            }
          >
            Fit drawing
          </button>
        </span>
      </div>
    </div>
  );
}
