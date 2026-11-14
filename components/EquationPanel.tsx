"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, RotateCcw, Undo2 } from "lucide-react";
import katex from "katex";
import { Curve, equations, f } from "@/lib/math";
import {
  curveName,
  editCoefficient,
  editControl,
  realFourier,
  translateSpline,
} from "@/lib/explorer";
import { colors } from "./Graph";
export function Formula({ value }: { value: string }) {
  return (
    <div
      className="live-formula"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          displayMode: true,
          throwOnError: false,
        }),
      }}
    />
  );
}
function Numeric({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  return (
    <span className="numeric-field">
      <input
        aria-label={label}
        aria-invalid={invalid}
        title={
          invalid ? "Enter a finite number between −10,000 and 10,000" : label
        }
        type="number"
        step="0.1"
        min="-10000"
        max="10000"
        value={draft}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text);
          const bad =
            text.trim() === "" || !Number.isFinite(n) || Math.abs(n) > 10000;
          setInvalid(bad);
          if (!bad) onChange(n);
        }}
      />
      {invalid && (
        <small role="alert">Finite value required, |value| ≤ 10,000.</small>
      )}
    </span>
  );
}
function preview(c: Curve, h: number) {
  const short = (n: number) => f(Number(n.toPrecision(6)));
  if (c.method !== "fourier") {
    const copy = structuredClone(c);
    copy.polynomial?.forEach((p) =>
      p.forEach((axis) =>
        axis.forEach((v, j) => (axis[j] = Number(v.toPrecision(6)))),
      ),
    );
    copy.segments?.forEach((s) =>
      s.control.forEach((p) =>
        p.forEach((v, j) => (p[j] = Number(v.toPrecision(6)))),
      ),
    );
    return equations(copy, h)
      .slice(0, 3)
      .map((line) => line.replace("=", "\\approx"));
  }
  const data = realFourier(c, c.harmonics ?? h);
  return [0, 1].map((d) => {
    const terms = data.terms
      .flatMap((a) => [
        { value: d ? a.ycos : a.xcos, basis: `\\cos(${a.k}t)` },
        { value: d ? a.ysin : a.xsin, basis: `\\sin(${a.k}t)` },
      ])
      .filter((a) => Math.abs(a.value) > 1e-10);
    const center =
      Math.abs(data.center[d]) > 1e-10 ? short(data.center[d]) : "";
    const shown = terms.slice(0, 2).map((a) => `(${short(a.value)})${a.basis}`);
    const first =
      [...(center ? [center] : []), ...(shown[0] ? [shown[0]] : [])].join(
        "+",
      ) || "0";
    const rest =
      shown.slice(1).join("+") + (terms.length > 2 ? "+\\cdots" : "");
    return `\\begin{aligned}${d ? "y" : "x"}(t)&\\approx ${first}${rest ? `\\\\&+${rest}` : ""}\\end{aligned}`;
  });
}
function Derivation({ curve: c, baseline }: { curve: Curve; baseline: Curve }) {
  const coeff = baseline.coefficients?.find((a) => a.k === 1);
  return (
    <div className="derivation">
      <h4>From this contour to this equation</h4>
      <p>
        <strong>1 · Measured input.</strong> The engine retained{" "}
        {baseline.source.length} uniformly spaced samples in normalized
        Cartesian units. Image inputs first pass through grayscale thresholding
        and OpenCV boundary detection; examples begin with coordinate paths.
      </p>
      <details>
        <summary>Inspect this contour’s coordinates</summary>
        <div className="sample-data">
          <table>
            <thead>
              <tr>
                <th>j</th>
                <th>xⱼ</th>
                <th>yⱼ</th>
              </tr>
            </thead>
            <tbody>
              {baseline.source.map((p, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>{p[0].toPrecision(10)}</td>
                  <td>{p[1].toPrecision(10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p>
        <strong>2 · Parameterization.</strong> The closed polygon is resampled
        by cumulative arc length. Sample j is evaluated at{" "}
        {c.method === "fourier" ? "tⱼ = 2πj/M" : "tⱼ = j/M"}, with M ={" "}
        {baseline.source.length}.
      </p>
      {c.method === "fourier" ? (
        <>
          <p>
            <strong>3 · General coefficient rule.</strong> The FFT computes the
            following discrete sum for each signed frequency.
          </p>
          <Formula
            value={`c_k=\\frac{1}{${baseline.source.length}}\\sum_{j=0}^{${baseline.source.length - 1}}(x_j+iy_j)e^{-2\\pi i k j/${baseline.source.length}}`}
          />
          <p>
            <strong>4 · This fit.</strong> For example, the fitted coefficient
            at k = 1 was {coeff?.re.toPrecision(10)} + (
            {coeff?.im.toPrecision(10)})i. The parameter editor lists the actual
            current coefficients; manual edits replace the fitted values.
          </p>
          <p>
            <strong>5 · Current partial sum.</strong> Keep |k| ≤ {c.harmonics}.
            The numerical real equations above are obtained by pairing +k and
            −k, with no assumption of conjugate symmetry for complex-valued
            contours.
          </p>
          <Formula
            value={
              "A_k=\\Re(c_k)+\\Re(c_{-k}),\\quad B_k=\\Im(c_{-k})-\\Im(c_k)"
            }
          />
          <Formula
            value={
              "C_k=\\Im(c_k)+\\Im(c_{-k}),\\quad D_k=\\Re(c_k)-\\Re(c_{-k})"
            }
          />
        </>
      ) : c.method === "spline" ? (
        <>
          <p>
            <strong>3 · Interpolation constraints.</strong> The original fit
            used {baseline.polynomial!.length} periodic cubic intervals. Values
            at selected knots and first/second derivative continuity determine
            the polynomial coefficients through SciPy’s structured linear solve.
          </p>
          <p>
            <strong>4 · This fit.</strong> First knot (
            {baseline.controls![0].map((n) => n.toPrecision(8)).join(", ")}), at
            t = {baseline.knots![0]}. For each interval use u = t − tⱼ; the
            expanded equations above contain its actual a, b, c, d coefficients.
          </p>
          <p>
            <strong>5 · Safe editing.</strong> Translate x or y below. This adds
            the same displacement to each constant coefficient and preserves
            periodic C² continuity. Knot density remains controlled by
            Reconstruction.
          </p>
        </>
      ) : (
        <>
          <p>
            <strong>3 · Least-squares fit.</strong> For fixed segment endpoints,
            the engine solves a two-column linear least-squares problem for its
            two inner control points. Sections split when the largest residual
            exceeds the requested tolerance, down to a minimum section size.
          </p>
          <p>
            <strong>4 · This fit.</strong> The fit has{" "}
            {baseline.segments!.length} segments. Its first control polygon is{" "}
            {baseline
              .segments![0].control.map(
                (p) => `(${p.map((n) => n.toPrecision(6)).join(", ")})`,
              )
              .join(" → ")}
            .
          </p>
          <p>
            <strong>5 · Current curve.</strong> The numerical Bernstein
            equations use the edited control points. Editing a shared endpoint
            also changes the neighboring segment endpoint, preserving C⁰ joins.
            The exported u-to-t mapping preserves each original interval.
          </p>
        </>
      )}
      <p>
        <strong>6 · Current error.</strong>{" "}
        {c.source.length
          ? `${c.error.toPrecision(8)} units RMSE over ${c.source.length} corresponding samples.`
          : "No segments visible yet; RMSE is not defined."}{" "}
        For segment playback, error covers only the revealed intervals. This is
        not nearest-curve distance.
      </p>
      <Formula value={"E=\\sqrt{\\frac1M\\sum_j\\lVert p_j-q_j\\rVert^2}"} />
    </div>
  );
}
export default function EquationPanel({
  curves,
  models,
  baselines,
  harmonics,
  selected,
  hovered,
  hidden,
  onSelect,
  onHover,
  onToggle,
  onEdit,
  onUndo,
  onReset,
  canUndo,
}: {
  curves: Curve[];
  models: Curve[];
  baselines: Curve[];
  harmonics: number;
  selected: number;
  hovered: number | null;
  hidden: number[];
  onSelect: (i: number) => void;
  onHover: (i: number | null) => void;
  onToggle: (i: number) => void;
  onEdit: (i: number, c: Curve) => void;
  onUndo: () => void;
  onReset: (i: number) => void;
  canUndo: boolean;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => {
    refs.current[selected]?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "nearest",
    });
  }, [selected]);
  return (
    <aside className="live-equations" aria-label="Live mathematical equations">
      <div className="notebook-heading">
        <div>
          <h2>
            Equations
            <span>{curves.length.toString().padStart(2, "0")}</span>
          </h2>
        </div>
        <button className="small-action" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={14} />
          Undo edit
        </button>
      </div>
      <p className="notebook-note">
        Select an equation to focus its curve. Edit a number to change its
        shape.
      </p>
      {!curves.length && (
        <p className="empty-equations">
          Upload a drawing or choose an example to reveal its equations.
        </p>
      )}
      {curves.map((c, i) => {
        const model = models[i],
          h = c.harmonics ?? harmonics;
        return (
          <article
            ref={(el) => {
              refs.current[i] = el;
            }}
            key={i}
            id={`equation-${i}`}
            data-testid={`equation-${i}`}
            className={`live-equation ${selected === i ? "is-selected" : ""} ${hovered === i ? "is-hovered" : ""} ${hidden.includes(i) ? "is-hidden" : ""}`}
            style={
              {
                "--curve-color": colors[i % colors.length],
              } as React.CSSProperties
            }
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(i)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) onHover(null);
            }}
          >
            <div className="equation-title">
              <button
                className="select-equation"
                aria-pressed={selected === i}
                onClick={() => onSelect(i)}
              >
                <span className="curve-swatch" />
                <strong>{curveName(i)}</strong>
                <span className="method-badge">
                  {c.method === "fourier"
                    ? "Fourier"
                    : c.method === "spline"
                      ? "Cubic spline"
                      : "Bézier"}
                </span>
              </button>
              <button
                title={hidden.includes(i) ? "Show curve" : "Hide curve"}
                aria-label={`${hidden.includes(i) ? "Show" : "Hide"} ${curveName(i)}`}
                aria-pressed={!hidden.includes(i)}
                onClick={() => onToggle(i)}
              >
                {hidden.includes(i) ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="numerical-equations" onClick={() => onSelect(i)}>
              <span className="preview-label">
                Numerical preview · 6 significant figures; tiny terms omitted
              </span>
              {preview(c, h).map((line, j) => (
                <Formula value={line} key={j} />
              ))}
            </div>
            {c.method === "fourier" && (
              <div className="partial-sum">
                <Formula value={`z(t)=\\sum_{k=-${h}}^{${h}}c_k e^{ikt}`} />
                <span>
                  {2 * h + 1} active complex terms · numerical coefficients
                  below
                </span>
              </div>
            )}
            <div className="equation-domain">
              <span>
                {c.method === "fourier"
                  ? "0 ≤ t < 2π"
                  : `0 ≤ t ${c.closed === false ? "<=" : "<"} ${c.method === "bezier" ? (c.segments?.at(-1)?.end ?? 0) : (c.knots?.at(-1) ?? 1)}`}
              </span>
              <span data-testid={`equation-error-${i}`}>
                {c.source.length
                  ? `${c.error.toFixed(6)} RMSE`
                  : "RMSE — no samples"}
              </span>
            </div>
            <details className="full-expression">
              <summary>
                Complete numerical equations
                {c.method === "fourier" && h > 2
                  ? " · preview abbreviated"
                  : c.method !== "fourier"
                    ? " · every segment"
                    : ""}
              </summary>
              {equations(c, h).map((line, j) => (
                <Formula key={j} value={line} />
              ))}
            </details>
            <div className="equation-actions">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      equations(c, h).join("\n"),
                    );
                    setCopied(i);
                  } catch {
                    setCopied(null);
                  }
                }}
              >
                <Copy size={12} />
                {copied === i ? "Copied" : "Copy LaTeX"}
              </button>
              <button onClick={() => onReset(i)}>
                <RotateCcw size={12} />
                Reset fit
              </button>
            </div>
            <details className="parameter-editor">
              <summary>Edit numerical parameters</summary>
              <p>
                Changes are immediate. Values must be finite and within ±10,000.
                Undo restores the previous edit.
              </p>
              {c.method === "fourier" ? (
                <>
                  <div className="editor-table-heading">
                    <span>k</span>
                    <span>Re(cₖ)</span>
                    <span>Im(cₖ)</span>
                  </div>
                  <div className="editor-scroll">
                    {model
                      .coefficients!.filter((a) => Math.abs(a.k) <= harmonics)
                      .sort(
                        (a, b) => Math.abs(a.k) - Math.abs(b.k) || a.k - b.k,
                      )
                      .map((a) => (
                        <div className="editor-table-row" key={a.k}>
                          <span>{a.k}</span>
                          {(["re", "im"] as const).map((part) => (
                            <Numeric
                              key={part}
                              value={a[part]}
                              label={`${curveName(i)} coefficient ${a.k} ${part}`}
                              onChange={(v) =>
                                onEdit(
                                  i,
                                  editCoefficient(
                                    model,
                                    a.k,
                                    part,
                                    v,
                                    harmonics,
                                  ),
                                )
                              }
                            />
                          ))}
                        </div>
                      ))}
                  </div>
                  <p className="editor-help">
                    Playback may show fewer terms. Editing returns to the
                    complete fit. Coefficients outside the harmonic limit are
                    retained.
                  </p>
                </>
              ) : c.method === "bezier" ? (
                model.segments!.map((s, j) => (
                  <details key={j}>
                    <summary>
                      Segment {j + 1} · t ∈ [{s.start}, {s.end}]
                    </summary>
                    {s.control.map((p, k) => (
                      <div className="control-point-row" key={k}>
                        <span>P{k}</span>
                        {p.map((v, d) => (
                          <Numeric
                            key={d}
                            value={v}
                            label={`${curveName(i)} segment ${j + 1} P${k} ${d ? "y" : "x"}`}
                            onChange={(v) =>
                              onEdit(i, editControl(model, j, k, d, v))
                            }
                          />
                        ))}
                      </div>
                    ))}
                  </details>
                ))
              ) : (
                <div className="spline-translation">
                  <p>
                    Translate the entire spline safely; knot interpolation and
                    C² continuity are preserved.
                  </p>
                  {[0, 1].map((d) => (
                    <label key={d}>
                      {d ? "y" : "x"} at first knot
                      <Numeric
                        value={model.controls![0][d]}
                        label={`${curveName(i)} spline ${d ? "y" : "x"} at first knot`}
                        onChange={(v) =>
                          onEdit(
                            i,
                            translateSpline(
                              model,
                              d,
                              v - model.controls![0][d],
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </details>
            <details className="curve-derivation">
              <summary>Show derivation · this contour</summary>
              <Derivation curve={c} baseline={baselines[i] ?? model} />
            </details>
          </article>
        );
      })}
    </aside>
  );
}
