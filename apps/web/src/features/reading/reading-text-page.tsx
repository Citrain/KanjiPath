import { Card, ErrorState, Skeleton } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LevelBadge } from '../../components/level-badge';
import { fetchTextDetail, fetchWordLookup } from '../content/api';
import { SentenceView, useDisplaySettings } from '../content/japanese';
import { groupTextTokens } from './text-tokens';

const KANJI_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

export function ReadingTextPage() {
  const { id = '' } = useParams();
  const { romajiEnabled, furiganaMode } = useDisplaySettings();
  const [selected, setSelected] = useState<string | null>(null);
  const text = useQuery({
    queryKey: ['texts', id],
    queryFn: () => fetchTextDetail(id),
    enabled: id.length > 0,
  });
  const lookup = useQuery({
    queryKey: ['word-lookup', selected],
    queryFn: () => fetchWordLookup(selected ?? ''),
    enabled: selected !== null,
  });

  if (text.isPending) {
    return (
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-5 h-12 w-64" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (text.isError || !text.data) {
    return (
      <div>
        <ErrorState description="Ce texte est introuvable." />
        <Link to="/lecture" className="mt-4 inline-block text-sm font-semibold text-accent">
          ← Retour aux textes
        </Link>
      </div>
    );
  }

  const data = text.data;
  const sentences = groupTextTokens(data.tokens);
  const selectedToken = selected ? data.tokens.find((token) => token.surface === selected) : null;

  return (
    <div>
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
      <p className="mt-2 text-sm text-muted">
        Touchez un mot du texte pour afficher sa lecture, son sens et sa décomposition.
      </p>

      <div className="mt-6 flex flex-col gap-4 xl:grid xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
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
                onTokenClick={(surface) => {
                  if (!KANJI_RE.test(surface)) {
                    return;
                  }
                  setSelected((current) => (current === surface ? null : surface));
                }}
                activeSurface={selected}
              />
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          {selected !== null ? (
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                    Lecture en contexte
                  </p>
                  <p className="mt-1 font-jp text-3xl font-bold text-ink">
                    {selected}
                    {selectedToken?.reading && selectedToken.reading !== selected ? (
                      <span className="ml-2 text-lg font-medium text-muted">
                        {selectedToken.reading}
                        {romajiEnabled && selectedToken.romaji ? ` · ${selectedToken.romaji}` : ''}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="cursor-pointer text-sm font-semibold text-muted transition hover:text-ink"
                >
                  Fermer
                </button>
              </div>

              {lookup.isPending ? (
                <Skeleton className="mt-4 h-24 w-full" />
              ) : lookup.isError || !lookup.data ? (
                <p className="mt-4 text-sm text-muted">Impossible de charger ce mot.</p>
              ) : (
                <>
                  {lookup.data.vocabulary.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-3">
                      {lookup.data.vocabulary.map((word) => (
                        <li key={word.id} className="flex flex-col gap-0.5">
                          <p className="font-jp text-lg font-semibold text-ink">
                            {word.writtenForm}
                            <span className="ml-2 text-base font-medium text-muted">
                              {word.reading}
                            </span>
                            {romajiEnabled && word.romaji ? (
                              <span className="ml-2 text-sm text-muted">{word.romaji}</span>
                            ) : null}
                          </p>
                          <p className="text-sm text-muted">
                            {word.meaningFr}
                            {word.partOfSpeech ? ` — ${word.partOfSpeech}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
                      Ce mot n'est pas encore dans le référentiel — sa décomposition en kanji
                      ci-dessous aide à en approcher le sens.
                    </p>
                  )}

                  {lookup.data.kanji.length > 0 ? (
                    <div className="mt-4 border-t border-line pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                        {lookup.data.vocabulary.length > 0
                          ? 'Kanji du mot'
                          : 'Décomposition du mot'}
                      </p>
                      <div className="mt-3 flex flex-col gap-3">
                        {lookup.data.kanji.map((kanji) => {
                          const onReadings = kanji.readings.filter((r) => r.type === 'onyomi');
                          const kunReadings = kanji.readings.filter((r) => r.type === 'kunyomi');
                          return (
                            <Link
                              key={kanji.literal}
                              to={`/kanji/${encodeURIComponent(kanji.literal)}`}
                              className="flex items-start gap-4 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-accent/60"
                            >
                              <span className="font-jp text-3xl font-bold leading-none text-ink">
                                {kanji.literal}
                              </span>
                              <span className="flex min-w-0 flex-col gap-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-xs font-bold text-accent">
                                    {kanji.level}
                                  </span>
                                  {kanji.primaryMeaning ? (
                                    <span className="text-sm font-semibold text-ink">
                                      {kanji.primaryMeaning}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                                  {onReadings.length > 0 ? (
                                    <span>
                                      on&nbsp;: {onReadings.map((r) => r.reading).join('、')}
                                      {romajiEnabled
                                        ? ` (${onReadings
                                            .map((r) => r.romaji ?? '')
                                            .filter(Boolean)
                                            .join(', ')})`
                                        : ''}
                                    </span>
                                  ) : null}
                                  {kunReadings.length > 0 ? (
                                    <span>
                                      kun&nbsp;: {kunReadings.map((r) => r.reading).join('、')}
                                      {romajiEnabled
                                        ? ` (${kunReadings
                                            .map((r) => r.romaji ?? '')
                                            .filter(Boolean)
                                            .join(', ')})`
                                        : ''}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </Card>
          ) : null}

          <Card>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Traduction</p>
            <p className="mt-2 leading-relaxed text-ink">{data.translationFr}</p>
            <p className="mt-4 text-xs text-muted">
              {data.author ?? 'KanjiPath'} — {data.license ?? ''}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
