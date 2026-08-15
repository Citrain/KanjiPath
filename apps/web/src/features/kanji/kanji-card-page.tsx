import {
  Badge,
  Button,
  Card,
  ErrorState,
  IconButton,
  Progress,
  Ring,
  SectionHeader,
  Skeleton,
  Tooltip,
  useToast,
} from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Flag,
  Lightbulb,
  Network,
  PenLine,
  ScrollText,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LevelBadge } from '../../components/level-badge';
import { StatusBadge } from '../../components/status-badge';
import { formatDate } from '../../lib/format';
import {
  fetchKanjiDetail,
  fetchKanjiList,
  fetchKanjiProgress,
  fetchKanjiSentences,
  fetchKanjiVocabulary,
  markKanjiKnown,
} from '../content/api';
import { AudioButton } from '../content/audio-button';
import { SentenceView, useDisplaySettings } from '../content/japanese';
import { IssueModal } from './issue-modal';
import { KanjiSvg } from './kanji-svg';

const FICHE_SKILLS: Array<{
  key: 'meaning' | 'reading' | 'vocabulary' | 'context' | 'stroke';
  label: string;
}> = [
  { key: 'meaning', label: 'Sens' },
  { key: 'reading', label: 'Lecture' },
  { key: 'vocabulary', label: 'Vocabulaire' },
  { key: 'context', label: 'Contexte' },
  { key: 'stroke', label: 'Traits' },
];
const VOCABULARY_PAGE_SIZE = 8;

