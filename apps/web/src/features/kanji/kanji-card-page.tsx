import { Badge, Card, Progress, Ring } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchKanjiDetail,
  fetchKanjiProgress,
  fetchKanjiSentences,
  fetchKanjiVocabulary,
} from '../content/api';
import { KanjiSvg } from './kanji-svg';

const STATUS_LABELS: Record<
  string,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' }
> = {
  new: { label: 'nouveau', tone: 'neutral' },
  learning: { label: 'en apprentissage', tone: 'info' },
  reviewing: { label: 'en révision', tone: 'warning' },
  mastered: { label: 'maîtrisé', tone: 'success' },
};

const SKILL_LABELS: Array<{
  key: 'meaning' | 'reading' | 'vocabulary' | 'context' | 'stroke';
  label: string;
}> = [
  { key: 'meaning', label: 'Sens' },
  { key: 'reading', label: 'Lecture' },
  { key: 'vocabulary', label: 'Vocabulaire' },
  { key: 'context', label: 'Contexte' },
  { key: 'stroke', label: 'Traits' },
];

function splitWithOffsets(
  text: string,
  target: string,
): Array<{ text: string; offset: number; isTarget: boolean }> {
  const segments: Array<{ text: string; offset: number; isTarget: boolean }> = [];
  let cursor = 0;
  let index = text.indexOf(target);
  while (index !== -1) {
    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), offset: cursor, isTarget: false });
    }
    segments.push({ text: target, offset: index, isTarget: true });
    cursor = index + target.length;
    index = text.indexOf(target, cursor);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), offset: cursor, isTarget: false });
  }
  return segments;
}

