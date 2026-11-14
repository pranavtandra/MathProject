# Mathematical foundations

## 1. From pixels to Cartesian boundaries

The problem is to identify significant closed boundaries of dark regions. OpenCV decodes the image, converts to grayscale, thresholds intensity, and retrieves a full contour tree. A predominately dark threshold mask is inverted. Area filtering rejects tiny components; contour hierarchy preserves interior boundaries as separate curves.

For image dimensions W,H and s = 20/max(W,H), pixel coordinates become x = s(u-W/2), y = -s(v-H/2). This preserves aspect ratio and changes downward-positive image coordinates to upward-positive graph coordinates. Resizing precedes normalization. Work is O(WH) plus boundary length. Threshold sensitivity, anti-aliasing, noise, and background assumptions affect results. A hollow stroke produces both sides of the ink, not its centerline.

## 2. Arc-length resampling

Given vertices p_i, close the polygon and compute cumulative distances d_i = Σ ||p_j-p_{j-1}||. At M=256 positions j L/M, interpolate along polygon edges. Coincident consecutive vertices are removed. A zero-length path is invalid. This yields samples evenly spaced in polygonal arc length and makes results independent of the contour detector's pixel sampling density. Complexity is O(P+M) apart from interpolation lookup. Corners are preserved approximately; features smaller than one sample spacing may disappear.

## 3. Parametric Fourier representation

A drawing need not satisfy y=f(x). Instead let z(t)=x(t)+iy(t), 0≤t<2π. For uniformly sampled z_j, the DFT gives

c_k = (1/M) Σ_j z_j exp(-2πikj/M).

Reconstruct using z_N(t)=Σ_{k=-N}^{N} c_k exp(ikt). Writing c_k=a_k+ib_k gives

x_N(t)=Σ[a_k cos(kt)-b_k sin(kt)],
y_N(t)=Σ[a_k sin(kt)+b_k cos(kt)].

NumPy FFT computes all coefficients once in O(M log M). The client evaluates retained frequencies in O(MN) for each slider update. Negative frequency bins come from FFT frequency indexing; N≤64 stays below the Nyquist frequency for M=256. There are 2(2N+1) real scalar coefficients, including translation. A circle traversed uniformly has only a constant center and one nonzero rotating frequency. Removing high frequencies smooths corners; sharp or self-intersecting contours may need many terms. Truncation and polygonal sampling both affect accuracy. The full harmonic data remain in JSON, even when only a subset is displayed.

## 4. Periodic cubic splines

Fit a smooth parametric path through a subset of the arc-length samples, using the normalized parameter t∈[0,1). Each coordinate is a piecewise cubic:

S_j(t)=a_j(t-t_j)^3+b_j(t-t_j)^2+c_j(t-t_j)+d_j.

Interpolation constraints fix values at knots, while first and second derivatives match at joins, including the periodic seam. SciPy CubicSpline solves this structured system. The reduction control chooses K=round(128/reduction), clamped to [8,128], knot intervals. This is periodic interpolation with fewer knots, not a smoothing penalty. Coefficients are serialized in descending power order per coordinate per interval. Complexity is O(K+M). Sparse knots can overshoot or erase sharp features. Periodicity assumes a closed path. Model complexity counts 2K independent knot coordinate values; stored polynomial coefficients are redundant derived data.

## 5. Piecewise cubic Bézier fitting

For u∈[0,1], B(u)=(1-u)^3P0+3(1-u)^2uP1+3(1-u)u²P2+u³P3. Endpoints P0,P3 are fixed to the segment endpoints. For each coordinate solve a two-column linear least-squares problem for P1,P2 after subtracting the endpoint terms. NumPy lstsq uses a stable numerical factorization rather than explicit normal-equation inversion.

Start with eight sections. Evaluate at uniform source-index parameters within each section. If maximum point residual exceeds tolerance, bisect recursively until accepted or only four intervals remain. Work is approximately O(M log M) in the worst balanced recursion. Segment joins share endpoints (C0); tangent continuity is not imposed. The tolerance is a splitting criterion, not a certified continuous Hausdorff bound, and minimum-sized segments may exceed it. Editable control values directly replace the coefficients used by the evaluator; error is recomputed. Complexity counts eight stored real scalars per segment, including duplicated join endpoints.

## 6. Error and experiments

E = sqrt((1/M) Σ_j ||p_j - q_j||²).

All fits evaluate at the same corresponding source sample indices. This enables a consistent RMSE comparison, but different parameterizations of the same geometric path can receive different errors. It does not measure nearest-curve distance, area overlap, or visual quality. The Bézier split criterion uses maximum residual, whereas the UI uses RMSE; these are distinct metrics.

The harmonic experiment evaluates actual retained coefficient sets at N=1,…,32. Parseval's identity explains the nonincreasing sampled Fourier error when adding orthogonal frequencies. The three-method comparison runs the Python fits with current controls and records actual fit/evaluation time. Client harmonic timings measure local evaluation only; compare server timing rows to server timing rows. No chart data are synthetic. More terms can reproduce noise, so a lower pixel error does not guarantee a more useful model.

## 7. Export consistency

Fourier exports expand the exact real and imaginary coefficient formula. Spline exports serialize local coefficients and interval domains. Bézier exports substitute control coordinates into the Bernstein basis. Tests evaluate exported numerical spline/Bézier parameters and compare every sample to reconstruction output. JSON preserves full precision; human-readable LaTeX uses fifteen significant figures. Graph, SVG, and PNG connect 256 evaluations with straight segments. They approximate the underlying continuous equations and should not be mistaken for exact continuous vector paths.

## 8. Optimization outlook

The implemented Bézier inner-point fit is an actual linear least-squares optimization. It has a global minimizer for the fixed endpoints and assigned parameters; no iterative gradient is involved. A future experiment could optimize closest-point parameters or tangent-continuous controls with SciPy. Such an experiment must distinguish analytical gradients, finite-difference numerical gradients, and derivative-free methods, and record real iteration residuals. There is currently no iterative optimization dashboard.

## 9. Live equation transformations

Positive-frequency real coefficients are A_k=Re(c_k)+Re(c_-k), B_k=Im(c_-k)-Im(c_k), C_k=Im(c_k)+Im(c_-k), D_k=Re(c_k)-Re(c_-k). Thus x(t)=Re(c0)+Σ[A_k cos(kt)+B_k sin(kt)] and y(t)=Im(c0)+Σ[C_k cos(kt)+D_k sin(kt)]. Complex contour sequences do not generally have conjugate-symmetric coefficients. Automated tests evaluate these expanded exported expressions at every sample and compare with signed complex reconstruction, including edits to negative-frequency imaginary coefficients.

Spline editing adds a displacement to every local constant coefficient in one coordinate, preserving derivatives and knot continuity. Bézier endpoint edits propagate to the corresponding neighbor endpoint, preserving the original closed C0 topology. Both transformations recalculate corresponding-point RMSE. Undo restores immutable parameter snapshots. During Fourier animation the active harmonic bound is carried on the curve itself; during segment animation only revealed polynomials and their domains are retained. Consequently the notebook, graph, and exports consume the same partial representation. Revealed segment error excludes the extra geometric endpoint used to draw the last open segment and covers only its original corresponding samples. No error is defined for an empty segment set.
