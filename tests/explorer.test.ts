import test from "node:test";
import assert from "node:assert/strict";
import fixtures from "./fixtures/curves.json";
import {
  Curve,
  Point,
  equations,
  reconstruct,
  evaluateBezier,
  error,
  f,
} from "../lib/math";
import {
  realFourier,
  editCoefficient,
  editControl,
  translateSpline,
  evaluateSpline,
  partialCurve,
  visibleModels,
  segmentCount,
} from "../lib/explorer";
const [fourier, spline, bezier] = fixtures as Curve[];
function near(a: number, b: number, tolerance = 1e-10) {
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
}
function pointsNear(a: Point[], b: Point[]) {
  assert.equal(a.length, b.length);
  a.forEach((p, i) => p.forEach((v, d) => near(v, b[i][d])));
}
// Evaluate only our generated Fourier LaTeX, independently of the curve evaluator.
function latexFourier(line: string, t: number) {
  const expr = line
    .split("=")[1]
    .replace(/\\times10\^{(-?\d+)}/g, "*10**($1)")
    .replace(/\\cos\((\d+)t\)/g, "*Math.cos($1*t)")
    .replace(/\\sin\((\d+)t\)/g, "*Math.sin($1*t)");
  return Function("t", `return ${expr}`)(t) as number;
}

test("real-valued Fourier equations match signed complex coefficients at every rendered sample", () => {
  const c = reconstruct(fourier, 12),
    eq = equations(c, 12),
    data = realFourier(c, 12);
  c.points.forEach((p, j) => {
    const t = (j * 2 * Math.PI) / c.points.length;
    [0, 1].forEach((d) => near(latexFourier(eq[d], t), p[d]));
    const x =
      data.center[0] +
      data.terms.reduce(
        (s, a) => s + a.xcos * Math.cos(a.k * t) + a.xsin * Math.sin(a.k * t),
        0,
      );
    near(x, p[0]);
  });
});
test("scientific notation is valid mathematical LaTeX", () => {
  assert.equal(f(1e-14), "1\\times10^{-14}");
  assert.ok(!f(1e-14).includes("e-"));
});
test("Fourier editing changes graph samples, equation, and RMSE together without mutating fit", () => {
  const before = structuredClone(fourier),
    c = editCoefficient(fourier, 0, "re", 3, 12),
    old = reconstruct(fourier, 12);
  c.points.forEach((p, i) => {
    near(p[0] - old.points[i][0], 3);
    near(p[1], old.points[i][1]);
  });
  assert.deepEqual(fourier, before);
  assert.ok(equations(c, 12)[0].startsWith("x(t)=3"));
  near(c.error, error(c.source, c.points));
  const updated = editCoefficient(c, -3, "im", 0.7, 12);
  updated.points.forEach((p, j) =>
    near(
      latexFourier(equations(updated, 12)[1], (j * 2 * Math.PI) / 256),
      p[1],
    ),
  );
  assert.throws(() => editCoefficient(c, 1, "re", NaN, 12));
  assert.throws(() => editCoefficient(c, 1, "im", 10001, 12));
});
test("Bézier editing uses current control points and preserves shared endpoints", () => {
  const c = editControl(bezier, 0, 1, 0, 7);
  assert.notDeepEqual(c.points, bezier.points);
  near(c.error, error(c.source, c.points));
  c.segments!.forEach((s) => {
    const lo = Math.round(s.start * 256),
      hi = Math.round(s.end * 256);
    for (let j = lo; j < hi; j++)
      evaluateBezier(s, (j - lo) / (hi - lo)).forEach((v, d) =>
        near(v, c.points[j][d]),
      );
  });
  const joined = editControl(c, 0, 0, 1, 2);
  assert.equal(joined.segments!.at(-1)!.control[3][1], 2);
  assert.equal(joined.segments![0].control[0][1], 2);
  assert.ok(equations(c, 12).join("").includes("(7)"));
  assert.ok(equations(c, 12)[2].includes("\\frac"));
});
test("spline translation preserves all periodic joins and updates actual polynomial equations", () => {
  const c = translateSpline(spline, 0, 2);
  c.points.forEach((p, i) => {
    near(p[0], spline.points[i][0] + 2);
    near(p[1], spline.points[i][1]);
    pointsNear([p], [evaluateSpline(c, i / 256)]);
  });
  c.polynomial!.forEach((a, i) => {
    const b = c.polynomial![(i + 1) % c.polynomial!.length],
      u = c.knots![i + 1] - c.knots![i];
    [0, 1].forEach((d) => {
      near(((a[d][0] * u + a[d][1]) * u + a[d][2]) * u + a[d][3], b[d][3]);
      near(3 * a[d][0] * u * u + 2 * a[d][1] * u + a[d][2], b[d][2]);
      near(6 * a[d][0] * u + 2 * a[d][1], 2 * b[d][1]);
    });
  });
  near(c.error, error(c.source, c.points));
  assert.notEqual(equations(c, 12)[0], equations(spline, 12)[0]);
});
test("animation starts at the constant and partial equations export the exact active frequencies", () => {
  const c = partialCurve(fourier, 0, 12);
  const center = fourier.coefficients!.find((a) => a.k === 0)!;
  c.points.forEach((p) => {
    near(p[0], center.re);
    near(p[1], center.im);
  });
  assert.equal(c.harmonics, 0);
  assert.equal(c.parameters, 2);
  assert.ok(!equations(c, 12)[0].includes("cos"));
  for (let n = 0; n <= 12; n++) {
    const part = partialCurve(fourier, n, 12);
    part.points.forEach((p, j) =>
      near(latexFourier(equations(part, 12)[0], (j * 2 * Math.PI) / 256), p[0]),
    );
  }
});
test("segment playback shows and exports only the revealed domains, without closing a partial path", () => {
  for (const c of [spline, bezier]) {
    const empty = partialCurve(c, 0, 12);
    assert.equal(empty.points.length, 0);
    assert.equal(equations(empty, 12).length, 0);
    const part = partialCurve(c, 1, 12);
    assert.equal(segmentCount(part), 1);
    assert.equal(part.closed, false);
    assert.equal(equations(part, 12).length, 3);
    near(
      part.error,
      error(part.source, part.points.slice(0, part.source.length)),
    );
    pointsNear(partialCurve(c, segmentCount(c), 12).points, c.points);
  }
});
test("visibility filters every export by the same stable curve identity", () => {
  const list = [fourier, spline, bezier];
  const visible = visibleModels(list, [1]);
  assert.deepEqual(
    visible.map((v) => v.index),
    [0, 2],
  );
  assert.deepEqual(
    visible.map((v) => v.curve),
    [fourier, bezier],
  );
  assert.equal(visibleModels(list, [0, 1, 2]).length, 0);
});

test("SVG exports hidden identities and open partial segments consistently, including a constant point", async () => {
  const { drawingSvg } = await import("../lib/explorer");
  const part = partialCurve(bezier, 1, 12);
  const svg = drawingSvg([part, bezier], [1], ["#237d68", "#da8660"]);
  assert.ok(svg.includes('id="contour-1"'));
  assert.ok(!svg.includes('id="contour-2"'));
  assert.ok(!svg.includes('Z"'));
  assert.ok(
    drawingSvg([partialCurve(fourier, 0, 12)], [], ["#237d68"]).includes(
      "<circle",
    ),
  );
});
