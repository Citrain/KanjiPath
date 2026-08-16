import type {
  JapaneseSpeechSpeed,
  JlptLevel,
  ShadowingComparisonResponse,
  ShadowingSource,
  ShadowingTargetDto,
} from '@kanjipath/contracts';
import { Badge, Button, Card, ErrorState, PageHeader, Segmented, Skeleton } from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ear, Mic, RotateCcw, Save, Square, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../../lib/api';
import { type MemoryRecorderHandle, playBase64Audio, startMemoryRecorder } from '../../lib/audio';
import { fetchLocalAiHealth } from '../conversation/api';
import {
  clearShadowingResults,
  compareShadowing,
  deleteShadowingResult,
  fetchShadowingResults,
  fetchShadowingTargets,
  fetchShadowingTtsAudio,
  saveShadowingResult,
  transcribeShadowing,
} from './api';
import {
  emptyTranscriptLabel,
  repeatEncouragementLabel,
  SHADOWING_DISCLAIMER,
  SHADOWING_PRACTICE_NOTE,
  savedResultLabel,
  segmentStatusLabel,
  segmentStatusShort,
  sttUnavailableLabel,
} from './shadowing-labels';

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SPEEDS: { value: JapaneseSpeechSpeed; label: string }[] = [
  { value: 'slow', label: 'Lente' },
  { value: 'normal', label: 'Normale' },
  { value: 'natural', label: 'Naturelle' },
];
const MAX_RECORDING_MS = 20_000;

type Phase = 'idle' | 'recording' | 'processing' | 'result';

