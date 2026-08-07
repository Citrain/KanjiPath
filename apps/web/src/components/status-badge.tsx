import type { KanjiStatus } from '@kanjipath/contracts';
import type { BadgeTone } from '@kanjipath/ui';
import { Badge, BadgeDot } from '@kanjipath/ui';

export const STATUS_META: Record<KanjiStatus, { label: string; tone: BadgeTone; dot: string }> = {
  new: { label: 'Nouveau', tone: 'neutral', dot: 'bg-muted' },
  learning: { label: 'Apprentissage', tone: 'info', dot: 'bg-sky' },
  reviewing: { label: 'Révision', tone: 'warning', dot: 'bg-gold' },
  mastered: { label: 'Maîtrisé', tone: 'success', dot: 'bg-jade' },
};

export function StatusBadge({
  status,
  className = '',
}: {
  status: KanjiStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className}>
      <BadgeDot />
      {meta.label}
    </Badge>
  );
}
