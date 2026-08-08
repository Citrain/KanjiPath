import type {
  AnswerResult,
  JlptLevel,
  SentenceTokenDto,
  Skill,
  StudyQueueItem,
  StudyTarget,
} from '@kanjipath/contracts';
import { Badge, Button, Card, Modal, Ring, Segmented, Skeleton } from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Delete,
  LogOut,
  Sparkles,
  Target,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { JLPT_LEVELS } from '../../lib/levels';
import { SKILL_LABELS, SKILLS } from '../../lib/skills';
import { fetchDashboard } from '../content/api';
import { AudioButton } from '../content/audio-button';
import { Furigana, SentenceView, useDisplaySettings } from '../content/japanese';
import { abandonSession, createSession, finishSession, resumeSession, sendAnswer } from './api';

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/;

type SessionMode = 'daily' | 'weak_points' | 'free' | 'targeted';

const MODES: Array<{
  mode: SessionMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
  recommended?: boolean;
}> = [
  {
    mode: 'daily',
    title: 'Session du jour',
    description: 'Révisions dues, points faibles et nouveaux kanji : le mélange quotidien idéal.',
    icon: Sparkles,
    recommended: true,
  },
  {
    mode: 'weak_points',
    title: 'Points faibles',
    description: 'Concentrez-vous sur les kanji et compétences qui résistent encore.',
    icon: Target,
  },
  {
    mode: 'targeted',
    title: 'Révision ciblée',
    description: 'Choisissez un niveau, une compétence ou des kanji précis à travailler.',
    icon: Crosshair,
  },
  {
    mode: 'free',
    title: 'Session libre',
    description: 'Un mélange aléatoire du parcours, sans priorité particulière.',
    icon: Zap,
  },
];

const RATING_LABELS: Record<AnswerResult['rating'], string> = {
  again: 'à revoir',
  hard: 'difficile',
  good: 'acquis',
  easy: 'facile',
};

const KANA_GROUPS = [
  {
    label: 'Kana courants, regroupés par son',
    rows: [
      [['あ', 'い', 'う', 'え', 'お']],
      [
        ['か', 'が'],
        ['き', 'ぎ'],
        ['く', 'ぐ'],
        ['け', 'げ'],
        ['こ', 'ご'],
      ],
      [
        ['さ', 'ざ'],
        ['し', 'じ'],
        ['す', 'ず'],
        ['せ', 'ぜ'],
        ['そ', 'ぞ'],
      ],
      [
        ['た', 'だ'],
        ['ち', 'ぢ'],
        ['つ', 'づ'],
        ['て', 'で'],
        ['と', 'ど'],
      ],
      [['な', 'に', 'ぬ', 'ね', 'の']],
      [
        ['は', 'ば', 'ぱ'],
        ['ひ', 'び', 'ぴ'],
        ['ふ', 'ぶ', 'ぷ'],
        ['へ', 'べ', 'ぺ'],
        ['ほ', 'ぼ', 'ぽ'],
      ],
      [['ま', 'み', 'む', 'め', 'も']],
      [['や', 'ゆ', 'よ']],
      [['ら', 'り', 'る', 'れ', 'ろ']],
      [['わ', 'を', 'ん']],
    ],
  },
  {
    label: 'Petits kana et signes',
    rows: [
      [
        ['ゃ', 'ゅ', 'ょ', 'っ'],
        ['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ'],
      ],
      [['ー', '、', '。']],
    ],
  },
];

function celebrate() {
  confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.7 },
    colors: ['#ff5c47', '#ffa03c', '#f2c14e', '#3ecf8e', '#7aa2ff'],
  });
}

interface TargetKanji {
  id: string;
  literal: string;
}

