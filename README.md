# MathSketch

A local image-to-equation laboratory. Upload high-contrast line art, draw on the canvas, or load a reproducible coordinate example. Inspect real Fourier, spline, or Bézier parameters and export the result. No accounts, database, paid APIs, or AI services.

## Run locally

Requires Node.js 20.9+ and Python 3.10+ (Python 3.9 works with the compatible versions installed in the included local environment).

```sh
npm install
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
npm run dev
```

Open http://localhost:3000. Next.js proxies `/engine/*` to the Python service. FastAPI's interactive API documentation is at http://127.0.0.1:8000/docs. Both processes must run. Stop either with Ctrl+C.

## Architecture

- `backend/engine.py`: contour extraction, arc-length resampling, coordinate normalization, Fourier transforms, spline construction, adaptive Bézier fitting, examples, errors.
- `backend/main.py`: validated FastAPI endpoints for extraction, examples, fitting.
- `lib/math.ts`: local harmonic evaluation, editable Bézier evaluation, exact coefficient-based LaTeX and data exports.
- `components/Graph.tsx`: interactive SVG Cartesian plane with equal coordinate scales, image overlay, contour selection, pan and zoom.
- `components/Studio.tsx`: pen, eraser, undo/redo, raster drawing input.
- `app/page.tsx`: workspace, experiments, equation inspection, export orchestration.

SVG provides the equivalent interactive graphing layer without a large plotting dependency. KaTeX renders mathematical notation; Tailwind and custom CSS define the responsive light/dark workspace.

## Workflow

1. Use the always-visible **Draw**, **Equations & graph**, and **Explore math** tabs to move between tasks. Arrow keys also switch tabs when a tab has focus.
2. Choose **Upload image**, drag a file onto the source bar, or open **Examples**. These actions remain available in every workspace.
3. In **Draw**, use the labeled Pen, Eraser, stroke-width, Undo, Redo, and Clear tools. **Convert to equations** becomes available once the canvas has ink. Conversion opens the reconstructed drawing automatically.
4. In **Equations & graph**, choose the fitting method and adjust detail directly above the workspace. The graph automatically fits a new result. Use comparison controls for the original image, detected contours, reconstruction, or overlay.
5. Select a curve or its equation to link the two views. Expand numeric parameters or the derivation when needed. **Animate curve** reveals playback controls.
6. In **Explore math**, compare measured fitting results and run the complexity experiments. **Export** in the header downloads PNG, SVG, LaTeX, JSON, or contour CSV from the current reconstruction.

Switching workspaces preserves the drawing canvas, drawing undo history, equation edits, graph view, and experiment results. Work is in-memory only; refreshing still resets it. The drawing canvas has a fixed aspect ratio so pointer coordinates match the exported bitmap.

Image threshold controls apply on the next upload. Inputs resize to a 1200-pixel longest side. At most 24 significant boundaries are retained. Images retain aspect ratio in a 20-unit Cartesian frame with upward-positive y. Separate exterior and interior boundaries remain separate curves.

## Mathematics and error

See [MATH_NOTES.md](MATH_NOTES.md) for derivations and complexity. Every contour uses 256 uniform arc-length samples. Reported error is `sqrt(mean(||p_j - q_j||²))`, in normalized coordinate units, at corresponding parameter values. It is neither Hausdorff distance nor a perceptual score. Method comparisons use this same metric.

The default heart at 12 harmonics has approximately 0.055-unit RMSE; exact results can be reproduced through `/examples/heart` followed by `/fit`. A uniformly sampled circle reconstructs to floating-point precision with one harmonic. Tests assert these properties rather than hardcoding UI results. Timing is measured with Python `perf_counter` or browser `performance.now`; the UI labels which operation is timed. Timing depends on your machine and excludes request latency.

Fourier LaTeX uses actual retained coefficients. Spline exports include the exact local cubic coefficients and knot intervals. Bézier exports use actual control points. JSON retains full double precision; LaTeX rounds to 15 significant figures. SVG/PNG are 256-point sampled renderings, so they have polygonal discretization error in addition to fitting error.

## Verification

