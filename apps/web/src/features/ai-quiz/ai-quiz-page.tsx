import type {
  AiQuizAnswerResult,
  AiQuizPublicQuestion,
  AiQuizSessionDto,
  AiQuizSkill,
  JlptLevel,
} from '@kanjipath/contracts';
import { Badge, Button, Card, Ring } from '@kanjipath/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, History, Lightbulb, RotateCcw, Sparkles, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../../lib/api';
import { JLPT_LEVELS } from '../../lib/levels';
import {
  createAiQuiz,
  fetchAiQuiz,
  fetchAiQuizAudio,
  fetchAiQuizHistory,
  finishAiQuiz,
  submitAiQuizAnswer,
} from './api';

const QUIZ_MODES = [
  {
    id: 'mixed',
    label: 'Révision guidée',
    detail: 'Le mélange recommandé : vocabulaire, lecture et passé des verbes.',
    types: ['meaning_qcm', 'reading_qcm', 'cloze_qcm', 'conjugation_qcm'],
    skills: ['vocabulary', 'grammar', 'reading'],
  },
  {
    id: 'vocabulary',
    label: 'Mots et lecture',
    detail: 'Comprendre et lire les mots utiles.',
    types: ['meaning_qcm', 'reading_qcm'],
    skills: ['vocabulary', 'reading'],
  },
  {
    id: 'grammar',
    label: 'Grammaire et conjugaison',
    detail: 'Choisir la bonne forme et compléter une phrase courte.',
    types: ['cloze_qcm', 'conjugation_qcm'],
    skills: ['grammar'],
  },
  {
    id: 'listening',
    label: 'Écoute',
    detail: 'Comprendre une phrase prononcée par la voix japonaise locale.',
    types: ['listening_qcm'],
    skills: ['listening'],
  },
] as const;

const SKILL_LABELS: Record<AiQuizSkill, string> = {
  vocabulary: 'Vocabulaire',
  grammar: 'Grammaire',
  reading: 'Lecture',
  listening: 'Écoute',
  context: 'Contexte',
};

const STAGE_LABELS = {
  warmup: 'Mise en route',
  practice: 'Entraînement',
  challenge: 'Défi',
  finale: 'Finale',
};

