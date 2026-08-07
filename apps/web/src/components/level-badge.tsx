import type { JlptLevel } from '@kanjipath/contracts';
import type { BadgeTone } from '@kanjipath/ui';
import { Badge } from '@kanjipath/ui';

const LEVEL_TONES: Record<JlptLevel, BadgeTone> = {
  N5: 'success',
  N4: 'info',
  N3: 'violet',
  N2: 'warning',
  N1: 'accent',
};

export function LevelBadge({
  level,
  prefix = 'Parcours JLPT',
  className = '',
}: {
  level: JlptLevel;
  prefix?: string;
  className?: string;
}) {
  return (
    <Badge tone={LEVEL_TONES[level]} className={className}>
      {prefix ? `${prefix} · ${level}` : level}
    </Badge>
  );
}
