import type { KanjiSummary } from '@kanjipath/contracts';
import { Button, Progress, Tooltip } from '@kanjipath/ui';
import { CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STATUS_META } from './status-badge';

interface KanjiTileProps {
  kanji: KanjiSummary;
  onMarkKnown?: (kanji: KanjiSummary) => void;
  markingKnown?: boolean;
}

export function KanjiTile({ kanji, onMarkKnown, markingKnown = false }: KanjiTileProps) {
  const meta = STATUS_META[kanji.status];
  const mastery = Math.round(kanji.overallScore * 100);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface px-4 pb-4 pt-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-2">
      <Link
        to={`/kanji/${kanji.literal}`}
        aria-label={`${kanji.literal} — ${kanji.primaryMeaning ?? 'sens inconnu'}, ${meta.label}, maîtrise ${mastery} %`}
        className="group flex flex-1 flex-col items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="relative">
          <span className="font-jp inline-block text-5xl leading-none text-ink transition-all duration-200 group-hover:scale-110 group-hover:text-accent">
            {kanji.literal}
          </span>
          <Tooltip content={meta.label}>
            <span
              aria-hidden
              className={`absolute -right-2.5 -top-1 size-2.5 rounded-full ring-2 ring-surface ${meta.dot}`}
            />
          </Tooltip>
        </span>
        <span className="mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-tight text-ink-soft">
          {kanji.primaryMeaning ?? '—'}
        </span>
        <span className="mt-3 w-full">
          <Progress
            value={kanji.overallScore}
            tone={kanji.status === 'mastered' ? 'jade' : 'accent'}
            className="h-1.5"
            label={`Maîtrise de ${kanji.literal}`}
          />
        </span>
        <span className="mt-2.5 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-muted">
          <span>{kanji.strokeCount} traits</span>
          <span aria-hidden>·</span>
          <span>#{kanji.order}</span>
          {kanji.nextDueAt ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-accent-2">à réviser</span>
            </>
          ) : null}
        </span>
      </Link>
      {onMarkKnown && kanji.status !== 'mastered' ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4 min-h-12 w-full"
          loading={markingKnown}
          onClick={() => onMarkKnown(kanji)}
        >
          <CircleCheck aria-hidden className="size-4" />
          Connu
        </Button>
      ) : null}
    </div>
  );
}
