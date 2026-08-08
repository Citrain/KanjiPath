import { Card, ErrorState, Skeleton } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LevelBadge } from '../../components/level-badge';
import { fetchTextDetail } from '../content/api';
import { SentenceView, useDisplaySettings } from '../content/japanese';
import { groupTextTokens } from './text-tokens';

export function ReadingTextPage() {
  const { id = '' } = useParams();
  const { romajiEnabled, furiganaMode } = useDisplaySettings();
  const text = useQuery({
    queryKey: ['texts', id],
    queryFn: () => fetchTextDetail(id),
    enabled: id.length > 0,
  });

  if (text.isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-5 h-12 w-64" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (text.isError || !text.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState description="Ce texte est introuvable." />
        <Link to="/lecture" className="mt-4 inline-block text-sm font-semibold text-accent">
          ← Retour aux textes
        </Link>
      </div>
    );
  }

  const data = text.data;
  const sentences = groupTextTokens(data.tokens);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/lecture"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Tous les textes
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="font-jp text-3xl font-extrabold tracking-tight text-ink">{data.title}</h1>
        <LevelBadge level={data.level} />
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-5">
          {sentences.map((tokens, index) => (
            <SentenceView
              // biome-ignore lint/suspicious/noArrayIndexKey: phrases statiques, jamais réordonnées
              key={`${index}-${tokens[0]?.surface ?? ''}`}
              tokens={tokens}
              japanese={tokens.map((token) => token.surface).join('')}
              romajiEnabled={romajiEnabled}
              furiganaMode={furiganaMode}
              className="text-2xl"
            />
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Traduction</p>
        <p className="mt-2 leading-relaxed text-ink">{data.translationFr}</p>
        <p className="mt-4 text-xs text-muted">
          {data.author ?? 'KanjiPath'} — {data.license ?? ''}
        </p>
      </Card>
    </div>
  );
}
