export interface StrokePoint {
  x: number;
  y: number;
}

export interface SampledStroke {
  points: StrokePoint[];
  start: StrokePoint;
  end: StrokePoint;
  length: number;
}

export type StrokeVerdict = 'ok' | 'start' | 'direction' | 'shape' | 'coverage';

export interface StrokeMatch {
  verdict: StrokeVerdict;
  maxDistance: number;
}

const VIEWBOX = 109;

export const STROKE_TOLERANCE = {
  startDistance: 14,
  directionDot: 0.15,
  shapeMaxDistance: 11,
  coverageRatio: 0.72,
  minLengthRatio: 0.35,
} as const;

export function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function tokenizePath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const pattern = /([MmLlHhVvCcSsQqTtZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  for (let match = pattern.exec(d); match !== null; match = pattern.exec(d)) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(Number.parseFloat(match[2]));
    }
  }
  return tokens;
}

interface Cursor {
  x: number;
  y: number;
  startX: number;
  startY: number;
  prevControl: StrokePoint | null;
}

function pushSample(points: StrokePoint[], x: number, y: number) {
  const last = points[points.length - 1];
  if (!last || distance(last, { x, y }) > 0.05) {
    points.push({ x, y });
  }
}

function sampleCubic(
  points: StrokePoint[],
  from: StrokePoint,
  c1: StrokePoint,
  c2: StrokePoint,
  to: StrokePoint,
  steps: number,
) {
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const inv = 1 - t;
    const a = inv * inv * inv;
    const b = 3 * inv * inv * t;
    const c = 3 * inv * t * t;
    const d = t * t * t;
    pushSample(
      points,
      a * from.x + b * c1.x + c * c2.x + d * to.x,
      a * from.y + b * c1.y + c * c2.y + d * to.y,
    );
  }
}

function sampleQuadratic(
  points: StrokePoint[],
  from: StrokePoint,
  control: StrokePoint,
  to: StrokePoint,
  steps: number,
) {
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const inv = 1 - t;
    const a = inv * inv;
    const b = 2 * inv * t;
    const c = t * t;
    pushSample(
      points,
      a * from.x + b * control.x + c * to.x,
      a * from.y + b * control.y + c * to.y,
    );
  }
}

function sampleLine(points: StrokePoint[], from: StrokePoint, to: StrokePoint, steps: number) {
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    pushSample(points, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
  }
}

function stepsFor(from: StrokePoint, to: StrokePoint): number {
  const span = distance(from, to);
  return Math.min(24, Math.max(2, Math.ceil(span / 2)));
}

type Numbers<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc
  : Numbers<N, [...Acc, number]>;

