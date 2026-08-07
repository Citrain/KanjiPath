import { describe, expect, it } from 'vitest';
import {
  distance,
  matchStroke,
  type StrokePoint,
  samplePath,
  toViewBoxPoint,
} from './stroke-match';

const HORIZONTAL =
  'M11,54.25c3.19,0.62,6.25,0.75,9.73,0.5c20.64-1.5,50.39-5.12,68.58-5.24c3.6-0.02,5.77,0.24,7.57,0.49';

function line(points: Array<[number, number]>): StrokePoint[] {
  return points.map(([x, y]) => ({ x, y }));
}

function trace(sampled: NonNullable<ReturnType<typeof samplePath>>, jitter = 0): StrokePoint[] {
  return sampled.points.map((point, index) => ({
    x: point.x + (jitter ? ((index % 3) - 1) * jitter : 0),
    y: point.y + (jitter ? ((index % 2) - 0.5) * jitter : 0),
  }));
}

describe('samplePath', () => {
  it('extrait le début et la fin du premier trait de 一', () => {
    const sampled = samplePath(HORIZONTAL);
    expect(sampled).not.toBeNull();
    if (!sampled) {
      return;
    }
    expect(sampled.start.x).toBeCloseTo(11, 0);
    expect(sampled.start.y).toBeCloseTo(54.25, 0);
    expect(sampled.end.x).toBeGreaterThan(85);
    expect(sampled.length).toBeGreaterThan(70);
  });

  it('gère les commandes relatives et absolues', () => {
    const sampled = samplePath('M10,10 L50,10 h20 v30');
    expect(sampled).not.toBeNull();
    if (!sampled) {
      return;
    }
    expect(sampled.end.x).toBeCloseTo(70, 0);
    expect(sampled.end.y).toBeCloseTo(40, 0);
  });

  it('renvoie null pour un tracé vide ou invalide', () => {
    expect(samplePath('')).toBeNull();
    expect(samplePath('M10,10')).toBeNull();
  });
});

describe('matchStroke', () => {
  const expected = samplePath(HORIZONTAL);

  it('valide un tracé fidèle', () => {
    expect(expected).not.toBeNull();
    if (!expected) {
      return;
    }
    const result = matchStroke(trace(expected), expected);
    expect(result.verdict).toBe('ok');
  });

  it('tolère un léger tremblement', () => {
    expect(expected).not.toBeNull();
    if (!expected) {
      return;
    }
    const result = matchStroke(trace(expected, 1.5), expected);
    expect(result.verdict).toBe('ok');
  });

  it('rejette un départ trop éloigné', () => {
    expect(expected).not.toBeNull();
    if (!expected) {
      return;
    }
    const drawn = line([
      [5, 20],
      [40, 21],
      [80, 22],
    ]);
    const result = matchStroke(drawn, expected);
    expect(result.verdict).not.toBe('ok');
  });

  it('rejette un trait inversé', () => {
    expect(expected).not.toBeNull();
    if (!expected) {
      return;
    }
    const reversed = trace(expected).reverse();
    const result = matchStroke(reversed, expected);
    expect(result.verdict).not.toBe('ok');
  });

  it('rejette un gribouillis hors du tracé', () => {
    expect(expected).not.toBeNull();
    if (!expected) {
      return;
    }
    const drawn = line([
      [11, 54],
      [30, 90],
      [60, 10],
      [95, 50],
    ]);
    const result = matchStroke(drawn, expected);
    expect(result.verdict).not.toBe('ok');
  });

  it('rejette un trait trop court', () => {
    expect(expected).not.toBeNull();
    if (!expected) {
      return;
    }
    const drawn = line([
      [11, 54],
      [16, 54],
    ]);
    const result = matchStroke(drawn, expected);
    expect(result.verdict).not.toBe('ok');
  });
});

describe('toViewBoxPoint', () => {
  it('convertit des coordonnées client en viewBox', () => {
    const rect = { left: 0, top: 0, width: 218, height: 218 };
    const point = toViewBoxPoint(109, 54.5, rect);
    expect(point.x).toBeCloseTo(54.5, 1);
    expect(point.y).toBeCloseTo(27.25, 1);
  });
});

describe('distance', () => {
  it('calcule une distance euclidienne', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
