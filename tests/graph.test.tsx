import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Graph from "../components/Graph";
import EquationPanel from "../components/EquationPanel";
import fixtures from "./fixtures/curves.json";
import { Curve } from "../lib/math";
import { editCoefficient, partialCurve } from "../lib/explorer";
const original = fixtures[0] as Curve;
const graph = (c: Curve, hidden: number[] = []) =>
  renderToStaticMarkup(
    <Graph
      curves={[c, c]}
      contours={[c.source, c.source]}
      selected={0}
      hovered={0}
      hidden={hidden}
      onSelect={() => {}}
      grid={2}
      showContours={false}
      showCurves={true}
      overlay=""
    />,
  );

test("graph geometry changes with a coefficient edit and uses stable accessible curve identities", () => {
  const before = graph(original),
    edited = graph(editCoefficient(original, 0, "re", 2, 12));
  assert.notEqual(before, edited);
  assert.ok(edited.includes('data-testid="curve-0"'));
  assert.ok(edited.includes('aria-label="Select Contour 01"'));
  assert.ok(edited.includes('stroke="#237d68"'));
  assert.ok(edited.includes('opacity="0.28"'));
});
test("hidden equation removes its actual SVG curve but preserves other identities", () => {
  const markup = graph(original, [0]);
  assert.ok(!markup.includes('data-testid="curve-0"'));
  assert.ok(markup.includes('data-testid="curve-1"'));
});
test("notebook and graph consume the same partial harmonic model after editing", () => {
  const edited = editCoefficient(original, 0, "re", 2, 12),
    part = partialCurve(edited, 0, 12);
  const markup = renderToStaticMarkup(
    <EquationPanel
      curves={[part]}
      models={[edited]}
      baselines={[original]}
      harmonics={12}
      selected={0}
      hovered={0}
      hidden={[]}
      onSelect={() => {}}
      onHover={() => {}}
      onToggle={() => {}}
      onEdit={() => {}}
      onUndo={() => {}}
      onReset={() => {}}
      canUndo={true}
    />,
  );
  assert.ok(markup.includes('data-testid="equation-0"'));
  assert.ok(markup.includes(part.error.toFixed(6) + " RMSE"));
  assert.ok(
    markup.includes("1 active complex terms") ||
      markup.includes("1<!-- --> active complex terms") ||
      markup.includes("1<!-- --> active"),
  );
  const svg = graph(part);
  assert.ok(svg.includes('cx="2"'));
  assert.ok(markup.includes("is-selected is-hovered"));
});