export function SessionPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { romajiEnabled, furiganaMode } = useDisplaySettings();
  const [currentPosition, setCurrentPosition] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [localCorrect, setLocalCorrect] = useState(0);
  const [localAnswered, setLocalAnswered] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, boolean>>({});
  const [targetPanelOpen, setTargetPanelOpen] = useState(false);
  const [targetLevel, setTargetLevel] = useState<'all' | JlptLevel>('all');
  const [targetSkill, setTargetSkill] = useState<'all' | Skill>('all');
  const [targetKanji, setTargetKanji] = useState<TargetKanji[]>([]);
  const [quitModalOpen, setQuitModalOpen] = useState(false);
  const shownAtRef = useRef<number>(Date.now());

  const resume = useQuery({
    queryKey: ['study', 'session'],
    queryFn: resumeSession,
  });
  const dashboard = useQuery({
    queryKey: ['progress', 'dashboard'],
    queryFn: fetchDashboard,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: lecture unique des paramètres d'arrivée
  useEffect(() => {
    if (searchParams.get('mode') !== 'targeted') {
      return;
    }
    setTargetPanelOpen(true);
    const level = searchParams.get('level');
    if (level && JLPT_LEVELS.includes(level as JlptLevel)) {
      setTargetLevel(level as JlptLevel);
    }
    const skill = searchParams.get('skill');
    if (skill && SKILLS.includes(skill as Skill)) {
      setTargetSkill(skill as Skill);
    }
    const ids = searchParams.get('kanjiIds')?.split(',').filter(Boolean) ?? [];
    const literals = searchParams.get('kanjiLits')?.split(',').filter(Boolean) ?? [];
    if (ids.length > 0) {
      setTargetKanji(ids.map((id, index) => ({ id, literal: literals[index] ?? '?' })));
    }
    setSearchParams({}, { replace: true });
  }, []);

  const startSession = useMutation({
    mutationFn: (input: { mode: SessionMode; target?: StudyTarget }) =>
      createSession(input.mode, input.target),
    onSuccess: () => {
      setTargetPanelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['study', 'session'] });
    },
  });

  function startTargeted() {
    const target: StudyTarget = {};
    if (targetLevel !== 'all') {
      target.level = targetLevel;
    }
    if (targetSkill !== 'all') {
      target.skill = targetSkill;
    }
    if (targetKanji.length > 0) {
      target.kanjiIds = targetKanji.map((kanji) => kanji.id);
    }
    if (!target.level && !target.skill && !target.kanjiIds) {
      return;
    }
    startSession.mutate({ mode: 'targeted', target });
  }

  const targetReady = targetLevel !== 'all' || targetSkill !== 'all' || targetKanji.length > 0;
  const levelsLoaded = dashboard.data !== undefined;
  const publishedLevels = new Set(
    (dashboard.data?.levels ?? []).filter((level) => level.total > 0).map((level) => level.level),
  );

  const answer = useMutation({
    mutationFn: sendAnswer,
    onSuccess: (data, payload) => {
      setResult(data);
      setLocalAnswered((value) => value + 1);
      if (data.correct) {
        setLocalCorrect((value) => value + 1);
      }
      setOutcomes((current) => ({ ...current, [payload.exerciseItemId]: data.correct }));
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

  const abandon = useMutation({
    mutationFn: abandonSession,
    onSuccess: () => {
      setQuitModalOpen(false);
      setCurrentPosition(0);
      setLocalCorrect(0);
      setLocalAnswered(0);
      setOutcomes({});
      queryClient.invalidateQueries({ queryKey: ['study', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  const session = resume.data?.session ?? null;
  const items = resume.data?.items ?? [];
  const pendingItems = useMemo(() => items.filter((item) => item.status === 'pending'), [items]);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: next/submit suivent l'exercice courant via closure
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (result && event.key === 'Enter') {
        event.preventDefault();
        next();
        return;
      }
      if (
        isTyping ||
        result ||
        current.template === 'reading_input_kana' ||
        current.template === 'audio_dictation_kana'
      ) {
        return;
      }
      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= current.options.length) {
        const option = current.options[digit - 1];
        if (option !== undefined) {
          setSelected(option);
          submit(option);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, result]);

  if (resume.isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  if (resume.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-10 text-center">
          <p className="text-lg font-bold">Impossible de charger la session.</p>
          <Button variant="secondary" className="mt-4" onClick={() => resume.refetch()}>
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  if (
    finished ||
    (!session && startSession.isSuccess && pendingItems.length === 0 && localAnswered === 0)
  ) {
    const accuracy = localAnswered > 0 ? localCorrect / localAnswered : 0;
    const message =
      localAnswered === 0
        ? 'La file était vide — rien à réviser cette fois.'
        : accuracy >= 0.9
          ? 'Excellent travail, votre mémoire est solide.'
          : accuracy >= 0.6
            ? 'Belle session, la progression est bien engagée.'
            : 'Chaque erreur prépare une meilleure révision. Continuez !';

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-xl"
      >
        <Card className="flex flex-col items-center p-10 text-center">
          <span className="font-jp animate-pop flex size-20 items-center justify-center rounded-3xl bg-jade-soft text-5xl text-jade">
            完
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Session terminée !</h1>
          <p className="mt-2 max-w-sm text-muted">{message}</p>
          {localAnswered > 0 ? (
            <div className="mt-8 flex items-center gap-10">
              <Ring
                value={accuracy}
                size={124}
                stroke={10}
                tone={accuracy >= 0.6 ? 'jade' : 'danger'}
                label="Précision de la session"
              >
                <span className="text-2xl font-extrabold">{Math.round(accuracy * 100)}%</span>
              </Ring>
              <div className="text-left">
                <p className="text-4xl font-extrabold">
                  {localCorrect}
                  <span className="text-xl text-muted">/{localAnswered}</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-muted">bonnes réponses</p>
              </div>
            </div>
          ) : null}
          <p className="mt-6 text-sm text-muted">
            Votre progression est enregistrée, les prochaines révisions sont planifiées.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              loading={startSession.isPending}
              onClick={() => {
                setFinished(false);
                setCurrentPosition(0);
                setLocalCorrect(0);
                setLocalAnswered(0);
                setOutcomes({});
                startSession.mutate({ mode: 'daily' });
              }}
            >
              Nouvelle session
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to="/">Tableau de bord</Link>
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
        className="mx-auto max-w-4xl"
      >
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Répétition espacée · FSRS
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Prêt à réviser ?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[0.9375rem] text-muted">
            Chaque réponse ajuste la planification de vos révisions. Choisissez votre session :
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MODES.map((mode, index) => {
            const Icon = mode.icon;
            const isTargeted = mode.mode === 'targeted';
            return (
              <motion.div
                key={mode.mode}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.06, duration: 0.35 }}
              >
                <Card
                  hover
                  className={`flex h-full flex-col ${
                    mode.recommended ? 'border-accent/40 bg-accent-soft' : ''
                  } ${isTargeted && targetPanelOpen ? 'border-accent/40' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex size-11 items-center justify-center rounded-xl ${
                        mode.recommended ? 'bg-accent text-white' : 'bg-surface-2 text-accent'
                      }`}
                    >
                      <Icon aria-hidden className="size-5" />
                    </span>
                    {mode.recommended ? <Badge tone="accent">recommandé</Badge> : null}
                  </div>
                  <h2 className="mt-4 text-lg font-bold">{mode.title}</h2>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
                    {mode.description}
                  </p>
                  <Button
                    className="mt-5 w-full"
                    variant={mode.recommended ? 'primary' : 'secondary'}
                    loading={startSession.isPending && startSession.variables?.mode === mode.mode}
                    disabled={startSession.isPending}
                    onClick={() => {
                      if (isTargeted) {
                        setTargetPanelOpen((open) => !open);
                      } else {
                        startSession.mutate({ mode: mode.mode });
                      }
                    }}
                  >
                    {isTargeted ? (targetPanelOpen ? 'Fermer' : 'Configurer') : 'Commencer'}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {targetPanelOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Card className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Crosshair aria-hidden className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold">Composer votre révision ciblée</h2>
                      <p className="text-sm text-muted">
                        Au moins un filtre est nécessaire pour démarrer.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-ink-soft">Niveau</p>
                    <Segmented
                      ariaLabel="Filtrer par niveau"
                      size="sm"
                      value={targetLevel}
                      onChange={setTargetLevel}
                      options={[
                        { value: 'all', label: 'Tous' },
                        ...JLPT_LEVELS.map((level) => ({
                          value: level,
                          label: level,
                          disabled: levelsLoaded && !publishedLevels.has(level),
                        })),
                      ]}
                    />
                    <p className="text-xs text-muted">
                      Seuls les niveaux publiés sont sélectionnables.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-ink-soft">Compétence</p>
                    <Segmented
                      ariaLabel="Filtrer par compétence"
                      size="sm"
                      value={targetSkill}
                      onChange={setTargetSkill}
                      options={[
                        { value: 'all', label: 'Toutes' },
                        ...SKILLS.map((skill) => ({
                          value: skill,
                          label: SKILL_LABELS[skill] ?? skill,
                        })),
                      ]}
                    />
                  </div>
                </div>

                {targetKanji.length > 0 ? (
                  <div className="mt-6">
                    <p className="text-sm font-bold text-ink-soft">
                      Kanji sélectionnés ({targetKanji.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {targetKanji.map((kanji) => (
                        <span
                          key={kanji.id}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5"
                        >
                          <span className="font-jp text-lg text-ink">{kanji.literal}</span>
                          <button
                            type="button"
                            aria-label={`Retirer ${kanji.literal} de la sélection`}
                            onClick={() =>
                              setTargetKanji((list) =>
                                list.filter((entry) => entry.id !== kanji.id),
                              )
                            }
                            className="cursor-pointer rounded-md p-0.5 text-muted transition-colors hover:bg-surface-3 hover:text-danger"
                          >
                            <X aria-hidden className="size-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    disabled={!targetReady}
                    loading={startSession.isPending && startSession.variables?.mode === 'targeted'}
                    onClick={startTargeted}
                  >
                    Démarrer la session ciblée
                    <ArrowRight aria-hidden className="size-4.5" />
                  </Button>
                  {!targetReady ? (
                    <p className="text-sm text-muted">
                      Choisissez un niveau, une compétence ou des kanji à réviser.
                    </p>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {startSession.isError ? (
          <p role="alert" className="mt-6 text-center text-sm font-medium text-danger">
            Impossible de démarrer une session pour l'instant.
          </p>
        ) : null}
      </motion.div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-10 text-center">
          <h1 className="text-2xl font-extrabold">File d'étude vide</h1>
          <p className="mt-2 text-sm text-muted">
            Tous les exercices de cette session ont été traités.
          </p>
          <Button
            className="mt-6"
            loading={finish.isPending}
            onClick={() => session && finish.mutate(session.id)}
          >
            Terminer la session
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <ExerciseView
        current={current}
        items={items}
        pendingCount={pendingItems.length}
        selected={selected}
        typed={typed}
        result={result}
        outcomes={outcomes}
        answerPending={answer.isPending}
        answerError={answer.isError}
        finishPending={finish.isPending}
        romajiEnabled={romajiEnabled}
        furiganaMode={furiganaMode}
        onTyped={setTyped}
        onSelect={(option) => {
          setSelected(option);
          submit(option);
        }}
        onSubmit={submit}
        onNext={next}
        onQuit={() => setQuitModalOpen(true)}
        isLast={currentPosition + 1 >= pendingItems.length}
      />

      <Modal
        open={quitModalOpen}
        onOpenChange={setQuitModalOpen}
        title="Quitter la session ?"
        description="Vos réponses déjà données sont conservées et la progression est enregistrée."
      >
        <div className="flex flex-col gap-3">
          <Button
            variant="danger"
            loading={abandon.isPending}
            onClick={() => session && abandon.mutate(session.id)}
          >
            Abandonner la session
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setQuitModalOpen(false);
              navigate('/');
            }}
          >
            Continuer plus tard
          </Button>
          <p className="text-center text-xs text-muted">
            « Continuer plus tard » garde la session ouverte : vous la reprendrez ici. « Abandonner
            » ferme la session et libère la file.
          </p>
        </div>
      </Modal>
    </>
  );
}

interface ExerciseViewProps {
  current: StudyQueueItem;
  items: StudyQueueItem[];
  pendingCount: number;
  selected: string | null;
  typed: string;
  result: AnswerResult | null;
  outcomes: Record<string, boolean>;
  answerPending: boolean;
  answerError: boolean;
  finishPending: boolean;
  romajiEnabled: boolean;
  furiganaMode: 'always' | 'hover' | 'never';
  onTyped: (value: string) => void;
  onSelect: (option: string) => void;
  onSubmit: (value: string) => void;
  onNext: () => void;
  onQuit: () => void;
  isLast: boolean;
}

function ExerciseView({
  current,
  items,
  pendingCount,
  selected,
  typed,
  result,
  outcomes,
  answerPending,
  answerError,
  finishPending,
  romajiEnabled,
  furiganaMode,
  onTyped,
  onSelect,
  onSubmit,
  onNext,
  onQuit,
  isLast,
}: ExerciseViewProps) {
  const prompt = current.prompt as Record<string, unknown>;
  const instruction = typeof prompt.instruction === 'string' ? prompt.instruction : '';
  const isInputTemplate = current.template === 'reading_input_kana';
  const isAudioDictation = current.template === 'audio_dictation_kana';
  const answeredCount = items.length - pendingCount + (result ? 1 : 0);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const exerciseItemId = current.exerciseItemId;

  useEffect(() => {
    if (exerciseItemId && isInputTemplate && !result) {
      answerInputRef.current?.focus();
    }
  }, [exerciseItemId, isInputTemplate, result]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-4">
        <div aria-hidden className="flex flex-1 gap-1">
          {items.map((item) => {
            const isCurrent = item.exerciseItemId === current.exerciseItemId;
            const outcome = outcomes[item.exerciseItemId];
            const answered = item.status !== 'pending' || outcome !== undefined;
            return (
              <span
                key={item.sessionItemId}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  answered && outcome === true
                    ? 'bg-jade'
                    : answered && outcome === false
                      ? 'bg-danger'
                      : isCurrent
                        ? 'bg-accent'
                        : 'bg-surface-3'
                }`}
              />
            );
          })}
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums text-muted">
          {Math.min(answeredCount + 1, items.length)}/{items.length}
        </p>
        <button
          type="button"
          onClick={onQuit}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogOut aria-hidden className="size-4" />
          Quitter
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.exerciseItemId}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="mt-6 p-6 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="info">compétence · {SKILL_LABELS[current.skill] ?? current.skill}</Badge>
              {current.kanjiLiteral ? (
                <span className="font-jp rounded-lg border border-line bg-surface-2 px-2.5 py-0.5 text-xl text-ink">
                  {current.kanjiLiteral}
                </span>
              ) : null}
            </div>

            <p className="mt-6 text-center text-lg font-bold text-ink">{instruction}</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              {typeof prompt.kanji === 'string' ? (
                <span className="font-jp text-8xl leading-none text-ink">{prompt.kanji}</span>
              ) : null}
              {typeof prompt.word === 'string' ? (
                <span
                  className={`font-jp text-center text-5xl leading-relaxed text-ink ${
                    furiganaMode === 'hover' ? 'furigana-hover' : ''
                  }`}
                >
                  <Furigana
                    text={prompt.word}
                    reading={
                      typeof prompt.wordReading === 'string' &&
                      typeof prompt.wordRomaji === 'string'
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
                    className="font-jp text-center text-3xl"
                  />
                ) : (
                  <span className="font-jp text-center text-3xl leading-relaxed text-ink">
                    {prompt.sentence}
                  </span>
                )
              ) : null}
              {typeof prompt.reading === 'string' ? (
                <span className="flex flex-col items-center gap-1 rounded-xl border border-sky/20 bg-sky-soft px-5 py-2.5 text-sky">
                  <span className="font-jp text-3xl">{prompt.reading}</span>
                  {romajiEnabled && typeof prompt.readingRomaji === 'string' ? (
                    <span className="text-sm font-semibold opacity-80">{prompt.readingRomaji}</span>
                  ) : null}
                </span>
              ) : null}
              {typeof prompt.meaning === 'string' && typeof prompt.kanji !== 'string' ? (
                <span className="text-2xl font-bold text-ink">« {prompt.meaning} »</span>
              ) : null}
              {typeof prompt.component === 'string' ? (
                <span className="font-jp text-7xl text-sky">{prompt.component}</span>
              ) : null}
              {isAudioDictation && typeof prompt.audioResourceId === 'string' ? (
                <AudioButton
                  audio={{
                    id: prompt.audioResourceId,
                    url: `/audio/${prompt.audioResourceId}`,
                    transcript: '',
                    attribution: '',
                    license: '',
                  }}
                  label="Écouter l'audio"
                />
              ) : null}
            </div>

            {!result ? (
              <div className="mt-8">
                {isInputTemplate || isAudioDictation ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (typed.trim().length > 0) {
                        onSubmit(typed.trim());
                      }
                    }}
                    className="flex flex-col items-center gap-3"
                  >
                    <label className="sr-only" htmlFor="study-answer">
                      Votre réponse en kana
                    </label>
                    <input
                      id="study-answer"
                      ref={answerInputRef}
                      value={typed}
                      onChange={(event) => onTyped(event.target.value)}
                      placeholder="Écrivez votre réponse en kana…"
                      autoComplete="off"
                      lang="ja"
                      className="h-14 w-full max-w-sm rounded-2xl border border-line bg-surface-2 px-4 text-center text-2xl text-ink transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent/70 focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
                    />
                    <fieldset className="w-full max-w-4xl">
                      <legend className="mb-2 w-full text-center text-xs font-semibold text-muted">
                        Clavier hiragana
                      </legend>
                      <div className="flex flex-col gap-4">
                        {KANA_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="mb-1.5 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
                              {group.label}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {group.rows.map((row) => (
                                <div
                                  key={row.flat().join('')}
                                  className="flex flex-wrap justify-center gap-2"
                                >
                                  {row.map((variant) => (
                                    <div
                                      key={variant.join('')}
                                      className="flex gap-2 rounded-xl border border-line/70 p-1.5"
                                    >
                                      {variant.map((kana) => (
                                        <button
                                          key={kana}
                                          type="button"
                                          onClick={() => onTyped(`${typed}${kana}`)}
                                          className="font-jp flex size-11 items-center justify-center rounded-lg bg-surface-2 text-2xl font-semibold text-ink transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                          aria-label={`Ajouter ${kana}`}
                                        >
                                          {kana}
                                        </button>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => onTyped([...typed].slice(0, -1).join(''))}
                          disabled={typed.length === 0}
                          className="inline-flex h-9 items-center justify-center gap-2 self-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Delete aria-hidden className="size-4" />
                          Effacer
                        </button>
                      </div>
                    </fieldset>
                    <Button
                      type="submit"
                      size="lg"
                      loading={answerPending}
                      disabled={typed.trim().length === 0}
                    >
                      Valider
                    </Button>
                  </form>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {current.options.map((option, index) => {
                      const isSelected = selected === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          disabled={answerPending}
                          onClick={() => onSelect(option)}
                          className={`relative cursor-pointer rounded-2xl border-2 px-5 py-4 text-left text-xl font-semibold transition-all duration-150 disabled:opacity-60 ${
                            isSelected
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface-2 text-ink hover:-translate-y-0.5 hover:border-accent/50'
                          }`}
                        >
                          <span
                            aria-hidden
                            className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-md bg-surface-3 text-[0.6875rem] font-bold text-muted"
                          >
                            {index + 1}
                          </span>
                          <span className={CJK_RE.test(option) ? 'font-jp' : ''}>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {answerPending ? (
                  <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
                    Vérification…
                  </p>
                ) : null}
                {answerError ? (
                  <p role="alert" className="mt-4 text-center text-sm font-medium text-danger">
                    Erreur lors de l'envoi de la réponse. Réessayez.
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
                {isInputTemplate ? null : (
                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    {current.options.map((option) => {
                      const isAccepted = result.acceptedAnswers.includes(option);
                      const isSelected = selected === option;
                      return (
                        <div
                          key={option}
                          aria-hidden
                          className={`rounded-2xl border-2 px-5 py-3.5 text-xl font-semibold transition-all duration-300 ${
                            isAccepted
                              ? 'border-jade/60 bg-jade-soft text-jade'
                              : isSelected
                                ? 'border-danger/60 bg-danger-soft text-danger'
                                : 'border-line bg-surface-2 text-muted opacity-50'
                          }`}
                        >
                          <span className={CJK_RE.test(option) ? 'font-jp' : ''}>{option}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div
                  role="status"
                  className={`rounded-2xl border p-5 ${
                    result.correct
                      ? 'border-jade/40 bg-jade-soft'
                      : 'animate-shake border-danger/40 bg-danger-soft'
                  }`}
                >
                  <p
                    className={`flex items-center gap-2.5 text-lg font-extrabold ${
                      result.correct ? 'text-jade' : 'text-danger'
                    }`}
                  >
                    {result.correct ? (
                      <>
                        <CheckCircle2 aria-hidden className="size-5 shrink-0" />
                        Correct !
                      </>
                    ) : (
                      <>
                        <XCircle aria-hidden className="size-5 shrink-0" />
                        Incorrect
                      </>
                    )}
                    <Badge tone={result.correct ? 'success' : 'danger'}>
                      {RATING_LABELS[result.rating]}
                    </Badge>
                  </p>
                  {!result.correct ? (
                    <p className="mt-2 text-sm font-semibold text-ink-soft">
                      Réponse attendue :{' '}
                      <span className="font-jp text-base">
                        {result.acceptedAnswers.join(' ou ')}
                      </span>
                    </p>
                  ) : null}
                  {result.explanation ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
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
                <div className="mt-5 flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto sm:min-w-64"
                    onClick={onNext}
                    loading={finishPending}
                  >
                    {isLast ? 'Terminer la session' : 'Continuer'}
                    <ArrowRight aria-hidden className="size-4.5" />
                  </Button>
                  <p className="text-xs text-muted">Astuce : appuyez sur Entrée pour continuer.</p>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
