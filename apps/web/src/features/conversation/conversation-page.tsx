import type {
  ConversationCorrectionMode,
  ConversationDifficulty,
  ConversationLiveServerEvent,
  ConversationScenario,
  ConversationSessionDto,
  JapaneseSpeechSpeed,
  JapaneseVoice,
  JlptLevel,
} from '@kanjipath/contracts';
import { Badge, Button, Card, ErrorState, Skeleton } from '@kanjipath/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Mic, MicOff, Send, UserRound, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SaveVocabularyButton } from '../personal-vocabulary/save-vocabulary-button';
import {
  createConversation,
  endConversation,
  fetchConversationSettings,
  fetchConversationTopics,
  fetchJapaneseVoices,
  fetchLocalAiHealth,
  sendConversationTurn,
} from './api';
import { CorrectionCard } from './correction-card';

const LEVELS: JlptLevel[] = ['N5', 'N4'];
const DIFFICULTIES: { value: ConversationDifficulty; label: string }[] = [
  { value: 'easy', label: 'Accessible' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Soutenu' },
];
const CORRECTIONS: { value: ConversationCorrectionMode; label: string }[] = [
  { value: 'none', label: 'Aucune' },
  { value: 'important', label: 'Importantes' },
  { value: 'all', label: 'Toutes' },
  { value: 'end_of_turn', label: 'Fin du tour' },
  { value: 'end_of_session', label: 'Fin de session' },
];

const VOICE_NAMES: Record<string, string> = {
  四国めたん: 'Shikoku Metan',
  ずんだもん: 'Zundamon',
  春日部つむぎ: 'Kasukabe Tsumugi',
  雨晴はう: 'Amehare Hau',
  波音リツ: 'Namine Ritsu',
  玄野武宏: 'Kurono Takehiro',
  白上虎太郎: 'Shirakami Kotaro',
  青山龍星: 'Aoyama Ryusei',
  冥鳴ひまり: 'Meimei Himari',
  九州そら: 'Kyushu Sora',
  もち子さん: 'Mochiko',
  剣崎雌雄: 'Kenzaki Mesuo',
  後鬼: 'Goki',
  ちび式じい: 'Chibishiki Jii',
  櫻歌ミコ: 'Ouka Miko',
  '小夜/SAYO': 'Sayo',
  ナースロボ＿タイプＴ: 'Nurse Robo Type T',
  '†聖騎士 紅桜†': 'Holy Knight Benizakura',
  雀松朱司: 'Suzumatsu Akashi',
  麒ヶ島宗麟: 'Kigashima Sorin',
  春歌ナナ: 'Haruka Nana',
  猫使アル: 'Nekotsukai Aru',
  猫使ビィ: 'Nekotsukai Bii',
  中国うさぎ: 'Chugoku Usagi',
  栗田まろん: 'Kurita Maron',
  あいえるたん: 'Aierutan',
  満別花丸: 'Mitsubetsu Hanamaru',
  琴詠ニア: 'Kotoyomi Nia',
  ぞん子: 'Zonko',
  中部つるぎ: 'Chubu Tsurugi',
  離途: 'Rito',
  黒沢冴白: 'Kurosawa Sae',
  ユーレイちゃん: 'Yurei-chan',
  東北ずん子: 'Tohoku Zunko',
  東北きりたん: 'Tohoku Kiritan',
  東北イタコ: 'Tohoku Itako',
  あんこもん: 'Ankomon',
  夜語トバリ: 'Yogata Tobari',
  暁記ミタマ: 'Akatsuki Mitama',
  里石ユカ: 'Satoishi Yuka',
};

const VOICE_STYLES: Record<string, string> = {
  ノーマル: 'Normal',
  ふつう: 'Standard',
  あまあま: 'Doux',
  甘々: 'Très doux',
  ツンツン: 'Sec',
  ツンギレ: 'Brusque',
  セクシー: 'Grave',
  ささやき: 'Chuchoté',
  囁き: 'Chuchoté',
  ヒソヒソ: 'Très discret',
  喜び: 'Joyeux',
  たのしい: 'Joyeux',
  悲しみ: 'Triste',
  かなしみ: 'Triste',
  かなしい: 'Triste',
  哀しみ: 'Triste',
  怒り: 'En colère',
  おこ: 'En colère',
  熱血: 'Énergique',
  しっとり: 'Posé',
  おちつき: 'Calme',
  うきうき: 'Enjoué',
  なみだめ: 'Larmoyant',
  泣き: 'En pleurs',
  こわがり: 'Craintif',
  恐怖: 'Effrayé',
  おどろき: 'Surpris',
  おどおど: 'Hésitant',
  のんびり: 'Détendu',
  アナウンス: 'Annonce',
  読み聞かせ: 'Lecture',
};

interface Recorder {
  stop(): void;
}

export function ConversationPage() {
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [scenario, setScenario] = useState<ConversationScenario>('free');
  const [goal, setGoal] = useState('');
  const [difficulty, setDifficulty] = useState<ConversationDifficulty>('easy');
  const [correctionMode, setCorrectionMode] = useState<ConversationCorrectionMode>('important');
  const [speed, setSpeed] = useState<JapaneseSpeechSpeed>('normal');
  const [speakerId, setSpeakerId] = useState<number | null>(null);
  const [session, setSession] = useState<ConversationSessionDto | null>(null);
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceAwaitingFinal, setVoiceAwaitingFinal] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<Recorder | null>(null);

  const settings = useQuery({
    queryKey: ['conversation', 'settings'],
    queryFn: fetchConversationSettings,
  });
  const topics = useQuery({
    queryKey: ['conversation', 'topics'],
    queryFn: fetchConversationTopics,
  });
  const health = useQuery({
    queryKey: ['conversation', 'health'],
    queryFn: fetchLocalAiHealth,
    refetchInterval: 30_000,
  });
  const voices = useQuery({ queryKey: ['conversation', 'voices'], queryFn: fetchJapaneseVoices });

  useEffect(() => {
    if (!settings.data) return;
    setLevel(settings.data.defaultLevel);
    setDifficulty(settings.data.defaultDifficulty);
    setCorrectionMode(settings.data.defaultCorrectionMode);
  }, [settings.data]);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      socketRef.current?.close();
    },
    [],
  );

  const create = useMutation({
    mutationFn: createConversation,
    onSuccess: (created) => {
      setSession(created);
      setTranscript('');
      setPartial('');
      setLiveError(null);
      setVoiceProcessing(false);
      setVoiceAwaitingFinal(false);
      setPendingTranscript(null);
      setGoal('');
    },
  });

  const turn = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      sendConversationTurn(id, { transcript: text, requestAudio: true }),
    onSuccess: (result) => {
      setSession((current) =>
        current ? { ...current, turns: [...current.turns, result.turn] } : current,
      );
      setTranscript('');
      setPendingTranscript(null);
      if (result.audio) playAudio(result.audio.mimeType, result.audio.base64);
    },
    onError: () => setPendingTranscript(null),
  });

  const end = useMutation({
    mutationFn: endConversation,
    onSuccess: () => {
      setSession(null);
    },
  });

  if (settings.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (settings.isError) {
    return <ErrorState title="Conversation indisponible" onRetry={() => void settings.refetch()} />;
  }

  const voiceReady = health.data?.stt.available ?? false;
  const modelReady = health.data?.ollama.available ?? false;
  const ttsReady = health.data?.japaneseTts.available ?? false;
  const isProcessing = turn.isPending || voiceProcessing;

  function startLive(): void {
    if (!session || !voiceReady || isRecording) return;
    setLiveError(null);
    setMicrophoneLevel(0);
    setVoiceProcessing(false);
    setVoiceAwaitingFinal(false);
    setPendingTranscript(null);
    const socket = new WebSocket(liveUrl(session.id));
    socketRef.current = socket;
    socket.addEventListener('message', (event) => handleLiveEvent(event.data));
    socket.addEventListener('error', () => {
      setLiveError('La liaison vocale est indisponible. Utilisez le mode texte.');
      setVoiceProcessing(false);
      setVoiceAwaitingFinal(false);
      setPendingTranscript(null);
    });
    socket.addEventListener('open', () => {
      void startRecorder(socket, setMicrophoneLevel)
        .then((recorder) => {
          recorderRef.current = recorder;
          setIsRecording(true);
        })
        .catch(() => setLiveError('Le microphone est indisponible. Vérifiez son autorisation.'));
    });
  }

  function stopLive(): void {
    setVoiceProcessing(true);
    setVoiceAwaitingFinal(true);
    setPendingTranscript(partial);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    setMicrophoneLevel(0);
    socketRef.current?.send(JSON.stringify({ type: 'turn.complete' }));
  }

  function handleLiveEvent(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let event: ConversationLiveServerEvent;
    try {
      event = JSON.parse(raw) as ConversationLiveServerEvent;
    } catch {
      return;
    }
    if (event.type === 'stt.partial') {
      setPartial(event.transcript);
    }
    if (event.type === 'stt.final') {
      setPartial('');
      setTranscript(event.transcript);
      setVoiceAwaitingFinal(false);
      setPendingTranscript(event.transcript);
    }
    if (event.type === 'assistant.text') {
      setSession((current) =>
        current ? { ...current, turns: [...current.turns, event.turn] } : current,
      );
      setTranscript('');
      setVoiceProcessing(false);
      setVoiceAwaitingFinal(false);
      setPendingTranscript(null);
    }
    if (event.type === 'assistant.audio') playAudio(event.audio.mimeType, event.audio.base64);
    if (event.type === 'error') {
      setLiveError(event.message);
      setVoiceProcessing(false);
      setVoiceAwaitingFinal(false);
      setPendingTranscript(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-bold tracking-widest text-accent">会話 · CONVERSATION LOCALE</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Parler japonais, à votre rythme
        </h1>
        <p className="max-w-2xl text-ink-soft">
          Les échanges restent sur votre poste. Le clavier fonctionne même si les services vocaux
          locaux sont arrêtés.
        </p>
      </header>

      <div role="status" className="flex flex-wrap gap-2" aria-label="État des services locaux">
        <Badge tone={modelReady ? 'success' : 'neutral'}>
          LLM {modelReady ? 'prêt' : 'indisponible'}
        </Badge>
        <Badge tone={voiceReady ? 'success' : 'neutral'}>
          STT {voiceReady ? 'prêt' : 'indisponible'}
        </Badge>
        <Badge tone={ttsReady ? 'success' : 'neutral'}>
          Voix {ttsReady ? 'prête' : 'texte seul'}
        </Badge>
      </div>

      {!session ? (
        <Card className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Niveau">
              <select
                aria-label="Niveau"
                value={level}
                onChange={(event) => setLevel(event.target.value as JlptLevel)}
                className={selectClass}
              >
                {LEVELS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Difficulté">
              <select
                aria-label="Difficulté"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as ConversationDifficulty)}
                className={selectClass}
              >
                {DIFFICULTIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Situation">
              <select
                aria-label="Situation"
                value={scenario}
                onChange={(event) => setScenario(event.target.value as ConversationScenario)}
                className={selectClass}
              >
                {(topics.data?.topics ?? [{ id: 'free', label: 'Libre' }]).map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Corrections">
              <select
                aria-label="Corrections"
                value={correctionMode}
                onChange={(event) =>
                  setCorrectionMode(event.target.value as ConversationCorrectionMode)
                }
                className={selectClass}
              >
                {CORRECTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Voix japonaise">
              <select
                aria-label="Voix japonaise"
                value={speakerId ?? ''}
                onChange={(event) => setSpeakerId(Number(event.target.value) || null)}
                className={selectClass}
                disabled={voices.isPending || voices.data?.voices.length === 0}
              >
                <option value="">Voix par défaut</option>
                {voices.data?.voices.flatMap(voiceOptions).map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vitesse japonaise">
              <select
                aria-label="Vitesse japonaise"
                value={speed}
                onChange={(event) => setSpeed(event.target.value as JapaneseSpeechSpeed)}
                className={selectClass}
              >
                <option value="slow">Lente</option>
                <option value="normal">Normale</option>
                <option value="natural">Naturelle</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Situation ou objectif (facultatif)">
                <input
                  aria-label="Situation ou objectif"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  maxLength={160}
                  className={selectClass}
                  placeholder="Ex. au restaurant, pratiquer 〜ている naturellement"
                />
              </Field>
            </div>
          </div>
          <Button
            size="lg"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                level,
                scenario,
                difficulty,
                correctionMode,
                japaneseSpeechSpeed: speed,
                japaneseSpeakerId: speakerId ?? undefined,
                goals: goal.trim() ? [goal.trim()] : undefined,
              })
            }
          >
            Commencer la conversation
          </Button>
          {create.isError ? (
            <p className="text-sm text-danger">Impossible de créer la conversation.</p>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="font-semibold text-ink">
              {session.level} ·{' '}
              {session.goals[0] ??
                topics.data?.topics.find((topic) => topic.id === session.scenario)?.label ??
                'Conversation libre'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={end.isPending}
              onClick={() => end.mutate(session.id)}
            >
              Terminer
            </Button>
          </Card>
          <Card className="min-h-72 p-3 sm:p-5" aria-live="polite">
            {session.turns.length === 0 && pendingTranscript === null ? (
              <div className="flex min-h-64 items-center justify-center p-5 text-center text-ink-soft">
                Écrivez ou dites votre première phrase en japonais.
              </div>
            ) : null}
            <div className="space-y-5">
              {session.turns.map((item) => (
                <div key={item.id} className="space-y-3">
                  <div className="flex justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-white shadow-1">
                      <p className="mb-1 flex items-center justify-end gap-1.5 text-xs font-bold tracking-wide text-white/75">
                        Vous <UserRound aria-hidden className="size-3.5" />
                      </p>
                      <p>{item.transcript}</p>
                      <div className="mt-3 flex justify-end">
                        <SaveVocabularyButton
                          source={{ origin: 'conversation', conversationTurnId: item.id }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Bot aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-surface-2 px-4 py-3 shadow-1">
                      <p className="mb-1 text-xs font-bold tracking-wide text-muted">PARTENAIRE</p>
                      <p className="font-jp text-lg leading-relaxed text-ink">{item.reply.ja}</p>
                      <p className="mt-1 text-sm text-muted">{item.reply.reading}</p>
                    </div>
                  </div>
                  <CorrectionCard correction={item.correction} mode={session.correctionMode} />
                </div>
              ))}
              {pendingTranscript !== null ? (
                <div className="flex justify-end gap-2">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md border border-dashed border-accent/40 bg-accent-soft px-4 py-3 text-ink-soft shadow-1">
                    <p className="mb-1 flex items-center justify-end gap-1.5 text-xs font-bold tracking-wide text-accent">
                      Vous <UserRound aria-hidden className="size-3.5" />
                    </p>
                    <p>{pendingTranscript || 'Transcription en cours…'}</p>
                  </div>
                </div>
              ) : null}
              {isProcessing ? (
                <div className="flex items-start gap-2" role="status" aria-live="polite">
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Bot aria-hidden className="size-4" />
                  </span>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-line bg-surface-2 px-4 py-3 text-sm text-muted shadow-1">
                    <span className="size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    {voiceAwaitingFinal
                      ? 'Transcription en cours…'
                      : 'Le partenaire prépare sa réponse…'}
                  </div>
                </div>
              ) : null}
              {partial ? (
                <div className="flex justify-end gap-2">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md border border-dashed border-accent/40 bg-accent-soft px-4 py-3 text-sm italic text-ink-soft">
                    <p className="mb-1 text-xs font-bold not-italic tracking-wide text-accent">
                      TRANSCRIPTION EN COURS
                    </p>
                    {partial}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
          <Card className="space-y-3 p-4">
            <label className="sr-only" htmlFor="conversation-text">
              Votre phrase en japonais
            </label>
            <textarea
              id="conversation-text"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-xl border border-line bg-bg p-3 text-ink outline-none focus:border-accent"
              placeholder="日本語で書いてください…"
              disabled={isProcessing || isRecording}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!transcript.trim() || isProcessing || isRecording}
                onClick={() => {
                  const text = transcript.trim();
                  setPendingTranscript(text);
                  turn.mutate({ id: session.id, text });
                }}
              >
                <Send aria-hidden className="size-4" /> Envoyer
              </Button>
              <Button
                variant="secondary"
                disabled={!voiceReady || turn.isPending || (voiceProcessing && !isRecording)}
                onClick={isRecording ? stopLive : startLive}
              >
                {isRecording ? (
                  <MicOff aria-hidden className="size-4" />
                ) : (
                  <Mic aria-hidden className="size-4" />
                )}{' '}
                {isRecording ? 'Terminer la prise' : 'Parler'}
              </Button>
              {ttsReady ? <Volume2 aria-hidden className="size-4 text-muted" /> : null}
            </div>
            {isRecording ? (
              <div
                className="rounded-xl border border-accent/30 bg-accent-soft px-3 py-2"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">
                    {microphoneLevel >= 0.03 ? 'Voix détectée' : 'Microphone actif, parlez…'}
                  </span>
                  <span className="text-xs text-muted">
                    Niveau {Math.round(microphoneLevel * 100)} %
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/70"
                  aria-label={`Niveau du microphone : ${Math.round(microphoneLevel * 100)} %`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(microphoneLevel * 100)}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-100"
                    style={{ width: `${Math.max(2, microphoneLevel * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Cet indicateur confirme la capture par le navigateur, pas encore la transcription.
                </p>
              </div>
            ) : null}
            {liveError ? <p className="text-sm text-danger">{liveError}</p> : null}
            {turn.isError ? (
              <p className="text-sm text-danger">
                Le message n’a pas pu être traité. Le mode texte reste disponible dès que le moteur
                répond.
              </p>
            ) : null}
          </Card>
        </>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
    </div>
  );
}

const selectClass =
  'h-10 rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-accent';

function liveUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/v1/conversations/${sessionId}/live`;
}

async function startRecorder(
  socket: WebSocket,
  onLevel: (level: number) => void,
): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (event) => {
    const samples = event.inputBuffer.getChannelData(0);
    onLevel(microphoneInputLevel(samples));
    if (socket.readyState !== WebSocket.OPEN) return;
    const pcm = downsample(samples, context.sampleRate, 16_000);
    socket.send(
      JSON.stringify({ type: 'audio.chunk', encoding: 'pcm_s16le', data: toBase64(pcm) }),
    );
  };
  source.connect(processor);
  processor.connect(context.destination);
  return {
    stop() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      void context.close();
    },
  };
}

export function microphoneInputLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (const sample of samples) total += sample * sample;
  return Math.min(1, Math.sqrt(total / samples.length) * 8);
}

function downsample(input: Float32Array, sourceRate: number, targetRate: number): Int16Array {
  const ratio = sourceRate / targetRate;
  const output = new Int16Array(Math.round(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const sample = input[Math.floor(index * ratio)] ?? 0;
    output[index] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
  }
  return output;
}

function toBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function playAudio(mimeType: string, base64: string): void {
  const audio = new Audio(`data:${mimeType};base64,${base64}`);
  void audio.play().catch(() => undefined);
}

export function voiceDisplayName(name: string, styleId: number): string {
  return VOICE_NAMES[name] ?? `Voix ${styleId}`;
}

export function voiceStyleDisplayName(name: string, styleId: number): string {
  return VOICE_STYLES[name] ?? `Style ${styleId}`;
}

function voiceOptions(voice: JapaneseVoice): { id: number; label: string }[] {
  return voice.styles.map((style) => ({
    id: style.id,
    label: `${voiceDisplayName(voice.name, style.id)} · ${voiceStyleDisplayName(style.name, style.id)}`,
  }));
}
