import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LevelBadge } from '../../components/level-badge';
import { fetchTexts } from '../content/api';

export function ReadingListPage() {
  const texts = useQuery({ queryKey: ['texts'], queryFn: () => fetchTexts() });

  if (texts.isPending) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (texts.isError) {
    return <ErrorState description="Impossible de charger les textes de lecture." />;
  }

  const items = texts.data?.texts ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Lecture graduée"
        title="Mini-textes"
        description="De courts textes rédigés uniquement avec les kanji de votre niveau, pour lire en contexte."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<BookOpen aria-hidden className="size-6" />}
          title="Aucun texte disponible"
          description="Les mini-textes arrivent bientôt pour ce parcours."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((text) => (
            <Link key={text.id} to={`/lecture/${text.id}`} className="group block h-full">
              <Card className="h-full transition group-hover:border-accent/50 group-hover:shadow-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-jp text-2xl font-bold text-ink">{text.title}</h2>
                  <LevelBadge level={text.level} prefix="" />
                </div>
                <p className="mt-3 line-clamp-2 font-jp text-base leading-relaxed text-muted">
                  {text.excerpt}
                </p>
                <p className="mt-4 text-sm font-semibold text-accent">Lire ce texte →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
