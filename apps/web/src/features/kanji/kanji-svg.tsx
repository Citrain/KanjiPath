import { Button } from '@kanjipath/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { kanjiSvgUrl } from '../content/api';

interface KanjiSvgProps {
  literal: string;
}

type Speed = 'slow' | 'normal';

export function KanjiSvg({ literal }: KanjiSvgProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [ghost, setGhost] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setPaths([]);
    setCurrent(0);
    fetch(kanjiSvgUrl(literal), { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('SVG indisponible');
        }
        return response.text();
      })
      .then((svgText) => {
        if (cancelled) {
          return;
        }
        const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        const strokePaths = doc.querySelectorAll('path[id^="kvg:"][d]');
        const list = [...strokePaths].map((node) => node.getAttribute('d') ?? '');
        if (list.length === 0) {
          setError(true);
          return;
        }
        setPaths(list);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [literal]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (!playing || paths.length === 0) {
      return;
    }
    if (current >= paths.length) {
      setPlaying(false);
      return;
    }
    const delay = speed === 'slow' ? 1200 : 600;
    timerRef.current = window.setTimeout(() => {
      setCurrent((value) => value + 1);
    }, delay);
    return clearTimer;
  }, [playing, current, paths.length, speed, clearTimer]);

  if (error) {
    return <p className="text-sm text-muted">Tracé indisponible pour ce kanji.</p>;
  }
  if (paths.length === 0) {
    return <div className="shimmer aspect-square w-full rounded-2xl border border-line" />;
  }

  const strokeDuration = speed === 'slow' ? '1.1s' : '0.55s';

  return (
    <div>
      <div className="relative mx-auto w-full max-w-72">
        <svg
          viewBox="0 0 109 109"
          role="img"
          aria-label={`Tracé du kanji ${literal} en ${paths.length} traits`}
          className="w-full rounded-2xl border border-line bg-bg-soft"
        >
          <g stroke="var(--line)" strokeWidth="1">
            <line x1="54.5" y1="6" x2="54.5" y2="103" strokeDasharray="3 4" />
            <line x1="6" y1="54.5" x2="103" y2="54.5" strokeDasharray="3 4" />
          </g>
          {ghost
            ? paths.map((d) => (
                <path
                  key={`ghost-${literal}-${d.slice(0, 24)}`}
                  d={d}
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            : null}
          {paths.slice(0, current + 1).map((d, index) => {
            const isActive = index === current && current < paths.length;
            return (
              <path
                key={`stroke-${literal}-${d.slice(0, 24)}`}
                d={d}
                fill="none"
                stroke={isActive ? 'var(--accent)' : 'var(--ink)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isActive ? 'kanji-stroke-active' : undefined}
                style={
                  isActive
                    ? ({ '--stroke-duration': strokeDuration } as React.CSSProperties)
                    : undefined
                }
              />
            );
          })}
        </svg>
        <span className="absolute right-3 top-3 rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-bold text-muted">
          {Math.min(current + 1, paths.length)}/{paths.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Trait précédent"
          onClick={() => {
            setPlaying(false);
            setCurrent((value) => Math.max(0, value - 1));
          }}
        >
          ← Précédent
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (playing) {
              setPlaying(false);
            } else {
              if (current >= paths.length - 1) {
                setCurrent(0);
              }
              setPlaying(true);
            }
          }}
        >
          {playing ? '⏸ Pause' : '▶ Animer'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Trait suivant"
          onClick={() => {
            setPlaying(false);
            setCurrent((value) => Math.min(paths.length - 1, value + 1));
          }}
        >
          Suivant →
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPlaying(false);
            setCurrent(0);
          }}
        >
          ↺
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-sm text-muted">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={ghost}
            onChange={(event) => setGhost(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Mode fantôme
        </label>
        <label className="flex items-center gap-2">
          Vitesse
          <select
            value={speed}
            onChange={(event) => setSpeed(event.target.value as Speed)}
            className="cursor-pointer rounded-lg border border-line bg-card px-2 py-1 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="normal">normale</option>
            <option value="slow">lente</option>
          </select>
        </label>
      </div>
    </div>
  );
}
