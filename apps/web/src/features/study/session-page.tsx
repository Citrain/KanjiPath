import type { AnswerResult, SentenceTokenDto } from '@kanjipath/contracts';
import { Badge, Button, Card, Ring } from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Furigana, SentenceView, useDisplaySettings } from '../content/japanese';
import { createSession, finishSession, resumeSession, sendAnswer } from './api';

const SKILL_LABELS: Record<string, string> = {
  meaning: 'sens',
  reading: 'lecture',
  vocabulary: 'vocabulaire',
  context: 'contexte',
  stroke: 'composants & traits',
};

function celebrate() {
  confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.7 },
    colors: ['#ff5c47', '#ffa03c', '#f2c14e', '#3ecf8e', '#7aa2ff'],
  });
}

export function SessionPage() {
  const queryClient = useQueryClient();
  const { romajiEnabled, furiganaMode } = useDisplaySettings();
  const [started, setStarted] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [localCorrect, setLocalCorrect] = useState(0);
  const [localAnswered, setLocalAnswered] = useState(0);
  const shownAtRef = useRef<number>(Date.now());

  const resume = useQuery({
    queryKey: ['study', 'session'],
    queryFn: resumeSession,
  });

  const startSession = useMutation({
    mutationFn: () => createSession('daily'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
  });

  const answer = useMutation({
    mutationFn: sendAnswer,
    onSuccess: (data) => {
      setResult(data);
      setLocalAnswered((value) => value + 1);
      if (data.correct) {
        setLocalCorrect((value) => value + 1);
      }
    },
  });

  const finish = useMutation({
    mutationFn: finishSession,
    onSuccess: () => {
      setFinished(true);
      const accuracy = localAnswered > 0 ? localCorrect / localAnswered : 0;
      if (accuracy >= 0.6 && localAnswered >= 3) {
        celebrate();
      }
      queryClient.invalidateQueries({ queryKey: ['study', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['kanji'] });
    },
  });

  const session = resume.data?.session ?? null;
  const items = resume.data?.items ?? [];
  const pendingItems = items.filter((item) => item.status === 'pending');
  const current = pendingItems[currentPosition] ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: réinitialisation volontaire à chaque exercice affiché
  useEffect(() => {
    shownAtRef.current = Date.now();
    setSelected(null);
    setTyped('');
    setResult(null);
  }, [current?.exerciseItemId]);

  function submit(value: string) {
    if (!current || answer.isPending || result) {
      return;
    }
    answer.mutate({
      exerciseItemId: current.exerciseItemId,
      answer: value,
      responseTimeMs: Date.now() - shownAtRef.current,
    });
  }

  function next() {
    setResult(null);
    setSelected(null);
    setTyped('');
    if (currentPosition + 1 >= pendingItems.length) {
      if (session) {
        finish.mutate(session.id);
      }
    } else {
      setCurrentPosition((value) => value + 1);
    }
  }

  if (resume.isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="shimmer h-72 rounded-3xl border border-line" />
      </div>
    );
  }

  if (finished || (!session && started)) {
    const accuracy = localAnswered > 0 ? localCorrect / localAnswered : 0;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-xl"
      >
        <Card className="flex flex-col items-center p-10 text-center">
          <span className="font-kanji text-glow animate-pop text-7xl text-accent">完</span>
          <h1 className="mt-4 text-3xl font-extrabold">Session terminée !</h1>
          <p className="mt-2 text-muted">
            Votre progression est enregistrée, les prochaines révisions sont planifiées.
          </p>
          {localAnswered > 0 ? (
            <div className="mt-8 flex items-center gap-8">
              <Ring
                value={accuracy}
                size={120}
                stroke={10}
                barClassName={accuracy >= 0.6 ? 'stroke-jade' : 'stroke-accent'}
              >
                <span className="text-2xl font-extrabold">{Math.round(accuracy * 100)}%</span>
              </Ring>
              <div className="text-left">
                <p className="text-3xl font-extrabold">
                  {localCorrect}
                  <span className="text-lg text-muted">/{localAnswered}</span>
                </p>
                <p className="text-sm font-semibold text-muted">bonnes réponses</p>
              </div>
            </div>
          ) : null}
          <div className="mt-8 flex gap-3">
            <Button
              size="lg"
              onClick={() => {
                setFinished(false);
                setStarted(false);
                setCurrentPosition(0);
                setLocalCorrect(0);
                setLocalAnswered(0);
                startSession.mutate();
              }}
            >
              Nouvelle session
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-2xl"
      >
        <Card className="relative overflow-hidden p-10 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="font-kanji animate-float absolute -right-4 -top-8 select-none text-[9rem] font-bold text-ink opacity-[0.05]">
              勉
            </span>
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
          </div>
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Répétition espacée · FSRS
            </p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
              Prêt à <span className="gradient-text">réviser</span> ?
            </h1>
            <p className="mx-auto mt-3 max-w-md text-muted">
              La session mélange révisions dues, points faibles et nouveaux kanji. Chaque réponse
              ajuste votre planification de révision.
            </p>
            <Button
              className="mt-8"
              size="xl"
              disabled={startSession.isPending}
              onClick={() => {
                setStarted(true);
                startSession.mutate();
              }}
            >
              {startSession.isPending ? 'Préparation de la session…' : 'Commencer ma session'}
            </Button>
            {startSession.isError ? (
              <p className="mt-4 text-sm font-medium text-danger">
                Impossible de démarrer une session pour l'instant.
              </p>
            ) : null}
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-10 text-center">
          <h1 className="text-2xl font-extrabold">File d'étude vide</h1>
          <Button
            className="mt-6"
            disabled={finish.isPending}
            onClick={() => session && finish.mutate(session.id)}
          >
            Terminer la session
          </Button>
        </Card>
      </div>
    );
  }

  const prompt = current.prompt as Record<string, unknown>;
  const instruction = typeof prompt.instruction === 'string' ? prompt.instruction : '';
  const isInputTemplate = current.template === 'reading_input_kana';
  const progressRatio =
    items.length > 0 ? (items.length - pendingItems.length + (result ? 1 : 0)) / items.length : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div
            className="gradient-accent h-full rounded-full"
            animate={{ width: `${Math.max(4, progressRatio * 100)}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <p className="shrink-0 text-sm font-bold text-muted">
          {Math.min(items.length - pendingItems.length + 1, items.length)}/{items.length}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.exerciseItemId}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="mt-6 p-8 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="info">compétence · {SKILL_LABELS[current.skill] ?? current.skill}</Badge>
              {current.kanjiLiteral ? (
                <span className="font-kanji rounded-xl border border-line bg-card-2 px-3 py-1 text-2xl">
                  {current.kanjiLiteral}
                </span>
              ) : null}
            </div>

            <p className="mt-6 text-lg font-bold text-ink">{instruction}</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              {typeof prompt.kanji === 'string' ? (
                <span className="font-kanji text-glow text-8xl text-ink">{prompt.kanji}</span>
              ) : null}
              {typeof prompt.word === 'string' ? (
                <span
                  className={`text-center font-kanji text-5xl text-ink ${
                    furiganaMode === 'hover' ? 'furigana-hover' : ''
                  }`}
                >
                  <Furigana
                    text={prompt.word}
                    reading={
                      typeof prompt.wordRomaji === 'string' &&
                      typeof prompt.wordReading === 'string'
                        ? prompt.wordReading
                        : null
                    }
                    mode={furiganaMode}
                  />
                  {romajiEnabled && typeof prompt.wordRomaji === 'string' ? (
                    <span className="mt-1 block font-sans text-base font-medium tracking-wide text-muted">
                      {prompt.wordRomaji}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {typeof prompt.sentence === 'string' ? (
                Array.isArray(prompt.tokens) ? (
                  <SentenceView
                    tokens={prompt.tokens as SentenceTokenDto[]}
                    japanese={prompt.sentence}
                    romajiEnabled={romajiEnabled}
                    furiganaMode={furiganaMode}
                    className="text-center font-kanji text-3xl"
                  />
                ) : (
                  <span className="font-kanji text-center text-3xl leading-relaxed text-ink">
                    {prompt.sentence}
                  </span>
                )
              ) : null}
              {typeof prompt.reading === 'string' ? (
                <span className="flex flex-col items-center gap-1 rounded-xl bg-sky-soft px-4 py-2 text-sky">
                  <span className="font-kanji text-3xl">{prompt.reading}</span>
                  {romajiEnabled && typeof prompt.readingRomaji === 'string' ? (
                    <span className="text-sm font-semibold opacity-75">{prompt.readingRomaji}</span>
                  ) : null}
                </span>
              ) : null}
              {typeof prompt.meaning === 'string' && typeof prompt.kanji !== 'string' ? (
                <span className="text-2xl font-bold text-ink">« {prompt.meaning} »</span>
              ) : null}
              {typeof prompt.component === 'string' ? (
                <span className="font-kanji text-glow text-7xl text-sky">{prompt.component}</span>
              ) : null}
            </div>

            {!result ? (
              <div className="mt-8">
                {isInputTemplate ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (typed.trim().length > 0) {
                        submit(typed.trim());
                      }
                    }}
                    className="flex flex-col items-center gap-3"
                  >
                    <input
                      value={typed}
                      onChange={(event) => setTyped(event.target.value)}
                      placeholder="Écris ta réponse en kana…"
                      className="h-14 w-full max-w-sm rounded-2xl border border-line bg-bg-soft px-4 text-center text-2xl text-ink placeholder:text-muted focus:border-accent/60 focus:outline-2 focus:outline-accent/30"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      disabled={typed.trim().length === 0 || answer.isPending}
                    >
                      {answer.isPending ? 'Vérification…' : 'Valider'}
                    </Button>
                  </form>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {current.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={answer.isPending}
                        onClick={() => {
                          setSelected(option);
                          submit(option);
                        }}
                        className={`cursor-pointer rounded-2xl border-2 px-5 py-4 text-left text-xl font-semibold transition-all duration-150 ${
                          selected === option
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-card-2 text-ink hover:-translate-y-0.5 hover:border-accent/50'
                        } ${answer.isPending ? 'opacity-60' : ''}`}
                      >
                        <span className={isInputTemplate ? '' : 'font-kanji'}>{option}</span>
                      </button>
                    ))}
                  </div>
                )}
                {answer.isError ? (
                  <p className="mt-4 text-center text-sm font-medium text-danger">
                    Erreur lors de l'envoi de la réponse. Réessaie.
                  </p>
                ) : null}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-8"
              >
                <div
                  className={`rounded-2xl border p-5 ${
                    result.correct
                      ? 'border-jade/40 bg-jade-soft'
                      : 'animate-shake border-danger/40 bg-danger/10'
                  }`}
                  role="status"
                >
                  <p
                    className={`text-lg font-extrabold ${result.correct ? 'text-jade' : 'text-danger'}`}
                  >
                    {result.correct
                      ? '✓ Correct !'
                      : `✗ Incorrect — réponse : ${result.acceptedAnswers.join(' ou ')}`}
                  </p>
                  {result.explanation ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      {result.explanation}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs font-semibold text-muted">
                    Prochaine révision :{' '}
                    {new Date(result.nextDueAt).toLocaleString('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="mt-5 flex justify-center">
                  <Button size="lg" onClick={next} disabled={finish.isPending}>
                    {currentPosition + 1 >= pendingItems.length
                      ? 'Terminer la session'
                      : 'Continuer →'}
                  </Button>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
