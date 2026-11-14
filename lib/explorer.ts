import { Curve, Point, reconstruct, updateBezier, error } from "./math";

/** Positive-frequency real form of the same complex Fourier series. */
export function realFourier(c: Curve, h: number) {
  const get = (k: number) =>
    c.coefficients?.find((a) => a.k === k) ?? { re: 0, im: 0 };
  return {
    center: [get(0).re, get(0).im] as Point,
    terms: Array.from({ length: h }, (_, i) => {
      const k = i + 1,
        positive = get(k),
        negative = get(-k);
      return {
        k,
        xcos: positive.re + negative.re,
        xsin: negative.im - positive.im,
        ycos: positive.im + negative.im,
        ysin: positive.re - negative.re,
      };
    }),
  };
}
export function evaluateSpline(c: Curve, t: number): Point {
  const upper = c.knots!.findIndex((k, j) => j > 0 && t < k);
  const i = upper < 0 ? c.polynomial!.length - 1 : Math.max(0, upper - 1);
  const u = t - c.knots![i];
  return c.polynomial![i].map(
    (p) => ((p[0] * u + p[1]) * u + p[2]) * u + p[3],
  ) as Point;
}
export function editCoefficient(
  c: Curve,
  k: number,
  part: "re" | "im",
  value: number,
  h: number,
): Curve {
  validate(value);
  return reconstruct(
    {
      ...c,
      coefficients: c.coefficients!.map((a) =>
        a.k === k ? { ...a, [part]: value } : a,
      ),
    },
    h,
  );
}
export function editControl(
  c: Curve,
  segment: number,
  point: number,
  dimension: number,
  value: number,
): Curve {
  validate(value);
  const copy = structuredClone(c),
    segments = copy.segments!;
  segments[segment].control[point][dimension] = value;
  // Preserve shared endpoints, including the closed seam.
  if (point === 0)
    segments[(segment - 1 + segments.length) % segments.length].control[3][
      dimension
    ] = value;
  if (point === 3)
    segments[(segment + 1) % segments.length].control[0][dimension] = value;
  return updateBezier(copy);
}
export function translateSpline(
  c: Curve,
  dimension: number,
  delta: number,
): Curve {
  validate(c.controls![0][dimension] + delta);
  const copy = structuredClone(c);
  copy.polynomial!.forEach((p) => (p[dimension][3] += delta));
  copy.controls?.forEach((p) => (p[dimension] += delta));
  copy.points = copy.source.map((_, i) =>
    evaluateSpline(copy, i / copy.source.length),
  );
  copy.error = error(copy.source, copy.points);
  return copy;
}
export function validate(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > 10000)
    throw new Error("Enter a finite number between −10,000 and 10,000.");
}
export function segmentCount(c: Curve) {
  return c.method === "bezier"
    ? c.segments!.length
    : c.method === "spline"
      ? c.polynomial!.length
      : 0;
}
/** One displayed model supplies the graph, notebook, error, and all exports. */
export function partialCurve(
  c: Curve,
  step: number | null,
  harmonics: number,
): Curve {
  if (c.method === "fourier")
    return reconstruct(c, Math.min(harmonics, step ?? harmonics));
  if (step === null || step >= segmentCount(c)) return { ...c, closed: true };
  const count = Math.max(0, step);
  const end =
    c.method === "bezier"
      ? (c.segments![count - 1]?.end ?? 0)
      : c.knots![count];
  const length = Math.round(end * c.source.length);
  const points = c.points.slice(0, length);
  // Include the final segment endpoint in the visible path, but not in sample RMSE.
  const endpoint =
    count === 0
      ? undefined
      : c.method === "bezier"
        ? c.segments![count - 1].control[3]
        : evaluateSpline(c, end);
  return {
    ...c,
    points: endpoint ? [...points, endpoint] : points,
    source: c.source.slice(0, length),
    error: length ? error(c.source.slice(0, length), points) : 0,
    closed: false,
    segments: c.segments?.slice(0, count),
    polynomial: c.polynomial?.slice(0, count),
    knots: c.knots?.slice(0, count + 1),
    controls: c.controls?.slice(0, count + 1),
    parameters: count * 8,
  };
}
export function visibleModels(curves: Curve[], hidden: number[]) {
  return curves
    .map((curve, index) => ({ curve, index }))
    .filter(({ index }) => !hidden.includes(index));
}
export const curveName = (i: number) =>
  `Contour ${String(i + 1).padStart(2, "0")}`;

/** Sampled vector export of precisely the models shown in the notebook. */
export function drawingSvg(
  curves: Curve[],
  hidden: number[],
  palette: string[],
) {
  const visible = visibleModels(curves, hidden);
  const points = visible.flatMap(({ curve }) => curve.points);
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => -p[1]);
  const left = Math.min(-12, ...xs) - 1,
    top = Math.min(-12, ...ys) - 1;
  const size =
    Math.max(Math.max(12, ...xs) - left, Math.max(12, ...ys) - top) + 1;
  const paths = visible
    .map(({ curve: c, index }) => {
      if (!c.points.length) return "";
      const color = palette[index % palette.length];
      if (c.method === "fourier" && c.harmonics === 0)
        return `<circle id="contour-${index + 1}" cx="${c.points[0][0]}" cy="${-c.points[0][1]}" r="${size * 0.005}" fill="${color}"/>`;
      return `<path id="contour-${index + 1}" d="${c.points.map((p, j) => `${j ? "L" : "M"}${p[0]},${-p[1]}`).join(" ")}${c.closed === false ? "" : "Z"}" stroke="${color}" fill="none" stroke-width="${size * 0.0025}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${size} ${size}" width="1200" height="1200"><rect x="${left}" y="${top}" width="${size}" height="${size}" fill="white"/>${paths}</svg>`;
}