export function KanjiCardPage() {
  const { literal = '' } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { romajiEnabled, furiganaMode } = useDisplaySettings();
  const [issueOpen, setIssueOpen] = useState(false);
  const [vocabularyPagination, setVocabularyPagination] = useState({ literal, page: 0 });

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
  const markKnown = useMutation({
    mutationFn: () => markKanjiKnown(literal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanji'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      toast(`${literal} est maintenant marqué comme connu.`, 'success');
    },
    onError: () => {
      toast('Impossible de mettre à jour ce kanji. Réessayez.', 'error');
    },
  });

  const detailData = detail.data;
  const siblings = useQuery({
    queryKey: ['kanji', detailData?.level ?? 'N5'],
    queryFn: () => fetchKanjiList(detailData?.level ?? 'N5'),
    enabled: Boolean(detailData),
  });

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-72 rounded-3xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (detail.isError || !detailData) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <ErrorState
          title="Kanji introuvable"
          description="Ce kanji n'existe pas dans le parcours pour le moment."
        />
        <div className="mt-6 text-center">
          <Button asChild variant="secondary">
            <Link to="/kanji">
              <ArrowLeft aria-hidden className="size-4" />
              Retour à la liste
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const kanji = detailData;
  const status = kanji.status;
  const primaryMeanings = kanji.meanings.filter((m) => m.isPrimary);
  const secondaryMeanings = kanji.meanings.filter((m) => !m.isPrimary);
  const onReadings = kanji.readings.filter((r) => r.type === 'onyomi');
  const kunReadings = kanji.readings.filter((r) => r.type === 'kunyomi');
  const commonReadings = kanji.readings.filter((r) => r.commonness === 'common');
  const rareReadings = kanji.readings.filter((r) => r.commonness === 'rare');

  const ordered = [...(siblings.data?.kanji ?? [])].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((item) => item.literal === kanji.literal);
  const previous = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
  const next =
    currentIndex >= 0 && currentIndex < ordered.length - 1 ? ordered[currentIndex + 1] : undefined;

  const stats = [
    { label: 'Traits', value: String(kanji.strokeCount) },
    { label: 'Fréquence', value: kanji.frequencyRank ? `#${kanji.frequencyRank}` : '—' },
    { label: 'Grade JP', value: kanji.schoolGrade ? `${kanji.schoolGrade}` : '—' },
    { label: 'N° parcours', value: `#${kanji.order}` },
  ];
  const vocabularyItems = vocabulary.data?.vocabulary ?? [];
  const vocabularyPageCount = Math.max(1, Math.ceil(vocabularyItems.length / VOCABULARY_PAGE_SIZE));
  const currentVocabularyPage =
    vocabularyPagination.literal === literal
      ? Math.min(vocabularyPagination.page, vocabularyPageCount - 1)
      : 0;
  const visibleVocabulary = vocabularyItems.slice(
    currentVocabularyPage * VOCABULARY_PAGE_SIZE,
    (currentVocabularyPage + 1) * VOCABULARY_PAGE_SIZE,
  );
  const changeVocabularyPage = (offset: number) => {
    setVocabularyPagination((current) => {
      const page = current.literal === literal ? current.page : 0;
      return {
        literal,
        page: Math.max(0, Math.min(page + offset, vocabularyPageCount - 1)),
      };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/kanji"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Tous les kanji
        </Link>
        <div className="flex items-center gap-2">
          {previous ? (
            <Tooltip content={`Précédent : ${previous.literal}`}>
              <IconButton
                asChild
                aria-label={`Kanji précédent : ${previous.literal}`}
                variant="secondary"
                size="sm"
              >
                <Link to={`/kanji/${previous.literal}`}>
                  <ChevronLeft aria-hidden className="size-4" />
                </Link>
              </IconButton>
            </Tooltip>
          ) : null}
          {next ? (
            <Tooltip content={`Suivant : ${next.literal}`}>
              <IconButton
                asChild
                aria-label={`Kanji suivant : ${next.literal}`}
                variant="secondary"
                size="sm"
              >
                <Link to={`/kanji/${next.literal}`}>
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip content="Signaler un problème de contenu">
            <IconButton
              aria-label="Signaler un problème"
              variant="secondary"
              size="sm"
              onClick={() => setIssueOpen(true)}
            >
              <Flag aria-hidden className="size-4" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-1 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/8 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-sky/8 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-center gap-x-12 gap-y-8">
          <div className="flex flex-col items-center gap-3">
            <span className="font-jp animate-pop text-[8rem] leading-none text-ink sm:text-[10rem]">
              {kanji.literal}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <LevelBadge level={kanji.level} />
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="min-w-64 flex-1">
            <p className="text-2xl font-extrabold tracking-tight text-ink">
              {primaryMeanings.map((m) => m.meaning).join(', ') || '—'}
            </p>
            {secondaryMeanings.length > 0 ? (
              <p className="mt-1.5 text-sm text-muted">
                {secondaryMeanings.map((m) => m.meaning).join(' · ')}
              </p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-center"
                >
                  <dt className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted">
                    {stat.label}
                  </dt>
                  <dd className="mt-0.5 text-lg font-extrabold text-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-5">
              <Ring
                value={kanji.overallScore}
                size={76}
                stroke={7}
                tone={kanji.overallScore >= 0.7 ? 'jade' : 'accent'}
                label={`Votre maîtrise de ${kanji.literal}`}
              >
                <span className="text-sm font-extrabold">
                  {Math.round(kanji.overallScore * 100)}%
                </span>
              </Ring>
              <div className="text-sm">
                <p className="font-bold text-ink">Votre maîtrise</p>
                <p className="mt-0.5 text-muted">
                  Prochaine révision :{' '}
                  <span className="font-semibold text-ink-soft">
                    {kanji.nextDueAt ? formatDate(kanji.nextDueAt) : 'pas encore planifiée'}
                  </span>
                </p>
                {progress.data?.masteredAt ? (
                  <p className="mt-0.5 text-muted">
                    Maîtrisé depuis le{' '}
                    <span className="font-semibold text-jade">
                      {formatDate(progress.data.masteredAt)}
                    </span>
                  </p>
                ) : null}
              </div>
              <Button asChild variant="secondary" size="sm" className="ml-auto">
                <Link
                  to={`/etude?mode=targeted&kanjiIds=${kanji.id}&kanjiLits=${encodeURIComponent(
                    kanji.literal,
                  )}`}
                >
                  Réviser ce kanji
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link to={`/kanji/${encodeURIComponent(kanji.literal)}/carte`}>
                  <Network aria-hidden className="size-4" />
                  Voir la carte
                </Link>
              </Button>
              {status === 'mastered' ? null : (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={markKnown.isPending}
                  onClick={() => markKnown.mutate()}
                >
                  <CircleCheck aria-hidden className="size-4" />
                  Marquer comme connu
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Lectures" />
          <div className="mt-6 flex flex-col items-center gap-6 text-center">
            <div className="w-full">
              <p className="text-xs font-bold uppercase tracking-wider text-sky">
                On'yomi · sino-japonaise
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2.5">
                {onReadings.map((r) => (
                  <span
                    key={`on-${r.reading}`}
                    className="flex min-w-18 flex-col items-center rounded-xl border border-sky/20 bg-sky-soft px-4 py-2 text-sky"
                  >
                    <span className="font-jp text-2xl font-semibold leading-tight sm:text-3xl">
                      {r.reading}
                    </span>
                    {romajiEnabled && r.romaji ? (
                      <span className="mt-0.5 text-xs font-semibold opacity-75">{r.romaji}</span>
                    ) : null}
                  </span>
                ))}
                {onReadings.length === 0 ? (
                  <span className="text-sm text-muted">aucune</span>
                ) : null}
              </div>
            </div>
            <div className="w-full">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                Kun'yomi · japonaise
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2.5">
                {kunReadings.map((r) => (
                  <span
                    key={`kun-${r.reading}-${r.okurigana ?? ''}`}
                    className="flex min-w-18 flex-col items-center rounded-xl border border-accent/20 bg-accent-soft px-4 py-2 text-accent"
                  >
                    <span className="text-2xl font-semibold leading-tight sm:text-3xl">
                      <span className="font-jp">{r.reading}</span>
                      {r.okurigana ? (
                        <span className="text-base opacity-60">.{r.okurigana}</span>
                      ) : null}
                    </span>
                    {romajiEnabled && r.romaji ? (
                      <span className="mt-0.5 text-xs font-semibold opacity-75">{r.romaji}</span>
                    ) : null}
                  </span>
                ))}
                {kunReadings.length === 0 ? (
                  <span className="text-sm text-muted">aucune</span>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-muted">
              {commonReadings.length} lecture{commonReadings.length > 1 ? 's' : ''} courante
              {commonReadings.length > 1 ? 's' : ''}
              {rareReadings.length > 0
                ? ` · ${rareReadings.length} rare${rareReadings.length > 1 ? 's' : ''}`
                : ''}
            </p>
            {rareReadings.length > 0 ? (
              <details className="group w-full rounded-xl border border-line bg-surface-2 p-3.5 text-left">
                <summary className="cursor-pointer list-none text-sm font-semibold text-muted transition-colors hover:text-ink">
                  <span className="inline-flex items-center gap-2">
                    <ChevronRight
                      aria-hidden
                      className="size-4 transition-transform duration-200 group-open:rotate-90"
                    />
                    Lectures rares ({rareReadings.length})
                  </span>
                </summary>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {rareReadings.map((r) => (
                    <span
                      key={`rare-${r.reading}-${r.type}`}
                      className="rounded-lg border border-line px-2.5 py-1 text-sm text-muted"
                    >
                      {r.reading}
                      {romajiEnabled && r.romaji ? ` (${r.romaji})` : ''}{' '}
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
          <SectionHeader
            title="Ordre des traits"
            aside={
              <Button asChild variant="secondary" size="sm">
                <Link to={`/kanji/${kanji.literal}/ecriture`}>
                  <PenLine aria-hidden className="size-4" />
                  Pratiquer l’écriture
                </Link>
              </Button>
            }
          />
          <div className="mt-5">
            <KanjiSvg literal={kanji.literal} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Radical & composants" />
          {kanji.radical ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-accent/25 bg-accent-soft p-5 text-center">
              <span className="font-jp text-6xl leading-none text-ink">
                {kanji.radical.literal}
              </span>
              <div>
                <p className="text-lg font-bold text-ink">{kanji.radical.nameFr ?? 'radical'}</p>
                <p className="text-sm text-muted">{kanji.radical.meaningFr ?? ''}</p>
                <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                  radical principal
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">Radical non renseigné.</p>
          )}
          {kanji.components.length > 0 ? (
            <ul className="mt-5 flex flex-wrap justify-center gap-3">
              {kanji.components.map((component, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: liste statique de composants, jamais réordonnée
                  key={`${component.literal}-${index}`}
                  className="flex min-w-24 flex-col items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-center"
                >
                  <span className="font-jp text-3xl leading-none text-ink">
                    {component.literal}
                  </span>
                  <span className="text-sm text-muted">
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
              <div className="mt-2.5 flex flex-wrap gap-2">
                {kanji.notes.confusions.map((confusion) => (
                  <Link
                    key={confusion}
                    to={`/kanji/${confusion}`}
                    aria-label={`Voir le kanji ${confusion}, à ne pas confondre`}
                    className="font-jp rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-2xl text-danger transition-all duration-150 hover:-translate-y-0.5 hover:shadow-1"
                  >
                    {confusion}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <SectionHeader title="Mémoire & histoire" />
          {kanji.notes?.mnemonicFr ? (
            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold-soft p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
                <Lightbulb aria-hidden className="size-3.5" />
                Mnémotechnique
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{kanji.notes.mnemonicFr}</p>
              <p className="mt-2.5 text-[0.6875rem] italic text-muted">
                Une aide mémoire, pas une étymologie.
              </p>
            </div>
          ) : null}
          {kanji.notes?.etymologyFr ? (
            <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <ScrollText aria-hidden className="size-3.5" />
                Étymologie
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {kanji.notes.etymologyFr}
              </p>
              {kanji.notes.etymologySource ? (
                <p className="mt-2.5 text-[0.6875rem] text-muted">
                  Source : {kanji.notes.etymologySource}
                </p>
              ) : null}
            </div>
          ) : null}
          {!kanji.notes?.mnemonicFr && !kanji.notes?.etymologyFr ? (
            <p className="mt-5 text-sm text-muted">Pas encore de note pour ce kanji.</p>
          ) : null}

          {progress.data ? (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Progression par compétence
              </p>
              <ul className="mt-3.5 flex flex-col gap-3">
                {FICHE_SKILLS.map((skill) => {
                  const score = progress.data?.scores[skill.key] ?? 0;
                  return (
                    <li key={skill.key} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-semibold text-ink-soft">
                        {skill.label}
                      </span>
                      <Progress
                        value={score}
                        tone={score >= 0.7 ? 'jade' : 'accent'}
                        className="h-1.5 flex-1"
                        label={`${skill.label} : ${Math.round(score * 100)} %`}
                      />
                      <span className="w-10 shrink-0 text-right text-xs font-bold text-muted">
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
        <SectionHeader
          title="Vocabulaire associé"
          aside={vocabulary.data ? <Badge>{vocabularyItems.length} mots</Badge> : null}
        />
        {vocabulary.isPending ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : vocabularyItems.length > 0 ? (
          <>
            <ul className="mt-5 grid gap-4 lg:grid-cols-2">
              {visibleVocabulary.map((word) => (
                <li
                  key={word.id}
                  className="rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-1 sm:p-6"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-jp text-3xl leading-tight text-ink sm:text-4xl">
                      {word.writtenForm}
                    </span>
                    <span className="flex flex-col items-end text-right">
                      <span className="text-xl font-bold text-accent sm:text-2xl">
                        {word.reading}
                      </span>
                      {romajiEnabled && word.romaji ? (
                        <span className="text-base font-semibold text-muted">{word.romaji}</span>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-ink-soft">{word.meaningFr}</p>
                  {word.audio ? (
                    <div className="mt-4">
                      <AudioButton audio={word.audio} label={`Écouter ${word.writtenForm}`} />
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {word.partOfSpeech ?? 'mot'}
                    {word.readingInWord ? ` · ${kanji.literal} → ${word.readingInWord}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            {vocabularyPageCount > 1 ? (
              <nav
                aria-label="Pagination du vocabulaire associé"
                className="mt-5 flex items-center justify-between gap-3"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentVocabularyPage === 0}
                  onClick={() => changeVocabularyPage(-1)}
                >
                  <ChevronLeft aria-hidden className="size-4" />
                  Précédents
                </Button>
                <span className="text-sm font-semibold text-muted">
                  Page {currentVocabularyPage + 1} sur {vocabularyPageCount}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentVocabularyPage === vocabularyPageCount - 1}
                  onClick={() => changeVocabularyPage(1)}
                >
                  Suivants
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
              </nav>
            ) : null}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">Pas encore de vocabulaire pour ce kanji.</p>
        )}
      </section>

      <section aria-labelledby="phrases">
        <SectionHeader
          title="Phrases d'exemple"
          aside={sentences.data ? <Badge>{sentences.data.sentences.length} phrases</Badge> : null}
        />
        {sentences.isPending ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : sentences.data && sentences.data.sentences.length > 0 ? (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {sentences.data.sentences.map((sentence) => (
              <li key={sentence.id} className="rounded-2xl border border-line bg-surface p-5">
                <SentenceView
                  tokens={sentence.tokens}
                  japanese={sentence.japanese}
                  highlight={kanji.literal}
                  romajiEnabled={romajiEnabled}
                  furiganaMode={furiganaMode}
                  className="text-4xl"
                />
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                  {sentence.translationFr}
                </p>
                {sentence.audio ? (
                  <div className="mt-3">
                    <AudioButton audio={sentence.audio} label="Écouter la phrase" />
                  </div>
                ) : null}
                <p className="mt-3 text-[0.6875rem] text-muted/80">
                  {sentence.author ?? 'Tatoeba'} · {sentence.license ?? 'licence Tatoeba'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Pas encore de phrases pour ce kanji.</p>
        )}
      </section>

      <IssueModal literal={kanji.literal} open={issueOpen} onOpenChange={setIssueOpen} />
    </motion.div>
  );
}
