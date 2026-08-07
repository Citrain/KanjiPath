import { Badge, Card, ErrorState, PageHeader, Skeleton } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, PackageCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchSources } from '../content/api';

const SKELETON_COUNT = 4;

export function SourcesPage() {
  const sources = useQuery({ queryKey: ['sources'], queryFn: fetchSources });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Provenance & licences"
        title="Sources du contenu"
        description="Chaque kanji, mot, phrase et exercice provient de sources ouvertes, tracées et attribuées. Les niveaux sont alignés sur le JLPT — les listes ne sont pas officielles."
      />

      {sources.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: squelettes interchangeables
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : sources.isError ? (
        <ErrorState
          title="Impossible de charger les sources"
          description="Vérifiez votre connexion puis réessayez."
          onRetry={() => sources.refetch()}
        />
      ) : sources.data ? (
        <>
          {sources.data.contentVersion ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-jade/25 bg-jade-soft px-5 py-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-jade text-white">
                <PackageCheck aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                  Pack de contenu {sources.data.contentVersion.version}
                </p>
                <p className="text-sm text-muted">
                  Publié le{' '}
                  {new Date(sources.data.contentVersion.publishedAt).toLocaleDateString('fr-FR')}
                  {sources.data.contentVersion.notes
                    ? ` — ${sources.data.contentVersion.notes}`
                    : ''}
                </p>
              </div>
              <Badge tone="success">validé</Badge>
            </div>
          ) : null}

          <ul className="grid gap-4 lg:grid-cols-2">
            {sources.data.sources.map((source, index) => (
              <motion.li
                key={source.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card hover className="h-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold tracking-tight">{source.name}</h2>
                    <Badge tone="warning">{source.license}</Badge>
                  </div>
                  {source.attributionText ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {source.attributionText}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 font-semibold text-sky hover:underline"
                    >
                      <span className="truncate">{source.url}</span>
                      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                    </a>
                    {source.sourceVersion ? <span>version {source.sourceVersion}</span> : null}
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock aria-hidden className="size-3.5" />
                      importé le {new Date(source.importedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </Card>
              </motion.li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
