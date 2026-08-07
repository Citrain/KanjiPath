import {
  Badge,
  Button,
  Card,
  ErrorState,
  IconButton,
  Progress,
  SectionHeader,
  Segmented,
  Skeleton,
  Tooltip,
  useToast,
} from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eraser,
  Flag,
  PenLine,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LevelBadge } from '../../components/level-badge';
import { fetchKanjiDetail, fetchKanjiList, kanjiSvgUrl } from '../content/api';
import { IssueModal } from './issue-modal';
import {
  matchStroke,
  type SampledStroke,
  type StrokePoint,
  type StrokeVerdict,
  samplePath,
  toViewBoxPoint,
} from './stroke-match';

type GhostLevel = 'full' | 'current' | 'none';

interface CommittedStroke {
  index: number;
  skipped: boolean;
}

const VERDICT_MESSAGES: Record<Exclude<StrokeVerdict, 'ok'>, string> = {
  start: 'Commencez le trait sur le point numéroté.',
  direction: 'Le trait part dans le mauvais sens.',
  shape: 'Suivez le tracé guide de plus près.',
  coverage: 'Tracez le trait en entier, jusqu’au bout.',
};

function celebrate() {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#ff5c47', '#ffa03c', '#f2c14e', '#3ecf8e', '#7aa2ff'],
  });
}