export function AiQuizPage() {
  const [session, setSession] = useState<AiQuizSessionDto | null>(null);
  const [prompt, setPrompt] = useState('Réviser la forme passée des verbes au restaurant');
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [questionCount, setQuestionCount] = useState<5 | 10 | 20>(5);
  const [modeId, setModeId] = useState<(typeof QUIZ_MODES)[number]['id']>('mixed');
  const [position, setPosition] = useState(0);
  const [answerResult, setAnswerResult] = useState<AiQuizAnswerResult | null>(null);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [finished, setFinished] = useState(false);
  const history = useQuery({ queryKey: ['ai-quiz', 'history'], queryFn: fetchAiQuizHistory });

  const create = useMutation({
    mutationFn: createAiQuiz,
    onSuccess: (created) => {
      setSession(created);
      setPosition(0);
      setAnswerResult(null);
      setCorrect(0);
      setAnswered(0);
      setFinished(false);
      void history.refetch();
    },
  });
  const answer = useMutation({
    mutationFn: ({
      key,
      value,
      shownAt,
    }: {
      key: string;
      value: { choiceId?: string; orderedTileIds?: string[] };
      shownAt: number;
    }) =>
      submitAiQuizAnswer(session?.id ?? '', {
        questionKey: key,
        answer: value,
        responseTimeMs: Date.now() - shownAt,
      }),
    onSuccess: (result) => {
      setAnswerResult(result);
      setAnswered(result.answeredCount);
      setCorrect(result.correctCount);
    },
  });
  const finish = useMutation({
    mutationFn: () => finishAiQuiz(session?.id ?? ''),
    onSuccess: () => {
      setFinished(true);
      void history.refetch();
    },
  });

  const mode = QUIZ_MODES.find((item) => item.id === modeId) ?? QUIZ_MODES[0]!;

  if (!session) {
    return (
      <section className="mx-auto max-w-6xl space-y-10">
        <header className="max-w-4xl">
          <p className="text-sm font-bold tracking-widest text-accent sm:text-base">
            AI QUIZ · LABORATOIRE LOCAL
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Construisez une mission sur mesure
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft">
            Décrivez votre objectif. L’IA locale fabrique un quiz figé, puis chaque réponse est
            corrigée sans nouvel appel au modèle.
          </p>
        </header>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line bg-accent-soft p-6 sm:p-9">
            <label htmlFor="ai-quiz-prompt" className="text-base font-bold text-accent sm:text-lg">
              Votre mission
            </label>
            <textarea
              id="ai-quiz-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={500}
              className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-accent/25 bg-surface px-5 py-4 text-lg leading-relaxed text-ink outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15 sm:text-xl"
              placeholder="Ex. préparer un voyage : demander son chemin, horaires et billets"
            />
          </div>
          <div className="grid gap-9 p-6 sm:p-9 lg:grid-cols-2">
            <ChoiceGroup
              title="Niveau"
              values={JLPT_LEVELS}
              selected={level}
              onChange={(value) => setLevel(value as JlptLevel)}
            />
            <ChoiceGroup
              title="Taille de la mission"
              values={['5', '10']}
              selected={String(questionCount)}
              onChange={(value) => setQuestionCount(Number(value) as 5 | 10 | 20)}
              labels={{ 5: 'Express · 5', 10: 'Séance · 10' }}
            />
            <div className="lg:col-span-2">
              <p className="text-base font-bold text-ink sm:text-lg">Type d’entraînement</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {QUIZ_MODES.map((item) => (
                  <ToggleCard
                    key={item.id}
                    active={mode.id === item.id}
                    label={item.label}
                    detail={item.detail}
                    onClick={() => setModeId(item.id)}
                  />
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-line bg-surface-2 p-5 text-base leading-relaxed text-muted">
                <p className="text-lg font-bold text-ink">Sans clavier japonais</p>
                <p className="mt-1.5">
                  Choisissez un objectif, l’application sélectionne les questions adaptées. Les
                  corrections restent déterministes après génération.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line p-6 sm:px-9 sm:py-7">
            <p className="text-base text-muted">
              Ollama local génère le quiz, jamais vos corrections.
            </p>
            <Button
              size="lg"
              loading={create.isPending}
              disabled={prompt.trim().length < 3}
              onClick={() =>
                create.mutate({
                  prompt: prompt.trim(),
                  level,
                  questionCount,
                  types: [...mode.types] as never[],
                  skills: [...mode.skills] as AiQuizSkill[],
                })
              }
            >
              <Sparkles aria-hidden className="size-5" /> Générer ma mission
            </Button>
          </div>
          {create.isError ? (
            <p role="alert" className="px-6 pb-6 text-base font-semibold text-danger sm:px-9">
              {quizErrorMessage(create.error)}
            </p>
          ) : null}
        </Card>
        {history.data && history.data.length > 0 ? (
          <Card className="p-6 sm:p-9">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-sky-soft text-sky">
                <History aria-hidden className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">Vos dernières missions</h2>
                <p className="text-base text-muted">
                  Reprenez un quiz actif ou consultez son score.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {history.data.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void fetchAiQuiz(item.id).then((loaded) => {
                      setSession(loaded);
                      setPosition(Math.min(loaded.answeredCount, loaded.quiz.questions.length - 1));
                      setAnswered(loaded.answeredCount);
                      setCorrect(loaded.correctCount);
                      setFinished(loaded.status === 'finished');
                    });
                  }}
                  className="cursor-pointer rounded-2xl border border-line bg-surface-2 p-5 text-left transition hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <p className="text-lg font-bold text-ink">{item.quiz.title}</p>
                  <p className="mt-1.5 line-clamp-2 text-base leading-relaxed text-muted">
                    {item.prompt}
                  </p>
                  <p className="mt-4 text-sm font-bold text-accent">
                    {item.level} · {item.correctCount}/{item.answeredCount} juste
                    {item.answeredCount > 1 ? 's' : ''} ·{' '}
                    {item.status === 'active' ? 'à reprendre' : 'terminé'}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        ) : null}
      </section>
    );
  }

  if (finished) {
    const accuracy = answered === 0 ? 0 : correct / answered;
    return (
      <section className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center p-8 text-center sm:p-12">
          <span className="font-jp flex size-24 items-center justify-center rounded-3xl bg-jade-soft text-6xl text-jade">
            完
          </span>
          <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Mission terminée</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            Ce score reste dans votre historique de quiz, sans modifier vos cartes FSRS.
          </p>
          <div className="mt-7 flex items-center gap-8">
            <Ring
              value={accuracy}
              size={116}
              stroke={10}
              tone={accuracy >= 0.6 ? 'jade' : 'danger'}
              label="Précision"
            >
              <span className="text-2xl font-extrabold">{Math.round(accuracy * 100)}%</span>
            </Ring>
            <p className="text-left text-3xl font-extrabold">
              {correct}
              <span className="text-lg text-muted">/{answered}</span>
              <span className="mt-1 block text-sm font-semibold text-muted">bonnes réponses</span>
            </p>
          </div>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => setSession(null)}>
              <RotateCcw aria-hidden className="size-4" /> Nouvelle mission
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/">Accueil</Link>
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  const question = session.quiz.questions[position];
  if (!question) return null;
  return (
    <QuizQuestion
      key={question.key}
      session={session}
      question={question}
      position={position}
      progressKeys={session.quiz.questions.map((item) => item.key)}
      result={answerResult}
      pending={answer.isPending}
      onAnswer={(value, shownAt) => answer.mutate({ key: question.key, value, shownAt })}
      onNext={() => {
        if (position + 1 >= session.quiz.questions.length) finish.mutate();
        else {
          setPosition((value) => value + 1);
          setAnswerResult(null);
        }
      }}
      finishPending={finish.isPending}
    />
  );
}

function QuizQuestion({
  session,
  question,
  position,
  progressKeys,
  result,
  pending,
  onAnswer,
  onNext,
  finishPending,
}: {
  session: AiQuizSessionDto;
  question: AiQuizPublicQuestion;
  position: number;
  progressKeys: string[];
  result: AiQuizAnswerResult | null;
  pending: boolean;
  onAnswer: (
    value: {
      choiceId?: string;
      orderedTileIds?: string[];
      pairings?: { leftId: string; rightId: string }[];
    },
    shownAt: number,
  ) => void;
  onNext: () => void;
  finishPending: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [hint, setHint] = useState(false);
  const [played, setPlayed] = useState(false);
  const [pairings, setPairings] = useState<Record<string, string>>({});
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const audio = useMutation({
    mutationFn: () => fetchAiQuizAudio(session.id, question.key),
    onSuccess: (sound) => {
      setPlayed(true);
      playAudio(sound.mimeType, sound.base64);
    },
  });
  const tiles = question.kind === 'order' ? question.tiles : [];
  const rightItems = question.kind === 'match' ? question.rightItems : [];
  const remaining = tiles.filter((tile) => !ordered.includes(tile.id));

  return (
    <section className="mx-auto max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="flex flex-1 gap-1.5">
          {progressKeys.map((key, index) => (
            <span
              key={key}
              className={`h-2 flex-1 rounded-full ${index < position ? 'bg-jade' : index === position ? 'bg-accent' : 'bg-surface-3'}`}
            />
          ))}
        </div>
        <p className="text-base font-bold tabular-nums text-muted">
          {position + 1}/{progressKeys.length}
        </p>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={question.key}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="mt-7"
        >
          <Card className="p-6 sm:p-10">
            <div className="flex flex-wrap justify-between gap-2">
              <Badge tone="accent">{STAGE_LABELS[question.stage]}</Badge>
              <Badge tone="info">{SKILL_LABELS[question.skill]}</Badge>
            </div>
            <h1 className="mt-7 text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
              {question.prompt.title}
            </h1>
            {question.prompt.contextFr ? (
              <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
                {question.prompt.contextFr}
              </p>
            ) : null}
            {question.type === 'listening_qcm' ? (
              <div className="mt-8 rounded-2xl border border-violet/25 bg-violet-soft p-6 text-center sm:p-8">
                <p className="text-base font-bold text-violet">ÉCOUTEZ AVANT DE CHOISIR</p>
                <Button
                  className="mt-4"
                  size="lg"
                  variant="secondary"
                  loading={audio.isPending}
                  onClick={() => audio.mutate()}
                >
                  <Volume2 aria-hidden className="size-5" /> Écouter
                </Button>
                {audio.isError ? (
                  <p className="mt-3 text-base text-danger">La voix locale est indisponible.</p>
                ) : null}
                {played && question.prompt.japanese ? (
                  <JapaneseLabel
                    label={question.prompt.japanese}
                    kana={question.prompt.kana}
                    className="mt-5 text-2xl text-ink sm:text-3xl"
                  />
                ) : null}
              </div>
            ) : question.prompt.japanese ? (
              <JapaneseLabel
                label={question.prompt.japanese}
                kana={question.type === 'reading_qcm' && !result ? undefined : question.prompt.kana}
                className="mt-8 text-center text-4xl leading-relaxed text-ink sm:text-5xl"
              />
            ) : null}
            {question.prompt.translationFr ? (
              <p className="mt-4 text-center text-lg leading-relaxed text-ink-soft">
                {question.prompt.translationFr}
              </p>
            ) : null}
            {!result ? (
              <>
                <div className="mt-9">
                  {question.kind === 'choice' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {question.choices.map((choice, index) => (
                        <button
                          key={choice.id}
                          type="button"
                          disabled={pending || (question.type === 'listening_qcm' && !played)}
                          onClick={() => {
                            setSelected(choice.id);
                            onAnswer({ choiceId: choice.id }, shownAt.current);
                          }}
                          className={`relative min-h-24 cursor-pointer rounded-2xl border-2 p-5 pr-10 text-left text-lg font-semibold leading-relaxed transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:p-6 sm:pr-12 ${selected === choice.id ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface-2 text-ink hover:border-accent/50'}`}
                        >
                          <span className="absolute right-4 top-4 text-sm font-bold text-muted">
                            {index + 1}
                          </span>
                          <JapaneseLabel label={choice.label} kana={choice.kana} />
                          {choice.detail ? (
                            <span className="mt-2 block text-base font-normal leading-relaxed text-muted">
                              {choice.detail}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : question.kind === 'order' ? (
                    <>
                      <div className="flex min-h-18 flex-wrap gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent-soft p-3">
                        {ordered.length === 0 ? (
                          <span className="p-2 text-sm text-muted">
                            Touchez les tuiles dans l’ordre.
                          </span>
                        ) : null}
                        {ordered.map((id) => {
                          const tile = tiles.find((item) => item.id === id);
                          return tile ? (
                            <button
                              key={id}
                              type="button"
                              onClick={() =>
                                setOrdered((items) => items.filter((item) => item !== id))
                              }
                              className="font-jp cursor-pointer rounded-xl bg-accent px-4 py-2 text-lg font-bold text-white"
                            >
                              <JapaneseLabel label={tile.label} kana={tile.kana} />
                              <X aria-hidden className="ml-1 inline size-3" />
                            </button>
                          ) : null;
                        })}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {remaining.map((tile) => (
                          <button
                            key={tile.id}
                            type="button"
                            onClick={() => setOrdered((items) => [...items, tile.id])}
                            className="font-jp cursor-pointer rounded-xl border border-line bg-surface-2 px-4 py-2 text-lg font-bold text-ink hover:border-accent/50"
                          >
                            <JapaneseLabel label={tile.label} kana={tile.kana} />
                          </button>
                        ))}
                      </div>
                      <Button
                        className="mt-5"
                        disabled={ordered.length !== tiles.length}
                        loading={pending}
                        onClick={() => onAnswer({ orderedTileIds: ordered }, shownAt.current)}
                      >
                        Valider l’ordre
                      </Button>
                    </>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-bold tracking-wider text-muted">À ASSOCIER</p>
                        {question.leftItems.map((item) => {
                          const pairedId = pairings[item.id];
                          const paired = question.rightItems.find((right) => right.id === pairedId);
                          return (
                            <fieldset
                              key={item.id}
                              aria-label={`Déposer une carte pour ${item.label}`}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                attachPair(item.id, event.dataTransfer.getData('text/plain'));
                              }}
                              className="rounded-xl border border-dashed border-accent/50 bg-accent-soft p-3"
                            >
                              <JapaneseLabel
                                label={item.label}
                                kana={item.kana}
                                className="text-lg font-bold text-ink"
                              />
                              {paired ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPairings((current) => {
                                      const next = { ...current };
                                      delete next[item.id];
                                      return next;
                                    })
                                  }
                                  className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-lg bg-accent px-3 py-2 text-left text-sm font-bold text-white"
                                >
                                  <JapaneseLabel label={paired.label} kana={paired.kana} />
                                  <X aria-hidden className="size-3" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedRightId && attachPair(item.id, selectedRightId)
                                  }
                                  className="mt-2 w-full cursor-pointer rounded-lg border border-accent/30 bg-surface px-3 py-2 text-left text-sm font-semibold text-muted"
                                >
                                  {selectedRightId ? 'Déposer ici' : 'Déposez une carte ici'}
                                </button>
                              )}
                            </fieldset>
                          );
                        })}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold tracking-wider text-muted">
                          CARTES À GLISSER
                        </p>
                        {rightItems.map((item) => {
                          const used = Object.values(pairings).includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              draggable={!used}
                              disabled={used}
                              onDragStart={(event) => {
                                event.dataTransfer.setData('text/plain', item.id);
                                event.dataTransfer.effectAllowed = 'move';
                              }}
                              onClick={() =>
                                setSelectedRightId((current) =>
                                  current === item.id ? null : item.id,
                                )
                              }
                              className={`w-full rounded-xl border px-4 py-3 text-left text-lg font-bold transition ${used ? 'cursor-not-allowed border-line bg-surface-3 text-muted opacity-50' : selectedRightId === item.id ? 'cursor-grab border-accent bg-accent-soft text-accent' : 'cursor-grab border-line bg-surface-2 text-ink hover:border-accent/50'}`}
                            >
                              <JapaneseLabel label={item.label} kana={item.kana} />
                            </button>
                          );
                        })}
                        <p className="pt-1 text-xs text-muted">
                          Glissez une carte vers la gauche. Sur mobile ou au clavier, touchez une
                          carte puis sa zone de dépôt.
                        </p>
                      </div>
                      <Button
                        className="sm:col-span-2"
                        disabled={
                          Object.keys(pairings).length !== question.leftItems.length ||
                          new Set(Object.values(pairings)).size !== question.leftItems.length
                        }
                        loading={pending}
                        onClick={() =>
                          onAnswer(
                            {
                              pairings: Object.entries(pairings).map(([leftId, rightId]) => ({
                                leftId,
                                rightId,
                              })),
                            },
                            shownAt.current,
                          )
                        }
                      >
                        Valider les associations
                      </Button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setHint(true)}
                  className="mt-7 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 text-base font-bold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Lightbulb aria-hidden className="size-5" /> Utiliser un indice
                </button>
                {hint ? (
                  <p className="mt-2 rounded-xl bg-gold-soft p-4 text-base leading-relaxed text-ink-soft">
                    {question.hint}
                  </p>
                ) : null}
              </>
            ) : (
              <div
                className={`mt-8 rounded-2xl border p-6 sm:p-8 ${result.correct ? 'border-jade/30 bg-jade-soft' : 'border-danger/30 bg-danger-soft'}`}
              >
                <p className="flex items-center gap-2 text-lg font-bold text-ink">
                  {result.correct ? (
                    <Check className="size-6 text-jade" />
                  ) : (
                    <X className="size-6 text-danger" />
                  )}
                  {result.correct ? 'Bonne réponse' : 'À revoir'}
                </p>
                <h2 className="mt-5 text-xl font-bold sm:text-2xl">{result.explanation.title}</h2>
                <p className="mt-2 text-base leading-relaxed text-ink-soft sm:text-lg">
                  {result.explanation.bodyFr}
                </p>
                <p className="mt-4 text-base font-bold leading-relaxed text-accent">
                  À retenir : {result.explanation.takeaway}
                </p>
                <Button className="mt-6" size="lg" loading={finishPending} onClick={onNext}>
                  {position + 1 === progressKeys.length ? 'Voir le bilan' : 'Question suivante'}
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </section>
  );

  function attachPair(leftId: string, rightId: string) {
    if (!rightItems.some((item) => item.id === rightId)) return;
    setPairings((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(
          ([currentLeftId, currentRightId]) =>
            currentLeftId !== leftId && currentRightId !== rightId,
        ),
      );
      return { ...next, [leftId]: rightId };
    });
    setSelectedRightId(null);
  }
}

function JapaneseLabel({
  label,
  kana,
  className,
}: {
  label: string;
  kana?: string;
  className?: string;
}) {
  return (
    <span className={`font-jp block ${className ?? ''}`.trim()}>
      {label}
      {kana && kana !== label ? (
        <span className="mt-1 block text-base font-medium leading-relaxed text-muted sm:text-lg">
          {kana}
        </span>
      ) : null}
    </span>
  );
}

function ChoiceGroup({
  title,
  values,
  selected,
  onChange,
  labels = {},
}: {
  title: string;
  values: readonly string[];
  selected: string;
  onChange: (value: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <p className="text-base font-bold text-ink sm:text-lg">{title}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`min-h-12 cursor-pointer rounded-xl border px-5 py-2.5 text-base font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected === value ? 'border-accent bg-accent text-white' : 'border-line bg-surface-2 text-ink-soft hover:border-accent/50'}`}
          >
            {labels[value] ?? value}
          </button>
        ))}
      </div>
    </div>
  );
}
function ToggleCard({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 cursor-pointer rounded-2xl border p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:border-accent/50'}`}
    >
      <span className="block text-base font-bold text-ink sm:text-lg">{label}</span>
      <span className="mt-2 block text-sm leading-relaxed text-muted sm:text-base">{detail}</span>
    </button>
  );
}
function playAudio(mimeType: string, base64: string) {
  const audio = new Audio(`data:${mimeType};base64,${base64}`);
  void audio.play();
}

function quizErrorMessage(error: unknown): string {
  if (
    error instanceof ApiRequestError &&
    typeof error.payload === 'object' &&
    error.payload !== null
  ) {
    const payload = error.payload as { error?: { message?: unknown }; message?: unknown };
    const message = payload.error?.message ?? payload.message;
    if (typeof message === 'string') return message;
  }
  return 'Le quiz local n’a pas pu être généré. Vérifiez l’état d’Ollama dans Conversation.';
}
