import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkspaceTabs, { WorkspaceView } from "../components/WorkspaceTabs";
import Studio from "../components/Studio";

test("every workspace has an explicitly named tab and a stable panel association", () => {
  for (const selected of [
    "draw",
    "reconstruct",
    "explore",
  ] as WorkspaceView[]) {
    const html = renderToStaticMarkup(
      <WorkspaceTabs value={selected} onChange={() => {}} />,
    );
    assert.equal((html.match(/role="tab"/g) || []).length, 3);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    for (const id of ["draw", "reconstruct", "explore"])
      assert.ok(html.includes(`aria-controls="view-${id}"`));
    assert.ok(html.includes('aria-label="Draw"'));
    assert.ok(html.includes('aria-label="Equations &amp; graph"'));
    assert.ok(html.includes('aria-label="Explore math"'));
    assert.ok(
      new RegExp(`id="tab-${selected}"[^>]+aria-selected="true"`).test(html),
    );
  }
});
test("drawing starts with named tools and prevents converting an empty canvas", () => {
  const html = renderToStaticMarkup(<Studio convert={() => {}} />);
  assert.ok(html.includes('aria-label="Drawing tools"'));
  assert.ok(html.includes('aria-label="Stroke width"'));
  assert.ok(html.includes('aria-label="Undo drawing"'));
  assert.ok(/<button[^>]+disabled=""[^>]*>Convert to equations/.test(html));
});