export function KanjiCardPage() {
  const { literal = '' } = useParams();
  const detail = useQuery({
    queryKey: ['kanji', literal],
    queryFn: () => fetchKanjiDetail(literal),
    enabled: literal.length > 0,
  });
  const vocabulary = useQuery({
    queryKey: ['kanji', literal, 'vocabulary'],
    queryFn: () => fetchKanjiVocabulary(literal),
    enabled: literal.length > 0,
  });
  const sentences = useQuery({
    queryKey: ['kanji', literal, 'sentences'],
    queryFn: () => fetchKanjiSentences(literal),
    enabled: literal.length > 0,
  });
  const progress = useQuery({
    queryKey: ['kanji', literal, 'progress'],
    queryFn: () => fetchKanjiProgress(literal),
    enabled: literal.length > 0,
  });

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="shimmer h-64 rounded-3xl border border-line" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="shimmer h-48 rounded-3xl border border-line" />
          <div className="shimmer h-48 rounded-3xl border border-line" />
        </div>
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="font-kanji text-6xl text-muted">迷</span>
        <p className="text-muted">Kanji introuvable.</p>
        <Link to="/kanji" className="font-bold text-accent hover:underline">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const kanji = detail.data;
  const status = STATUS_LABELS[kanji.status] ?? ({ label: kanji.status, tone: 'neutral' } as const);
  const primaryMeanings = kanji.meanings.filter((m) => m.isPrimary);
  const secondaryMeanings = kanji.meanings.filter((m) => !m.isPrimary);
  const onReadings = kanji.readings.filter((r) => r.type === 'onyomi');
  const kunReadings = kanji.readings.filter((r) => r.type === 'kunyomi');
  const commonReadings = kanji.readings.filter((r) => r.commonness === 'common');
  const rareReadings = kanji.readings.filter((r) => r.commonness === 'rare');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-6"
    >
      <Link
        to="/kanji"
        className="w-fit text-sm font-semibold text-muted transition-colors hover:text-accent"
      >
        ← Tous les kanji
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel p-8 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-sky/10 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-center gap-10">
          <div className="flex flex-col items-center">
            <span className="font-kanji text-glow animate-pop text-[9rem] leading-none text-ink sm:text-[11rem]">
              {kanji.literal}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="accent">Parcours JLPT · {kanji.level}</Badge>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
          </div>

          <div className="min-w-64 flex-1">
            <p className="text-2xl font-extrabold tracking-tight">
              {primaryMeanings.map((m) => m.meaning).join(', ') || '—'}
            </p>
            {secondaryMeanings.length > 0 ? (
              <p className="mt-1 text-sm text-muted">
                {secondaryMeanings.map((m) => m.meaning).join(' · ')}
              </p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Traits', value: String(kanji.strokeCount) },
                {
                  label: 'Fréquence',
                  value: kanji.frequencyRank ? `#${kanji.frequencyRank}` : '—',
                },
                { label: 'Grade JP', value: kanji.schoolGrade ? `${kanji.schoolGrade}` : '—' },
                { label: 'N° parcours', value: `#${kanji.order}` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-line bg-card px-3 py-2.5 text-center"
                >
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    {stat.label}
                  </dt>
                  <dd className="mt-0.5 text-lg font-extrabold">{stat.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex items-center gap-4">
              <Ring value={kanji.overallScore} size={72} stroke={7}>
                <span className="text-sm font-extrabold">
                  {Math.round(kanji.overallScore * 100)}%
                </span>
              </Ring>
              <div className="text-sm text-muted">
                <p className="font-bold text-ink-soft">Votre maîtrise</p>
                <p>
                  Prochaine révision :{' '}
                  <span className="font-semibold text-ink-soft">
                    {kanji.nextDueAt
                      ? new Date(kanji.nextDueAt).toLocaleDateString('fr-FR')
                      : 'pas encore planifiée'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="font-kanji text-accent">読</span> Lectures
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky">
                On'yomi · sino-japonaise
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onReadings.map((r) => (
                  <span
                    key={`on-${r.reading}`}
                    className="rounded-lg bg-sky-soft px-3 py-1.5 font-kanji text-lg font-semibold text-sky"
                  >
                    {r.reading}
                  </span>
                ))}
                {onReadings.length === 0 ? (
                  <span className="text-sm text-muted">aucune</span>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                Kun'yomi · japonaise
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kunReadings.map((r) => (
                  <span
                    key={`kun-${r.reading}-${r.okurigana ?? ''}`}
                    className="rounded-lg bg-accent-soft px-3 py-1.5 text-lg font-semibold text-accent"
                  >
                    <span className="font-kanji">{r.reading}</span>
                    {r.okurigana ? (
                      <span className="text-sm opacity-60">.{r.okurigana}</span>
                    ) : null}
                  </span>
                ))}
                {kunReadings.length === 0 ? (
                  <span className="text-sm text-muted">aucune</span>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted">
              {commonReadings.length} lecture{commonReadings.length > 1 ? 's' : ''} courante
              {commonReadings.length > 1 ? 's' : ''}
              {rareReadings.length > 0
                ? ` · ${rareReadings.length} rare${rareReadings.length > 1 ? 's' : ''}`
                : ''}
            </p>
            {rareReadings.length > 0 ? (
              <details className="rounded-xl border border-line bg-card-2 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-muted">
                  Lectures rares ({rareReadings.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rareReadings.map((r) => (
                    <span
                      key={`rare-${r.reading}`}
                      className="rounded-lg border border-line px-2.5 py-1 text-sm text-muted"
                    >
                      {r.reading}{' '}
                      <span className="opacity-60">
                        ({r.type === 'onyomi' ? 'on' : r.type === 'kunyomi' ? 'kun' : 'nanori'})
                      </span>
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="font-kanji text-accent">書</span> Tracé
          </h2>
          <div className="mt-4">
            <KanjiSvg literal={kanji.literal} />
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="font-kanji text-accent">部</span> Radical & composants
          </h2>
          {kanji.radical ? (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-accent/25 bg-accent-soft p-4">
              <span className="font-kanji text-glow text-5xl text-ink">
                {kanji.radical.literal}
              </span>
              <div>
                <p className="font-bold text-ink">{kanji.radical.nameFr ?? 'radical'}</p>
                <p className="text-sm text-muted">{kanji.radical.meaningFr ?? ''}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent">
                  radical principal
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Radical non renseigné.</p>
          )}
          {kanji.components.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {kanji.components.map((component, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: liste statique de composants, jamais réordonnée
                  key={`${component.literal}-${index}`}
                  className="flex items-center gap-2 rounded-xl border border-line bg-card-2 px-3 py-2"
                >
                  <span className="font-kanji text-2xl">{component.literal}</span>
                  <span className="text-xs text-muted">
                    {component.nameFr ?? 'composant'}
                    {component.isRadical ? (
                      <span className="ml-1 font-bold text-accent">· radical</span>
                    ) : component.role === 'phonetic' ? (
                      <span className="ml-1 font-bold text-sky">· phonétique</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {kanji.notes && kanji.notes.confusions.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                À ne pas confondre
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kanji.notes.confusions.map((confusion) => (
                  <Link
                    key={confusion}
                    to={`/kanji/${confusion}`}
                    className="font-kanji card-hover rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-2xl text-danger"
                  >
                    {confusion}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="font-kanji text-accent">記</span> Mémoire & histoire
          </h2>
          {kanji.notes?.mnemonicFr ? (
            <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gold">Mnémotechnique</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {kanji.notes.mnemonicFr}
              </p>
              <p className="mt-2 text-[11px] italic text-muted">
                Une aide mémoire, pas une étymologie.
              </p>
            </div>
          ) : null}
          {kanji.notes?.etymologyFr ? (
            <div className="mt-3 rounded-2xl border border-line bg-card-2 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Étymologie</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {kanji.notes.etymologyFr}
              </p>
              {kanji.notes.etymologySource ? (
                <p className="mt-2 text-[11px] text-muted">
                  Source : {kanji.notes.etymologySource}
                </p>
              ) : null}
            </div>
          ) : null}
          {!kanji.notes?.mnemonicFr && !kanji.notes?.etymologyFr ? (
            <p className="mt-4 text-sm text-muted">Pas encore de note pour ce kanji.</p>
          ) : null}

          {progress.data ? (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Votre progression par compétence
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {SKILL_LABELS.map((skill) => {
                  const score = progress.data?.scores[skill.key] ?? 0;
                  return (
                    <li key={skill.key} className="flex items-center gap-3">
                      <span className="w-24 text-sm font-semibold text-ink-soft">
                        {skill.label}
                      </span>
                      <Progress
                        value={score}
                        tone={score >= 0.7 ? 'jade' : 'accent'}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-xs font-bold text-muted">
                        {Math.round(score * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <section aria-labelledby="vocabulaire">
        <h2 id="vocabulaire" className="flex items-center gap-2 text-lg font-bold">
          <span className="font-kanji text-accent">語</span> Vocabulaire associé
          {vocabulary.data ? (
            <Badge tone="neutral">{vocabulary.data.vocabulary.length} mots</Badge>
          ) : null}
        </h2>
        {vocabulary.data && vocabulary.data.vocabulary.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vocabulary.data.vocabulary.map((word) => (
              <li key={word.id} className="card-hover rounded-2xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-kanji text-2xl text-ink">{word.writtenForm}</span>
                  <span className="text-sm font-bold text-accent">{word.reading}</span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{word.meaningFr}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {word.partOfSpeech ?? 'mot'}
                  {word.readingInWord ? ` · ${kanji.literal} → ${word.readingInWord}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Pas encore de vocabulaire.</p>
        )}
      </section>

      <section aria-labelledby="phrases">
        <h2 id="phrases" className="flex items-center gap-2 text-lg font-bold">
          <span className="font-kanji text-accent">文</span> Phrases d'exemple
          {sentences.data ? <Badge tone="neutral">{sentences.data.sentences.length}</Badge> : null}
        </h2>
        {sentences.data && sentences.data.sentences.length > 0 ? (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {sentences.data.sentences.map((sentence) => (
              <li
                key={sentence.id}
                className="card-hover rounded-2xl border border-line bg-card p-5"
              >
                <p className="text-lg leading-relaxed text-ink">
                  {splitWithOffsets(sentence.japanese, kanji.literal).map((segment) =>
                    segment.isTarget ? (
                      <mark
                        key={`${sentence.id}-${segment.offset}`}
                        className="font-kanji rounded-md bg-accent-soft px-1 text-accent"
                      >
                        {kanji.literal}
                      </mark>
                    ) : (
                      <span key={`${sentence.id}-${segment.offset}`}>{segment.text}</span>
                    ),
                  )}
                </p>
                <p className="mt-2 text-sm text-muted">{sentence.translationFr}</p>
                <p className="mt-3 text-[11px] text-muted/80">
                  {sentence.author ?? 'Tatoeba'} · {sentence.license ?? 'licence Tatoeba'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Pas encore de phrases.</p>
        )}
      </section>
    </motion.div>
  );
}