export function samplePath(d: string): SampledStroke | null {
  const tokens = tokenizePath(d);
  const points: StrokePoint[] = [];
  const cursor: Cursor = { x: 0, y: 0, startX: 0, startY: 0, prevControl: null };
  let command = '';
  let index = 0;

  const take = <N extends number>(count: N): Numbers<N> | null => {
    if (index + count > tokens.length) {
      return null;
    }
    const values: number[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      const token = tokens[index + offset];
      if (typeof token !== 'number') {
        return null;
      }
      values.push(token);
    }
    index += count;
    return values as unknown as Numbers<N>;
  };

  const moveTo = (x: number, y: number) => {
    cursor.x = x;
    cursor.y = y;
    cursor.startX = x;
    cursor.startY = y;
    cursor.prevControl = null;
    pushSample(points, x, y);
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (typeof token === 'string') {
      command = token;
      index += 1;
      if (command === 'Z' || command === 'z') {
        const from = { x: cursor.x, y: cursor.y };
        const to = { x: cursor.startX, y: cursor.startY };
        sampleLine(points, from, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.y = to.y;
        cursor.prevControl = null;
        command = '';
      }
      continue;
    }

    const from = { x: cursor.x, y: cursor.y };

    switch (command) {
      case 'M':
      case 'm': {
        const values = take(2);
        if (!values) {
          return null;
        }
        const [dx, dy] = values;
        const absolute = command === 'M' || points.length === 0;
        moveTo(absolute ? dx : cursor.x + dx, absolute ? dy : cursor.y + dy);
        command = command === 'M' ? 'L' : 'l';
        break;
      }
      case 'L':
      case 'l': {
        const values = take(2);
        if (!values) {
          return null;
        }
        const [dx, dy] = values;
        const to = command === 'L' ? { x: dx, y: dy } : { x: cursor.x + dx, y: cursor.y + dy };
        sampleLine(points, from, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.y = to.y;
        cursor.prevControl = null;
        break;
      }
      case 'H':
      case 'h': {
        const values = take(1);
        if (!values) {
          return null;
        }
        const [dx] = values;
        const to = command === 'H' ? { x: dx, y: cursor.y } : { x: cursor.x + dx, y: cursor.y };
        sampleLine(points, from, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.prevControl = null;
        break;
      }
      case 'V':
      case 'v': {
        const values = take(1);
        if (!values) {
          return null;
        }
        const [dy] = values;
        const to = command === 'V' ? { x: cursor.x, y: dy } : { x: cursor.x, y: cursor.y + dy };
        sampleLine(points, from, to, stepsFor(from, to));
        cursor.y = to.y;
        cursor.prevControl = null;
        break;
      }
      case 'C':
      case 'c': {
        const values = take(6);
        if (!values) {
          return null;
        }
        const [c1x, c1y, c2x, c2y, dx, dy] = values;
        const base = command === 'C' ? { x: 0, y: 0 } : { x: cursor.x, y: cursor.y };
        const c1 = { x: base.x + c1x, y: base.y + c1y };
        const c2 = { x: base.x + c2x, y: base.y + c2y };
        const to = { x: base.x + dx, y: base.y + dy };
        sampleCubic(points, from, c1, c2, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.y = to.y;
        cursor.prevControl = c2;
        break;
      }
      case 'S':
      case 's': {
        const values = take(4);
        if (!values) {
          return null;
        }
        const [c2x, c2y, dx, dy] = values;
        const base = command === 'S' ? { x: 0, y: 0 } : { x: cursor.x, y: cursor.y };
        const c1 = cursor.prevControl
          ? { x: 2 * cursor.x - cursor.prevControl.x, y: 2 * cursor.y - cursor.prevControl.y }
          : { x: cursor.x, y: cursor.y };
        const c2 = { x: base.x + c2x, y: base.y + c2y };
        const to = { x: base.x + dx, y: base.y + dy };
        sampleCubic(points, from, c1, c2, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.y = to.y;
        cursor.prevControl = c2;
        break;
      }
      case 'Q':
      case 'q': {
        const values = take(4);
        if (!values) {
          return null;
        }
        const [cx, cy, dx, dy] = values;
        const base = command === 'Q' ? { x: 0, y: 0 } : { x: cursor.x, y: cursor.y };
        const control = { x: base.x + cx, y: base.y + cy };
        const to = { x: base.x + dx, y: base.y + dy };
        sampleQuadratic(points, from, control, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.y = to.y;
        cursor.prevControl = control;
        break;
      }
      case 'T':
      case 't': {
        const values = take(2);
        if (!values) {
          return null;
        }
        const [dx, dy] = values;
        const base = command === 'T' ? { x: 0, y: 0 } : { x: cursor.x, y: cursor.y };
        const control = cursor.prevControl
          ? { x: 2 * cursor.x - cursor.prevControl.x, y: 2 * cursor.y - cursor.prevControl.y }
          : { x: cursor.x, y: cursor.y };
        const to = { x: base.x + dx, y: base.y + dy };
        sampleQuadratic(points, from, control, to, stepsFor(from, to));
        cursor.x = to.x;
        cursor.y = to.y;
        cursor.prevControl = control;
        break;
      }
      default:
        return null;
    }
  }

  if (points.length < 2) {
    return null;
  }

  let length = 0;
  for (let offset = 1; offset < points.length; offset += 1) {
    const previous = points[offset - 1];
    const current = points[offset];
    if (previous && current) {
      length += distance(previous, current);
    }
  }

  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) {
    return null;
  }

  return { points, start, end, length };
}

function distanceToPolyline(point: StrokePoint, polyline: StrokePoint[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let offset = 1; offset < polyline.length; offset += 1) {
    const a = polyline[offset - 1];
    const b = polyline[offset];
    if (!a || !b) {
      continue;
    }
    const spanX = b.x - a.x;
    const spanY = b.y - a.y;
    const spanLengthSquared = spanX * spanX + spanY * spanY;
    let t =
      spanLengthSquared === 0
        ? 0
        : ((point.x - a.x) * spanX + (point.y - a.y) * spanY) / spanLengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: a.x + spanX * t, y: a.y + spanY * t };
    best = Math.min(best, distance(point, projection));
  }
  return best;
}

export function matchStroke(
  drawn: StrokePoint[],
  expected: SampledStroke,
  tolerance: typeof STROKE_TOLERANCE = STROKE_TOLERANCE,
): StrokeMatch {
  if (drawn.length < 2) {
    return { verdict: 'coverage', maxDistance: Number.POSITIVE_INFINITY };
  }

  const start = drawn[0];
  const end = drawn[drawn.length - 1];
  if (!start || !end) {
    return { verdict: 'coverage', maxDistance: Number.POSITIVE_INFINITY };
  }

  let drawnLength = 0;
  for (let offset = 1; offset < drawn.length; offset += 1) {
    const previous = drawn[offset - 1];
    const current = drawn[offset];
    if (previous && current) {
      drawnLength += distance(previous, current);
    }
  }
  if (drawnLength < expected.length * tolerance.minLengthRatio) {
    return { verdict: 'coverage', maxDistance: Number.POSITIVE_INFINITY };
  }

  if (distance(start, expected.start) > tolerance.startDistance) {
    return { verdict: 'start', maxDistance: distance(start, expected.start) };
  }

  const drawnDirection = { x: end.x - start.x, y: end.y - start.y };
  const expectedDirection = {
    x: expected.end.x - expected.start.x,
    y: expected.end.y - expected.start.y,
  };
  const drawnNorm = Math.hypot(drawnDirection.x, drawnDirection.y);
  const expectedNorm = Math.hypot(expectedDirection.x, expectedDirection.y);
  if (drawnNorm > 1 && expectedNorm > 1) {
    const dot =
      (drawnDirection.x * expectedDirection.x + drawnDirection.y * expectedDirection.y) /
      (drawnNorm * expectedNorm);
    if (dot < tolerance.directionDot) {
      return { verdict: 'direction', maxDistance: Number.POSITIVE_INFINITY };
    }
  }

  let maxDistance = 0;
  let covered = 0;
  for (const point of drawn) {
    const gap = distanceToPolyline(point, expected.points);
    maxDistance = Math.max(maxDistance, gap);
    if (gap <= tolerance.shapeMaxDistance) {
      covered += 1;
    }
  }

  if (maxDistance > tolerance.shapeMaxDistance * 1.6) {
    return { verdict: 'shape', maxDistance };
  }
  if (covered / drawn.length < tolerance.coverageRatio) {
    return { verdict: 'shape', maxDistance };
  }

  return { verdict: 'ok', maxDistance };
}

export interface ViewBoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function toViewBoxPoint(
  clientX: number,
  clientY: number,
  rect: ViewBoxRect,
  size = VIEWBOX,
): StrokePoint {
  const x = rect.width === 0 ? 0 : ((clientX - rect.left) / rect.width) * size;
  const y = rect.height === 0 ? 0 : ((clientY - rect.top) / rect.height) * size;
  return { x, y };
}
