"""Closed-curve reconstruction; all distances use normalized Cartesian units."""
import time
import cv2
import numpy as np
from scipy.interpolate import CubicSpline

SAMPLES = 256

def resample(points, n=SAMPLES):
    p = np.asarray(points, dtype=float)
    if p.ndim != 2 or p.shape[1] != 2 or len(p) < 3 or not np.isfinite(p).all():
        raise ValueError('A contour needs at least three finite points.')
    p = np.vstack([p, p[0]])
    lengths = np.linalg.norm(np.diff(p, axis=0), axis=1)
    keep = np.r_[True, lengths > 1e-10]
    p = p[keep]
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    if d[-1] < 1e-8:
        raise ValueError('Contour has zero length.')
    t = np.linspace(0, d[-1], n, endpoint=False)
    return np.column_stack([np.interp(t, d, p[:, i]) for i in range(2)])

def cartesian(points, width, height):
    return (np.asarray(points) - [width / 2, height / 2]) * [20 / max(width, height), -20 / max(width, height)]

def extract(data, threshold=180, minimum=0.001):
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('The image could not be decoded.')
    h, w = image.shape[:2]
    if min(h, w) < 8 or h * w > 25_000_000:
        raise ValueError('Use an image of at least 8×8 and at most 25 megapixels.')
    scale = min(1, 1200 / max(h, w))
    image = cv2.resize(image, (round(w * scale), round(h * scale)))
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)
    if np.mean(mask > 0) > 0.7:
        mask = 255 - mask
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    paths = []
    for i, c in enumerate(contours):
        if len(c) >= 8 and abs(cv2.contourArea(c)) >= w * h * minimum:
            paths.append({'points': resample(cartesian(c[:, 0, :], w, h)).tolist(), 'hole': bool(hierarchy[0, i, 3] >= 0)})
    paths.sort(key=lambda p: -len(p['points']))
    if not paths:
        raise ValueError('No significant contours found. Try darker strokes or a lower noise filter.')
    return paths[:24], {'width': w, 'height': h, 'truncated': len(paths) > 24}

def fourier(points):
    p = resample(points)
    c = np.fft.fft(p[:, 0] + 1j * p[:, 1]) / len(p)
    k = np.fft.fftfreq(len(p), 1 / len(p)).astype(int)
    return [{'k': int(a), 're': float(b.real), 'im': float(b.imag)} for a, b in zip(k, c)]

def evaluate_fourier(coefficients, harmonics, n=SAMPLES):
    t = np.arange(n) * 2 * np.pi / n
    z = sum((c['re'] + 1j * c['im']) * np.exp(1j * c['k'] * t) for c in coefficients if abs(c['k']) <= harmonics)
    return np.column_stack([z.real, z.imag])

def rmse(a, b):
    return float(np.sqrt(np.mean(np.sum((np.asarray(a) - np.asarray(b)) ** 2, axis=1))))

def bezier(control, t):
    t = np.asarray(t)[:, None]
    a, b, c, d = np.asarray(control)
    return (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d

def fit_bezier(p, tolerance):
    p = np.vstack([p, p[0]])
    segments = []
    def fit(lo, hi):
        q = p[lo:hi+1]
        t = np.linspace(0, 1, len(q))
        u = t[:, None]
        basis = np.column_stack([3*(1-t)**2*t, 3*(1-t)*t*t])
        rhs = q - (1-u)**3*q[0] - u**3*q[-1]
        inner = np.linalg.lstsq(basis, rhs, rcond=None)[0]
        control = np.vstack([q[0], inner, q[-1]])
        errors = np.linalg.norm(bezier(control, t)-q, axis=1)
        if errors.max() > tolerance and hi-lo > 4:
            mid = (lo+hi)//2
            fit(lo, mid); fit(mid, hi)
        else:
            segments.append({'start': lo / SAMPLES, 'end': hi / SAMPLES, 'control': control.tolist()})
    for i in range(0, SAMPLES, 32):
        fit(i, i+32)
    result = np.zeros((SAMPLES, 2))
    for s in segments:
        lo, hi = round(s['start']*SAMPLES), round(s['end']*SAMPLES)
        result[lo:hi] = bezier(s['control'], np.arange(hi-lo)/(hi-lo))
    return segments, result

def fit(points, method='fourier', harmonics=12, smoothing=8, tolerance=0.05):
    start = time.perf_counter()
    p = resample(points)
    result = {'method': method, 'source': p.tolist()}
    if method == 'fourier':
        coefficients = fourier(p)
        reconstructed = evaluate_fourier(coefficients, harmonics)
        result.update(coefficients=coefficients, parameters=2*(2*harmonics+1))
    elif method == 'spline':
        # Periodic cubic interpolation through a controllable subset of samples.
        count = max(8, min(128, round(128 / smoothing)))
        indices = np.linspace(0, SAMPLES, count+1).astype(int)
        knots = indices / SAMPLES
        values = np.vstack([p[indices[:-1]], p[0]])
        spline = CubicSpline(knots, values, bc_type='periodic')
        reconstructed = spline(np.arange(SAMPLES)/SAMPLES)
        result.update(knots=knots.tolist(), polynomial=spline.c.transpose(1,2,0).tolist(), controls=values.tolist(), parameters=2*count)
    elif method == 'bezier':
        segments, reconstructed = fit_bezier(p, tolerance)
        result.update(segments=segments, parameters=8*len(segments))
    else:
        raise ValueError('Unknown fitting method.')
    result.update(points=reconstructed.tolist(), error=rmse(p, reconstructed), milliseconds=(time.perf_counter()-start)*1000)
    return result

def example(name):
    t = np.linspace(0, 2*np.pi, 512, endpoint=False)
    if name == 'circle': p = np.c_[6*np.cos(t), 6*np.sin(t)]
    elif name == 'heart': p = np.c_[16*np.sin(t)**3, 13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t)]/2.4
    elif name == 'star':
        a = np.arange(10)*np.pi/5+np.pi/2; r = np.tile([7,3],5); p = np.c_[r*np.cos(a),r*np.sin(a)]
    elif name == 'flower':
        r = 4.5+2*np.cos(5*t); p=np.c_[r*np.cos(t),r*np.sin(t)]
    elif name == 'butterfly':
        r = np.exp(np.sin(t))-2*np.cos(4*t)+np.sin((2*t-np.pi)/24)**5; p = np.c_[2.2*r*np.cos(t),2.2*r*np.sin(t)]
    elif name == 'abstract': p=np.c_[6*np.sin(t)+np.sin(7*t),5*np.sin(2*t)+0.7*np.cos(11*t)]
    else: raise ValueError('Unknown example.')
    return [{'points': resample(p).tolist(), 'hole': False}]
