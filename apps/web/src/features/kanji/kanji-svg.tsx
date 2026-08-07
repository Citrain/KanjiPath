import { IconButton, Segmented, Skeleton, Toggle, Tooltip } from '@kanjipath/ui';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
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
    setPlaying(false);
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
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        Tracé indisponible pour ce kanji.
      </p>
    );
  }
  if (paths.length === 0) {
    return <Skeleton className="aspect-square w-full max-w-72 rounded-2xl" />;
  }

  const strokeDuration = speed === 'slow' ? '1.1s' : '0.55s';

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-72">
        <svg
          viewBox="0 0 109 109"
          role="img"
          aria-label={`Tracé du kanji ${literal} en ${paths.length} traits`}
          className="w-full rounded-2xl border border-line bg-bg"
        >
          <g stroke="var(--line)" strokeWidth="1">
            <line x1="54.5" y1="6" x2="54.5" y2="103" strokeDasharray="3 4" />
            <line x1="6" y1="54.5" x2="103" y2="54.5" strokeDasharray="3 4" />
          </g>
          {ghost
            ? paths.map((d, index) => (
                <path
                  // biome-ignore lint/suspicious/noArrayIndexKey: traits statiques, jamais réordonnés
                  key={`ghost-${index}`}
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
                // biome-ignore lint/suspicious/noArrayIndexKey: traits statiques, jamais réordonnés
                key={`stroke-${index}`}
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
        <span
          aria-live="polite"
          className="absolute right-3 top-3 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted"
        >
          {Math.min(current + 1, paths.length)}/{paths.length}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip content="Trait précédent">
          <IconButton
            aria-label="Trait précédent"
            variant="secondary"
            onClick={() => {
              setPlaying(false);
              setCurrent((value) => Math.max(0, value - 1));
            }}
          >
            <SkipBack aria-hidden className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content={playing ? 'Pause' : 'Animer le tracé'}>
          <IconButton
            aria-label={playing ? 'Pause' : 'Animer le tracé'}
            variant="primary"
            size="lg"
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
            {playing ? (
              <Pause aria-hidden className="size-4.5" />
            ) : (
              <Play aria-hidden className="size-4.5" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip content="Trait suivant">
          <IconButton
            aria-label="Trait suivant"
            variant="secondary"
            onClick={() => {
              setPlaying(false);
              setCurrent((value) => Math.min(paths.length - 1, value + 1));
            }}
          >
            <SkipForward aria-hidden className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Recommencer">
          <IconButton
            aria-label="Recommencer"
            onClick={() => {
              setPlaying(false);
              setCurrent(0);
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
          </IconButton>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-2.5 text-sm font-medium text-muted">
          Mode fantôme
          <Toggle checked={ghost} onChange={setGhost} label="Mode fantôme" />
        </span>
        <div className="flex items-center gap-2.5 text-sm font-medium text-muted">
          Vitesse
          <Segmented
            ariaLabel="Vitesse d'animation"
            size="sm"
            value={speed}
            options={[
              { value: 'normal', label: 'Normale' },
              { value: 'slow', label: 'Lente' },
            ]}
            onChange={setSpeed}
          />
        </div>
      </div>
    </div>
  );
}
