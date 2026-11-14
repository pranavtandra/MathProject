export type Point = [number, number];
export type Coefficient = { k: number; re: number; im: number };
export type Segment = { start: number; end: number; control: Point[] };
export type Curve = {
  method: string;
  harmonics?: number;
  closed?: boolean;
  source: Point[];
  points: Point[];
  error: number;
  milliseconds: number;
  parameters: number;
  coefficients?: Coefficient[];
  segments?: Segment[];
  knots?: number[];
  polynomial?: number[][][];
  controls?: Point[];
};
export function reconstruct(c: Curve, n: number): Curve {
  const start = performance.now();
  const points = c.source.map((_, j) => {
    let x = 0,
      y = 0;
    for (const a of c.coefficients || []) {
      if (Math.abs(a.k) > n) continue;
      const t = (a.k * j * 2 * Math.PI) / c.source.length;
      x += a.re * Math.cos(t) - a.im * Math.sin(t);
      y += a.re * Math.sin(t) + a.im * Math.cos(t);
    }
    return [x, y] as Point;
  });
  return {
    ...c,
    harmonics: n,
    closed: true,
    points,
    error: error(c.source, points),
    parameters: 2 * (2 * n + 1),
    milliseconds: performance.now() - start,
  };
}
export function error(a: Point[], b: Point[]) {
  return Math.sqrt(
    a.reduce(
      (s, p, i) => s + (p[0] - b[i][0]) ** 2 + (p[1] - b[i][1]) ** 2,
      0,
    ) / a.length,
  );
}
export function evaluateBezier(s: Segment, t: number): Point {
  const u = 1 - t;
  return [0, 1].map(
    (d) =>
      u ** 3 * s.control[0][d] +
      3 * u * u * t * s.control[1][d] +
      3 * u * t * t * s.control[2][d] +
      t ** 3 * s.control[3][d],
  ) as Point;
}
export function updateBezier(c: Curve): Curve {
  const points = c.source.map((_, i) => {
    const t = i / c.source.length;
    const s =
      c.segments!.find((s) => t >= s.start && t < s.end) || c.segments!.at(-1)!;
    return evaluateBezier(s, (t - s.start) / (s.end - s.start));
  });
  return { ...c, points, error: error(c.source, points) };
}
export const f = (n: number) => {
  const text = Number(n.toPrecision(15)).toString();
  const [mantissa, power] = text.split("e");
  return power ? `${mantissa}\\times10^{${Number(power)}}` : text;
};
export function equations(c: Curve, h: number) {
  if (c.method === "fourier") {
    h = c.harmonics ?? h;
    const get = (k: number) =>
      c.coefficients!.find((a) => a.k === k) ?? { re: 0, im: 0 };
    const x = [f(get(0).re)],
      y = [f(get(0).im)];
    for (let k = 1; k <= h; k++) {
      const p = get(k),
        m = get(-k);
      x.push(`(${f(p.re + m.re)})\\cos(${k}t)+(${f(m.im - p.im)})\\sin(${k}t)`);
      y.push(`(${f(p.im + m.im)})\\cos(${k}t)+(${f(p.re - m.re)})\\sin(${k}t)`);
    }
    return ["x(t)=" + x.join("+"), "y(t)=" + y.join("+"), "0\\le t<2\\pi"];
  }
  if (c.method === "bezier")
    return c.segments!.flatMap((s, i) => [
      ...([0, 1] as const).map(
        (d) =>
          `${d ? "y" : "x"}_{${i + 1}}(u)=(${f(s.control[0][d])})(1-u)^3+3(${f(s.control[1][d])})(1-u)^2u+3(${f(s.control[2][d])})(1-u)u^2+(${f(s.control[3][d])})u^3`,
      ),
      `u=\\frac{t-${f(s.start)}}{${f(s.end - s.start)}},\quad ${f(s.start)}\\le t\\le ${f(s.end)}`,
    ]);
  return c.polynomial!.flatMap((p, i) => [
    ...([0, 1] as const).map(
      (d) =>
        `${d ? "y" : "x"}_{${i + 1}}(t)=${p[d].map((a, j) => `(${f(a)})(t-${f(c.knots![i])})^{${3 - j}}`).join("+")}`,
    ),
    `${f(c.knots![i])}\\le t<${f(c.knots![i + 1])}`,
  ]);
}
export function download(name: string, data: string, type: string) {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