function strokeOrder(id: string | null): number {
  if (!id) {
    return Number.MAX_SAFE_INTEGER;
  }
  const match = /-s(\d+)$/.exec(id);
  return match?.[1] ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function pointsToPath(points: StrokePoint[]): string {
  const first = points[0];
  if (!first) {
    return '';
  }
  let d = `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
  for (const point of points.slice(1)) {
    d += ` L${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }
  return d;
}

function StrokeCue({ stroke, number }: { stroke: SampledStroke; number: number }) {
  const ahead = stroke.points.find((point) => {
    const gap = Math.hypot(point.x - stroke.start.x, point.y - stroke.start.y);
    return gap >= 9;
  });
  const target = ahead ?? stroke.end;
  const angle = Math.atan2(target.y - stroke.start.y, target.x - stroke.start.x);
  const arrowStart = {
    x: stroke.start.x + Math.cos(angle) * 7.5,
    y: stroke.start.y + Math.sin(angle) * 7.5,
  };
  const arrowEnd = {
    x: stroke.start.x + Math.cos(angle) * 15,
    y: stroke.start.y + Math.sin(angle) * 15,
  };
  const head = (offset: number) => ({
    x: arrowEnd.x - Math.cos(angle + offset) * 4,
    y: arrowEnd.y - Math.sin(angle + offset) * 4,
  });
  const left = head(0.5);
  const right = head(-0.5);

  return (
    <g aria-hidden>
      <line
        x1={arrowStart.x}
        y1={arrowStart.y}
        x2={arrowEnd.x}
        y2={arrowEnd.y}
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d={`M${left.x},${left.y} L${arrowEnd.x},${arrowEnd.y} L${right.x},${right.y}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={stroke.start.x}
        cy={stroke.start.y}
        r="5.5"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="1.4"
      />
      <text
        x={stroke.start.x}
        y={stroke.start.y + 2.4}
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="var(--accent)"
      >
        {number}
      </text>
    </g>
  );
}

interface WritingPadProps {
  literal: string;
  strokes: SampledStroke[];
  current: number;
  committed: CommittedStroke[];
  ghostLevel: GhostLevel;
  onStrokeAccepted: () => void;
  onStrokeRejected: (message: string) => void;
  disabled: boolean;
}

function WritingPad({
  literal,
  strokes,
  current,
  committed,
  ghostLevel,
  onStrokeAccepted,
  onStrokeRejected,
  disabled,
}: WritingPadProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [attempt, setAttempt] = useState<StrokePoint[]>([]);
  const [flash, setFlash] = useState(false);
  const pointsRef = useRef<StrokePoint[]>([]);
  const drawingRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);

  const committedIndexes = useMemo(() => new Set(committed.map((item) => item.index)), [committed]);
  const currentStroke = current < strokes.length ? strokes[current] : undefined;

  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    },
    [],
  );

  function toPoint(clientX: number, clientY: number): StrokePoint | null {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    return toViewBoxPoint(clientX, clientY, svg.getBoundingClientRect());
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (disabled || !currentStroke || event.button > 0) {
      return;
    }
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setFlash(false);
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    pointsRef.current = [];
    const point = toPoint(event.clientX, event.clientY);
    if (point) {
      pointsRef.current.push(point);
    }
    setAttempt([...pointsRef.current]);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current) {
      return;
    }
    const point = toPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.8) {
      return;
    }
    pointsRef.current.push(point);
    setAttempt([...pointsRef.current]);
  }

  function finishStroke() {
    if (!drawingRef.current) {
      return;
    }
    drawingRef.current = false;
    if (!currentStroke) {
      return;
    }
    const points = pointsRef.current;
    if (points.length < 2) {
      pointsRef.current = [];
      setAttempt([]);
      return;
    }
    const result = matchStroke(points, currentStroke);
    if (result.verdict === 'ok') {
      pointsRef.current = [];
      setAttempt([]);
      onStrokeAccepted();
      return;
    }
    onStrokeRejected(VERDICT_MESSAGES[result.verdict]);
    setFlash(true);
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      pointsRef.current = [];
      setFlash(false);
      setAttempt([]);
    }, 700);
  }

  const showFullGhost = ghostLevel === 'full';
  const showCurrentGhost = ghostLevel !== 'none';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 109 109"
      role="img"
      aria-label={`Zone de tracé du kanji ${literal}, trait ${Math.min(current + 1, strokes.length)} sur ${strokes.length}`}
      className={`aspect-square w-full touch-none select-none rounded-2xl border border-line bg-bg ${
        disabled ? '' : 'cursor-crosshair'
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    >
      <g stroke="var(--line)" strokeWidth="1" aria-hidden>
        <line x1="54.5" y1="6" x2="54.5" y2="103" strokeDasharray="3 4" />
        <line x1="6" y1="54.5" x2="103" y2="54.5" strokeDasharray="3 4" />
      </g>

      {strokes.map((stroke, index) => {
        if (committedIndexes.has(index)) {
          const entry = committed.find((item) => item.index === index);
          return (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: traits statiques, jamais réordonnés
              key={`ink-${index}`}
              d={pointsToPath(stroke.points)}
              fill="none"
              stroke={entry?.skipped ? 'var(--muted)' : 'var(--ink)'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={entry?.skipped ? 0.45 : 1}
            />
          );
        }
        const isCurrent = index === current;
        const visible = isCurrent ? showCurrentGhost : showFullGhost;
        if (!visible || disabled) {
          return null;
        }
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: traits statiques, jamais réordonnés
            key={`ghost-${index}`}
            d={pointsToPath(stroke.points)}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={isCurrent ? 0.9 : 0.4}
          />
        );
      })}

      {attempt.length > 1 ? (
        <path
          d={pointsToPath(attempt)}
          fill="none"
          stroke={flash ? 'var(--danger)' : 'var(--ink)'}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={flash ? 'animate-shake' : undefined}
        />
      ) : null}

      {!disabled && currentStroke ? (
        <StrokeCue stroke={currentStroke} number={current + 1} />
      ) : null}
    </svg>
  );
}

export function WritingPage() {
  const { literal = '' } = useParams();
  return <WritingPractice key={literal} literal={literal} />;
}

function WritingPractice({ literal }: { literal: string }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState(0);
  const [committed, setCommitted] = useState<CommittedStroke[]>([]);
  const [ghostLevel, setGhostLevel] = useState<GhostLevel>('current');
  const [missed, setMissed] = useState(0);
  const [issueOpen, setIssueOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['kanji', literal],
    queryFn: () => fetchKanjiDetail(literal),
    enabled: literal.length > 0,
  });
  const siblings = useQuery({
    queryKey: ['kanji', detail.data?.level ?? 'N5'],
    queryFn: () => fetchKanjiList(detail.data?.level ?? 'N5'),
    enabled: Boolean(detail.data),
  });

  const [svgState, setSvgState] = useState<{
    strokes: SampledStroke[];
    error: 'network' | 'empty' | null;
  }>({
    strokes: [],
    error: null,
  });
  const [loadingSvg, setLoadingSvg] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingSvg(true);
    setSvgState({ strokes: [], error: null });
    const svgUrl =
      retryKey === 0 ? kanjiSvgUrl(literal) : `${kanjiSvgUrl(literal)}?retry=${retryKey}`;
    fetch(svgUrl, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('SVG indisponible');
        }
        return response.text();
      })
      .then((svgText) => {
        if (cancelled) {
          return;
        }
        const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        const nodes = [...doc.querySelectorAll('path[id^="kvg:"][d]')].sort(
          (a, b) => strokeOrder(a.getAttribute('id')) - strokeOrder(b.getAttribute('id')),
        );
        const strokes: SampledStroke[] = [];
        for (const node of nodes) {
          const sampled = samplePath(node.getAttribute('d') ?? '');
          if (sampled) {
            strokes.push(sampled);
          }
        }
        setSvgState({ strokes, error: strokes.length === 0 ? 'empty' : null });
        setLoadingSvg(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSvgState({ strokes: [], error: 'network' });
          setLoadingSvg(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [literal, retryKey]);

  const { strokes } = svgState;
  const completed = strokes.length > 0 && current >= strokes.length;

  useEffect(() => {
    if (completed) {
      celebrate();
    }
  }, [completed]);

  const acceptStroke = useCallback(() => {
    setCommitted((previous) => [...previous, { index: current, skipped: false }]);
    setCurrent((value) => value + 1);
  }, [current]);

  const rejectStroke = useCallback(
    (message: string) => {
      setMissed((value) => value + 1);
      toast(message, 'error');
    },
    [toast],
  );

  function skipStroke() {
    if (completed) {
      return;
    }
    setCommitted((previous) => [...previous, { index: current, skipped: true }]);
    setCurrent((value) => value + 1);
  }

  function undoStroke() {
    setCommitted((previous) => previous.slice(0, -1));
    setCurrent((value) => Math.max(0, value - 1));
  }

  function restart() {
    setCurrent(0);
    setCommitted([]);
    setMissed(0);
  }

  if (detail.isPending || loadingSvg) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="aspect-square rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data || svgState.error) {
    const transient = detail.isError || svgState.error === 'network';
    return (
      <div className="mx-auto max-w-lg pt-10">
        <ErrorState
          title={transient ? 'Chargement impossible' : 'Tracé indisponible'}
          description={
            transient
              ? 'Le serveur n’a pas répondu. Vérifiez que l’API est démarrée, puis réessayez.'
              : 'Ce kanji n’a pas de tracé exploitable pour le moment.'
          }
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {transient ? (
            <Button
              variant="secondary"
              loading={detail.fetchStatus === 'fetching'}
              onClick={() => {
                void detail.refetch();
                setRetryKey((value) => value + 1);
              }}
            >
              <RotateCcw aria-hidden className="size-4" />
              Réessayer
            </Button>
          ) : null}
          <Button asChild variant={transient ? 'ghost' : 'secondary'}>
            <Link to={detail.data ? `/kanji/${detail.data.literal}` : '/kanji'}>
              <ArrowLeft aria-hidden className="size-4" />
              Retour à la fiche
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const kanji = detail.data;
  const ordered = [...(siblings.data?.kanji ?? [])].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((item) => item.literal === kanji.literal);
  const next =
    currentIndex >= 0 && currentIndex < ordered.length - 1 ? ordered[currentIndex + 1] : undefined;
  const skippedCount = committed.filter((item) => item.skipped).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/kanji/${kanji.literal}`}
          className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Fiche du kanji
        </Link>
        <Tooltip content="Signaler un problème de tracé">
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

      <div className="flex flex-wrap items-center gap-4">
        <span className="font-jp flex size-16 items-center justify-center rounded-2xl border border-line bg-surface text-4xl text-ink">
          {kanji.literal}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Pratiquer l’écriture
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <LevelBadge level={kanji.level} />
            {kanji.meanings
              .filter((m) => m.isPrimary)
              .map((m) => m.meaning)
              .join(', ') || '—'}
            <span aria-hidden>·</span>
            {strokes.length} traits
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <WritingPad
            key={current}
            literal={kanji.literal}
            strokes={strokes}
            current={current}
            committed={committed}
            ghostLevel={ghostLevel}
            onStrokeAccepted={acceptStroke}
            onStrokeRejected={rejectStroke}
            disabled={completed}
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Tooltip content="Effacer le dernier trait">
              <IconButton
                aria-label="Effacer le dernier trait"
                variant="secondary"
                onClick={undoStroke}
                disabled={committed.length === 0 || completed}
              >
                <Eraser aria-hidden className="size-4" />
              </IconButton>
            </Tooltip>
            <Tooltip content="Passer ce trait">
              <IconButton
                aria-label="Passer ce trait"
                variant="secondary"
                onClick={skipStroke}
                disabled={completed}
              >
                <SkipForward aria-hidden className="size-4" />
              </IconButton>
            </Tooltip>
            <Tooltip content="Recommencer le kanji">
              <IconButton
                aria-label="Recommencer le kanji"
                onClick={restart}
                disabled={committed.length === 0 && missed === 0}
              >
                <RotateCcw aria-hidden className="size-4" />
              </IconButton>
            </Tooltip>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <SectionHeader
              title={completed ? 'Kanji tracé !' : `Trait ${current + 1} sur ${strokes.length}`}
              icon={completed ? <CheckCircle2 /> : <PenLine />}
            />
            <div className="mt-4 flex flex-col gap-4">
              <Progress
                value={strokes.length === 0 ? 0 : committed.length / strokes.length}
                tone={completed ? 'jade' : 'accent'}
                label={`${committed.length} traits tracés sur ${strokes.length}`}
              />
              <p className="text-sm leading-relaxed text-muted">
                {completed
                  ? `Bravo ! ${kanji.literal} tracé en ${committed.length} traits${
                      missed > 0
                        ? `, ${missed} essai${missed > 1 ? 's' : ''} manqué${missed > 1 ? 's' : ''}`
                        : ''
                    }.`
                  : 'Tracez chaque trait du point numéroté vers la flèche, dans l’ordre. Le trait validé s’encre automatiquement.'}
              </p>
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Aide fantôme
                </p>
                <Segmented
                  ariaLabel="Niveau d'aide du tracé fantôme"
                  size="sm"
                  value={ghostLevel}
                  options={[
                    { value: 'full', label: 'Complète' },
                    { value: 'current', label: 'Trait courant' },
                    { value: 'none', label: 'Aucune' },
                  ]}
                  onChange={setGhostLevel}
                />
              </div>
              {skippedCount > 0 ? (
                <p className="text-xs text-muted">
                  {skippedCount} trait{skippedCount > 1 ? 's' : ''} passé
                  {skippedCount > 1 ? 's' : ''} — vous pouvez les effacer pour les retracer.
                </p>
              ) : null}
            </div>
          </Card>

          {completed ? (
            <Card>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge>{committed.length} traits</Badge>
                  {skippedCount > 0 ? <Badge>{skippedCount} passés</Badge> : null}
                  {missed > 0 ? <Badge>{missed} essais manqués</Badge> : null}
                </div>
                <div className="flex flex-col gap-2.5">
                  <Button variant="secondary" onClick={restart}>
                    <RotateCcw aria-hidden className="size-4" />
                    Retracer ce kanji
                  </Button>
                  {next ? (
                    <Button asChild>
                      <Link to={`/kanji/${next.literal}/ecriture`}>
                        Kanji suivant : {next.literal}
                        <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link to={`/kanji/${kanji.literal}`}>
                        Retour à la fiche
                        <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {completed
          ? `Kanji ${kanji.literal} tracé entièrement.`
          : `Trait ${Math.min(current + 1, strokes.length)} sur ${strokes.length}.`}
      </p>

      <IssueModal literal={kanji.literal} open={issueOpen} onOpenChange={setIssueOpen} />
    </div>
  );
}
