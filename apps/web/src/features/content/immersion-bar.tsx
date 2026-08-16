import type { ImmersionAid, ImmersionHelpLevel } from '@kanjipath/contracts';
import { Button } from '@kanjipath/ui';
import { Eye } from 'lucide-react';
import {
  IMMERSION_AID_LABELS,
  IMMERSION_HELP_LEVELS,
  IMMERSION_LEVEL_LABELS,
} from '../../lib/immersion';
import { useImmersion } from './immersion-context';

export function ImmersionBar({ aids }: { aids: readonly ImmersionAid[] }) {
  const immersion = useImmersion();
  if (!immersion.enabled) {
    return null;
  }
  const pageAids = new Set(aids);
  const hiddenHere = immersion.hiddenAids.filter((aid) => pageAids.has(aid));
  return (
    <section
      aria-label="Mode immersion"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="font-jp flex size-7 items-center justify-center rounded-lg bg-accent-soft text-base text-accent">
            浸
          </span>
          Mode immersion · {IMMERSION_LEVEL_LABELS[immersion.level]}
          {immersion.savedLevel === null && immersion.overrideLevel === null ? (
            <span className="text-xs font-semibold text-muted">(recommandé)</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hiddenHere.map((aid) => (
            <Button
              key={aid}
              variant="secondary"
              size="lg"
              onClick={() => immersion.reveal(aid)}
              aria-label={IMMERSION_AID_LABELS[aid].reveal}
            >
              <Eye aria-hidden className="size-4" />
              {IMMERSION_AID_LABELS[aid].reveal}
            </Button>
          ))}
          {hiddenHere.length > 1 ? (
            <Button variant="primary" size="lg" onClick={immersion.revealAll}>
              Tout afficher
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="immersion-level" className="text-sm font-semibold text-ink-soft">
          Niveau d'aide de la séance
        </label>
        <select
          id="immersion-level"
          value={immersion.level}
          onChange={(event) =>
            immersion.setOverrideLevel(Number(event.target.value) as ImmersionHelpLevel)
          }
          className="h-11 rounded-xl border border-line bg-bg px-3 text-sm font-semibold text-ink outline-none focus:border-accent"
        >
          {IMMERSION_HELP_LEVELS.map((value) => (
            <option key={value} value={value}>
              {IMMERSION_LEVEL_LABELS[value]}
            </option>
          ))}
        </select>
        {immersion.overrideLevel !== null ? (
          <button
            type="button"
            onClick={() => immersion.setOverrideLevel(null)}
            className="h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
          >
            Revenir à mon réglage
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {immersion.announcement ?? ''}
      </p>
    </section>
  );
}