export function ShadowingPage() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [source, setSource] = useState<ShadowingSource>('audio');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [speed, setSpeed] = useState<JapaneseSpeechSpeed>('normal');
  const [phase, setPhase] = useState<Phase>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ShadowingComparisonResponse | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const recorderRef = useRef<MemoryRecorderHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipPlayerRef = useRef<HTMLAudioElement | null>(null);

  const health = useQuery({ queryKey: ['local-ai', 'health'], queryFn: fetchLocalAiHealth });
  const targets = useQuery({
    queryKey: ['shadowing', 'targets', level, source],
    queryFn: () => fetchShadowingTargets({ level, source }),
  });
  const results = useQuery({ queryKey: ['shadowing', 'results'], queryFn: fetchShadowingResults });

  const sttAvailable = health.data?.stt.available ?? false;
  const ttsAvailable = health.data?.japaneseTts.available ?? false;
  const list = targets.data?.targets ?? [];
  const selected = list.find((target) => target.id === selectedId) ?? list[0] ?? null;

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: réinitialisation volontaire du laboratoire quand la cible, la source ou le niveau changent
  useEffect(() => {
    setPhase('idle');
    setTranscript(null);
    setComparison(null);
    setPracticeError(null);
    setSavedMessage(null);
    setElapsedMs(0);
    recorderRef.current?.cancel();
    recorderRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (clipPlayerRef.current) {
      clipPlayerRef.current.pause();
      clipPlayerRef.current = null;
    }
  }, [selectedId, source, level]);

  const ttsAudio = useMutation({
    mutationFn: (target: ShadowingTargetDto) => fetchShadowingTtsAudio(target.id, speed),
    onSuccess: (audio) => playBase64Audio(audio.mimeType, audio.base64),
    onError: (error) => setPracticeError(shadowingErrorMessage(error, 'Écoute impossible.')),
  });

  const save = useMutation({
    mutationFn: saveShadowingResult,
    onSuccess: () => {
      setSavedMessage(savedResultLabel());
      void queryClient.invalidateQueries({ queryKey: ['shadowing', 'results'] });
    },
    onError: (error) =>
      setPracticeError(shadowingErrorMessage(error, 'Le résultat n’a pas pu être conservé.')),
  });

  const removeResult = useMutation({
    mutationFn: deleteShadowingResult,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shadowing', 'results'] }),
  });

  const clearResults = useMutation({
    mutationFn: clearShadowingResults,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shadowing', 'results'] }),
  });

  function listenToTarget(target: ShadowingTargetDto) {
    setPracticeError(null);
    if (source === 'audio' && target.audio) {
      const element = clipPlayerRef.current ?? new Audio(`/api/v1${target.audio.url}`);
      clipPlayerRef.current = element;
      element.onerror = () => setPracticeError('Lecture du clip audio impossible.');
      void element.play().catch(() => setPracticeError('Lecture du clip audio impossible.'));
      return;
    }
    ttsAudio.mutate(target);
  }

  async function startRecording() {
    if (!selected) return;
    setPracticeError(null);
    setSavedMessage(null);
    try {
      recorderRef.current = await startMemoryRecorder({
        maxDurationMs: MAX_RECORDING_MS,
        onLevel: setMicLevel,
        onLimitReached: () => finalizeRecording(),
      });
      setPhase('recording');
      setElapsedMs(0);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Math.min(MAX_RECORDING_MS, Date.now() - startedAt));
      }, 200);
    } catch {
      setPracticeError(
        'Le micro est indisponible. Autorisez l’accès au microphone puis réessayez.',
      );
    }
  }

  function finalizeRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setMicLevel(0);
    const recording = recorder?.stop() ?? null;
    if (!recording || !selected) {
      setPhase('idle');
      return;
    }
    void submitRecording(selected.id, recording.base64, recording.durationMs);
  }

  async function submitRecording(sentenceId: string, audioBase64: string, durationMs: number) {
    setPhase('processing');
    try {
      const transcribed = await transcribeShadowing({ audioBase64, durationMs });
      const clean = transcribed.transcript.trim();
      if (clean.length === 0) {
        setTranscript('');
        setComparison(null);
        setPhase('result');
        return;
      }
      const compared = await compareShadowing({ sentenceId, transcript: clean });
      setTranscript(clean);
      setComparison(compared);
      setPhase('result');
    } catch (error) {
      setPhase('idle');
      setPracticeError(
        shadowingErrorMessage(
          error,
          'La transcription a échoué. Réessayez — aucun résultat n’a été produit.',
        ),
      );
    }
  }

  function resetPractice() {
    setPhase('idle');
    setTranscript(null);
    setComparison(null);
    setPracticeError(null);
    setSavedMessage(null);
    setElapsedMs(0);
  }

  const differsSegments =
    comparison?.segments.filter((segment) => segment.status === 'differs') ?? [];

  return (
    <section className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Laboratoire oral"
        title="Shadowing"
        description="Écoutez une phrase, répétez-la, puis comparez la transcription locale de votre voix à la lecture cible. Aucun effet sur vos cartes, scores ou progression."
      />
      <p className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-soft">
        {SHADOWING_PRACTICE_NOTE}
      </p>

      {health.data && !sttAvailable ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm leading-relaxed text-ink-soft"
        >
          {sttUnavailableLabel(health.data.stt.detail ?? 'Le service STT local est arrêté.')}
        </p>
      ) : null}
      {health.data && source === 'tts' && !ttsAvailable ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm leading-relaxed text-ink-soft"
        >
          La voix locale (TTS) est indisponible. Choisissez la source « Audio publié » pour
          continuer à écouter les phrases.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink">Choisir une phrase</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Segmented
                ariaLabel="Niveau des phrases"
                size="sm"
                value={level}
                onChange={setLevel}
                options={LEVELS.map((entry) => ({ value: entry, label: entry }))}
              />
              <Segmented
                ariaLabel="Source audio"
                value={source}
                onChange={setSource}
                options={[
                  { value: 'audio', label: 'Audio publié' },
                  { value: 'tts', label: 'Voix locale (TTS)' },
                ]}
              />
            </div>
            <div
              className="mt-4 flex flex-col gap-2.5"
              role="radiogroup"
              aria-label="Phrases cibles"
            >
              {targets.isPending ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : targets.isError ? (
                <ErrorState title="Phrases introuvables" onRetry={() => void targets.refetch()} />
              ) : list.length === 0 ? (
                <p className="rounded-xl border border-line bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                  Aucune phrase disponible pour ce niveau.
                </p>
              ) : (
                list.map((target) => {
                  const active = selected?.id === target.id;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: bouton stylé en radio (role + aria-checked) au sein du radiogroup des phrases cibles
                    <button
                      key={target.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedId(target.id)}
                      className={`min-h-12 cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface-2 hover:border-line-strong'
                      }`}
                    >
                      <span className="font-jp block text-lg font-semibold leading-snug text-ink">
                        {target.japanese}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted">
                        {target.translationFr}
                      </span>
                      {target.audio ? (
                        <span className="mt-1 block truncate text-xs text-muted">
                          Voix : {target.audio.attribution} · {target.audio.license}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="mt-6 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Résultats conservés</h2>
              {results.data && results.data.results.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={clearResults.isPending}
                  onClick={() => clearResults.mutate()}
                >
                  <Trash2 aria-hidden className="size-4" /> Tout supprimer
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Seuls les résultats que vous choisissez explicitement de conserver sont enregistrés.
              Jamais l’audio ni les transcriptions intermédiaires.
            </p>
            {results.isPending ? (
              <Skeleton className="mt-4 h-16 w-full" />
            ) : !results.data || results.data.results.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                Aucun résultat conservé pour l’instant.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {results.data.results.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-line bg-surface-2 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-jp truncate font-semibold text-ink">{entry.japanese}</p>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          Transcription : {entry.transcript}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {new Date(entry.createdAt).toLocaleString('fr-FR')} ·{' '}
                          {entry.matched
                            ? 'Correspondance complète avec la lecture cible'
                            : `Correspondance sur ${entry.matchedSegments}/${entry.totalSegments} segments`}
                        </p>
                        {entry.attribution ? (
                          <p className="mt-1 truncate text-xs text-muted">
                            {entry.attribution}
                            {entry.license ? ` · ${entry.license}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label="Supprimer ce résultat"
                        disabled={removeResult.isPending}
                        onClick={() => removeResult.mutate(entry.id)}
                        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5 sm:p-7">
          {!selected ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
              Choisissez une phrase pour commencer.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{selected.level}</Badge>
                <Badge tone={source === 'audio' ? 'info' : 'violet'}>
                  {source === 'audio' ? 'Audio publié' : 'Voix locale (TTS)'}
                </Badge>
              </div>
              <p className="font-jp mt-4 text-2xl font-bold leading-snug text-ink sm:text-3xl">
                {selected.japanese}
              </p>
              <p className="font-jp mt-2 text-base leading-relaxed text-muted">
                {selected.reading}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{selected.translationFr}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {selected.author ? `Phrase : ${selected.author}` : 'Phrase publiée'}
                {selected.sentenceLicense ? ` · ${selected.sentenceLicense}` : ''}
                {source === 'audio' && selected.audio
                  ? ` — Voix : ${selected.audio.attribution} · ${selected.audio.license}`
                  : ''}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="lg"
                  loading={ttsAudio.isPending}
                  onClick={() => listenToTarget(selected)}
                >
                  <Volume2 aria-hidden className="size-5" /> Écouter
                </Button>
                {phase === 'recording' ? (
                  <Button variant="danger" size="lg" onClick={finalizeRecording}>
                    <Square aria-hidden className="size-5" /> Arrêter
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    disabled={!sttAvailable || phase === 'processing'}
                    onClick={() => void startRecording()}
                  >
                    <Mic aria-hidden className="size-5" />
                    {phase === 'processing' ? 'Transcription…' : 'S’enregistrer'}
                  </Button>
                )}
                {source === 'tts' ? (
                  <Segmented
                    ariaLabel="Vitesse de la voix locale"
                    size="sm"
                    value={speed}
                    onChange={setSpeed}
                    options={SPEEDS.map((entry) => ({ value: entry.value, label: entry.label }))}
                  />
                ) : null}
              </div>
              {!sttAvailable ? (
                <p className="mt-3 text-sm text-muted">
                  Enregistrement désactivé : le service de transcription local est indisponible.
                </p>
              ) : null}
              {phase === 'recording' ? (
                <div className="mt-4" role="status" aria-label="Enregistrement en cours">
                  <div className="flex items-center justify-between text-sm font-semibold text-ink">
                    <span>Enregistrement en cours…</span>
                    <span className="tabular-nums">{(elapsedMs / 1000).toFixed(1)} s / 20 s</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-150"
                      style={{ width: `${Math.round(micLevel * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Niveau du micro (capture locale uniquement).
                  </p>
                </div>
              ) : null}

              {practiceError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
                >
                  {practiceError}
                </p>
              ) : null}
              {savedMessage ? (
                <p
                  role="status"
                  className="mt-4 rounded-xl border border-jade/25 bg-jade-soft px-4 py-3 text-sm text-jade"
                >
                  {savedMessage}
                </p>
              ) : null}

              <div aria-live="polite">
                {phase === 'result' && transcript !== null ? (
                  <div className="mt-6 border-t border-line pt-5">
                    <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                      <Ear aria-hidden className="size-4.5 text-accent" /> Transcription finale
                    </h3>
                    {transcript.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-soft">
                        {emptyTranscriptLabel()}
                      </p>
                    ) : (
                      <>
                        <p className="font-jp mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-lg leading-relaxed text-ink">
                          {transcript}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-muted">
                          {SHADOWING_DISCLAIMER}
                        </p>
                        {comparison ? (
                          <>
                            <ul
                              className="mt-4 flex flex-wrap gap-2"
                              aria-label="Correspondance par segment"
                            >
                              {comparison.segments.map((segment) => (
                                <li
                                  key={`${segment.surface}-${segment.reading}`}
                                  className={`rounded-xl border px-3 py-2 ${
                                    segment.status === 'matched'
                                      ? 'border-jade/25 bg-jade-soft'
                                      : 'border-gold/30 bg-gold-soft'
                                  }`}
                                >
                                  <span className="font-jp block text-base font-semibold text-ink">
                                    {segment.surface}
                                  </span>
                                  <span className="font-jp block text-sm text-muted">
                                    {segment.reading}
                                    {segment.romaji ? ` · ${segment.romaji}` : ''}
                                  </span>
                                  <Badge
                                    className="mt-1.5"
                                    tone={segment.status === 'matched' ? 'success' : 'warning'}
                                  >
                                    {segmentStatusShort(segment.status)}
                                  </Badge>
                                  <span className="sr-only">
                                    {segmentStatusLabel(segment.status)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {differsSegments.length > 0 ? (
                              <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3">
                                <p className="text-sm font-bold text-ink">
                                  Segments à réécouter :{' '}
                                  <span className="font-jp font-semibold">
                                    {differsSegments.map((segment) => segment.surface).join('、')}
                                  </span>
                                </p>
                                <Button
                                  className="mt-2.5"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => listenToTarget(selected)}
                                >
                                  <Volume2 aria-hidden className="size-4" /> Réécouter la phrase
                                </Button>
                              </div>
                            ) : null}
                            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                              {repeatEncouragementLabel(comparison.matched)}
                            </p>
                          </>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-2.5">
                          <Button variant="secondary" size="lg" onClick={resetPractice}>
                            <RotateCcw aria-hidden className="size-5" /> Réessayer
                          </Button>
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={save.isPending}
                            disabled={savedMessage !== null}
                            onClick={() =>
                              save.mutate({ sentenceId: selected.id, source, transcript })
                            }
                          >
                            <Save aria-hidden className="size-5" /> Conserver ce résultat
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function shadowingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const payload = error.payload as { code?: unknown; message?: unknown } | null;
    if (payload && typeof payload.message === 'string') return payload.message;
  }
  return fallback;
}