```sh
.venv/bin/python -m pytest backend/tests -q
npm test
npm run typecheck
npm run build
```

Tests cover circles, a synthetic heart, resampling, coordinate transforms, Bézier evaluation and export parameter consistency, periodic spline C0/C1/C2 continuity, RMSE, disconnected shapes and holes, empty/malformed images, API validation, open ink strokes, and self-intersecting examples.

## Limitations and remaining work

- Optimized for drawings, silhouettes, logos, and simple line art, not photographs.
- Open ink strokes are converted to closed boundaries around the stroke. Native open-path fitting and centerline extraction are not implemented.
- Small features below the area filter are discarded. Dense images can exceed the 24-contour cap. Nested boundary metadata marks an interior boundary, rather than a complete fill topology.
- Spline control changes knot density; it is interpolation, not a penalized smoothing spline.
- Adaptive Bézier fitting uses uniform source indices within segments, not optimized nearest-point parameterization. Joins are C0, not guaranteed C1.
- Bézier controls are editable numerically; direct graph dragging remains future work.
- The harmonic error experiment and method comparison are implemented. The optional iterative optimization workspace, Desmos-specific export, and individual coefficient contribution animation remain future work.
- The harmonic chart spans 1–32, while the main reconstruction supports 1–64.
- No persistent cache or project storage. A refresh resets the workspace.

These limitations are intentional and visible; no benchmark values or symbolic results are fabricated.

## Live Mathematical Equation Explorer

The persistent mathematical notebook and graph share one evaluated model for every contour. Desktop begins with a 40/60 split; drag the divider or use its left/right arrow keys (30–65% equations). On mobile, Equations / Graph switches retain both views. Input and examples stay in the source bar, fitting controls remain above the graph, and Draw and Explore math have dedicated tabs.

- Each color-coded card shows a numerical x/y preview, domain, method, visibility, and current RMSE. Previews use six significant figures and omit terms below 1e-10; they are explicitly marked approximate. Expand **Complete numerical equations** or copy LaTeX for the full 15-significant-figure expression.
- Equation selection focuses the graph; curve selection scrolls to its equation. Keyboard Enter activates curves. Hover and focus link both sides.
- Edit real/imaginary Fourier coefficients, Bézier control coordinates (shared endpoints remain joined), or the spline’s first-knot coordinates to translate the whole periodic spline. These are numeric editors, not an arbitrary symbolic parser. Inputs reject nonfinite values and magnitudes above 10,000. Undo stores the last 50 edits; Reset fit restores the selected original model. Changing the fit method or input begins a new edit history.
- Fourier playback starts at c0 and adds ±k pairs. Spline/Bézier playback reveals segments. Play, pause, restart, stepping, speed, and Full fit controls share the current model with equations and exports. Segment RMSE covers only revealed source samples; before any segment, it is undefined. Fourier RMSE always covers the whole sampled contour.
- **Show derivation** distinguishes the general formulas from this contour’s 256 coordinates, fitted coefficients/control points/knots, current modifications, and measured error.
- Original, contours, reconstruction, and overlay comparison modes preserve the existing layers. Coordinate plane/axes can be toggled independently.
- All exports exclude hidden equation cards. JSON includes stable original contour indices, hidden contour indices, playback step, current curve parameters, and sampled coordinates. During Fourier playback, use each curve’s `harmonics` field (the top-level `harmonics` is the full-fit setting). Bézier LaTeX specifies local u as a function of global t. Partial segment SVG/PNG paths remain open. SVG view bounds expand for translated/edited curves.

`lib/explorer.ts` contains transformations and partial-model selection using the existing evaluators; it does not refit uploaded images. `components/EquationPanel.tsx` renders/edit these same models. The engine API is unchanged. `tests/fixtures/curves.json` contains reproducible heart fits from `backend.engine.fit`; the TypeScript tests independently evaluate generated Fourier LaTeX, edits, spline continuity, shared Bézier endpoints, playback, and stable visibility filtering. Browser checks additionally exercised uploaded disconnected shapes with a hole, linked selection, Fourier edits/undo, derivations, playback, and partial JSON export.
