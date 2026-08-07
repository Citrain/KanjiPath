import { Badge, Card } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { fetchSources } from '../content/api';

const SKELETON_IDS = ['s1', 's2', 's3', 's4'];

export function SourcesPage() {
  const sources = useQuery({ queryKey: ['sources'], queryFn: fetchSources });

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          Provenance & licences
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Sources du <span className="gradient-text">contenu</span>
        </h1>
        <p className="mt-3 text-muted">
          Chaque kanji, mot, phrase et exercice provient de sources ouvertes, tracées et attribuées.
          Les niveaux sont alignés sur le JLPT — les listes ne sont pas officielles.
        </p>
      </header>

      {sources.isPending ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {SKELETON_IDS.map((id) => (
            <div key={id} className="shimmer h-40 rounded-2xl border border-line" />
          ))}
        </div>
      ) : null}
      {sources.isError ? (
        <p className="mt-8 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          Impossible de charger les sources.
        </p>
      ) : null}

      {sources.data ? (
        <>
          {sources.data.contentVersion ? (
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-jade/25 bg-jade-soft px-5 py-4">
              <span className="font-kanji text-3xl text-jade">版</span>
              <div className="flex-1">
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

          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {sources.data.sources.map((source, index) => (
              <motion.li
                key={source.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card hover className="h-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{source.name}</h2>
                    <Badge tone="gold">{source.license}</Badge>
                  </div>
                  {source.attributionText ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {source.attributionText}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-sky hover:underline"
                    >
                      {source.url}
                    </a>
                    {source.sourceVersion ? <span>version {source.sourceVersion}</span> : null}
                    <span>
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
