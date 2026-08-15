import type {
  PersonalVocabularyAnswerResult,
  PersonalVocabularyEntryDto,
  PersonalVocabularySessionResponse,
  Rating,
} from '@kanjipath/contracts';
import { Badge, Button, Card, Modal, Skeleton } from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowRight, BookOpenCheck, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  answerPersonalVocabulary,
  archivePersonalVocabulary,
  createPersonalVocabularySession,
  deletePersonalVocabulary,
  fetchPersonalVocabulary,
  finishPersonalVocabularySession,
  restorePersonalVocabulary,
  resumePersonalVocabularySession,
} from './api';

const RATING_LABELS: Record<Rating, string> = {
  again: 'À revoir',
  hard: 'Difficile',
  good: 'Acquis',
  easy: 'Facile',
};

export function PersonalVocabularyPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PersonalVocabularyEntryDto | null>(null);
  const entries = useQuery({
    queryKey: ['personal-vocabulary', showArchived],
    queryFn: () => fetchPersonalVocabulary(showArchived),
  });
  const resume = useQuery({
    queryKey: ['personal-vocabulary', 'session'],
    queryFn: resumePersonalVocabularySession,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['personal-vocabulary'] });
  };
  const start = useMutation({ mutationFn: createPersonalVocabularySession, onSuccess: refresh });
  const archive = useMutation({ mutationFn: archivePersonalVocabulary, onSuccess: refresh });
  const restore = useMutation({ mutationFn: restorePersonalVocabulary, onSuccess: refresh });
  const remove = useMutation({
    mutationFn: deletePersonalVocabulary,
    onSuccess: () => {
      setDeleteTarget(null);
      refresh();
    },
  });

  if (resume.data?.session) {
    return <PersonalVocabularyReview response={resume.data} onFinished={refresh} />;
  }
  if (entries.isPending || resume.isPending)
    return <Skeleton className="mx-auto h-96 max-w-4xl rounded-3xl" />;
  if (entries.isError || !entries.data) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">Impossible de charger le carnet.</Card>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Vocabulaire personnel
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Mon carnet
          </h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Vos mots rencontrés, leurs contextes et leurs révisions FSRS restent séparés du parcours
            kanji.
          </p>
        </div>
        <Button
          loading={start.isPending}
          disabled={entries.data.dueCount === 0}
          onClick={() => start.mutate()}
        >
          <BookOpenCheck aria-hidden className="size-4" /> Réviser {entries.data.dueCount || ''}
        </Button>
      </header>
      <div className="flex gap-2">
        <Button
          variant={showArchived ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setShowArchived(false)}
        >
          Actifs
        </Button>
        <Button
          variant={showArchived ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowArchived(true)}
        >
          Archives
        </Button>
      </div>
      {entries.data.entries.length === 0 ? (
        <Card className="p-10 text-center text-ink-soft">
          {showArchived
            ? 'Aucun mot archivé.'
            : 'Enregistrez un mot depuis la lecture, le lookup ou une conversation.'}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.data.entries.map((entry) => (
            <Card key={entry.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-jp text-3xl font-bold text-ink">{entry.surface}</p>
                  {entry.reading ? (
                    <p className="mt-1 font-jp text-lg text-muted">{entry.reading}</p>
                  ) : null}
                  {entry.meaningFr ? (
                    <p className="mt-1 text-sm text-ink-soft">{entry.meaningFr}</p>
                  ) : null}
                </div>
                <Badge tone={entry.source.origin === 'conversation' ? 'info' : 'neutral'}>
                  {entry.source.origin === 'conversation'
                    ? 'conversation privée'
                    : 'contenu publié'}
                </Badge>
              </div>
              {entry.excerpt ? (
                <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">
                  {entry.excerpt}
                </p>
              ) : null}
              {entry.source.origin !== 'conversation' ? (
                <p className="text-xs leading-relaxed text-muted">
                  {[
                    entry.source.sourceName,
                    entry.source.sourceVersion,
                    entry.source.contentVersion,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {entry.source.attributionText ? ` · ${entry.source.attributionText}` : ''}
                  {entry.source.license ? ` · ${entry.source.license}` : ''}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {entry.cards.map((card) => (
                  <Badge key={card.kind} tone="neutral">
                    {card.kind === 'meaning'
                      ? 'sens'
                      : card.kind === 'reading'
                        ? 'lecture'
                        : 'auto-évaluation'}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                {entry.archivedAt ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={restore.isPending}
                    onClick={() => restore.mutate(entry.id)}
                  >
                    <RotateCcw aria-hidden className="size-4" /> Restaurer
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={archive.isPending}
                    onClick={() => archive.mutate(entry.id)}
                  >
                    <Archive aria-hidden className="size-4" /> Archiver
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(entry)}>
                  <Trash2 aria-hidden className="size-4" /> Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {start.isError ? (
        <p role="alert" className="text-sm text-danger">
          Aucune révision disponible pour le moment.
        </p>
      ) : null}
      <Modal
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer ce mot ?"
        description="Cette action supprime définitivement le mot, ses cartes FSRS et ses journaux de révision."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
          >
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function PersonalVocabularyReview({
  response,
  onFinished,
}: {
  response: PersonalVocabularySessionResponse;
  onFinished: () => void;
}) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<PersonalVocabularyAnswerResult | null>(null);
  const pending = response.items.find((item) => item.status === 'pending') ?? null;
  const send = useMutation({
    mutationFn: answerPersonalVocabulary,
    onSuccess: setResult,
  });
  const finish = useMutation({
    mutationFn: finishPersonalVocabularySession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-vocabulary'] });
      onFinished();
    },
  });
  const session = response.session;
  if (!session) return null;
  if (!pending) {
    return (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-2xl font-extrabold">Révision terminée</h1>
        <Button
          className="mt-6"
          loading={finish.isPending}
          onClick={() => finish.mutate(session.id)}
        >
          Retour au carnet
        </Button>
      </Card>
    );
  }
  const isReading = pending.kind === 'reading';
  const expected = pending.kind === 'reading' ? pending.reading : pending.meaningFr;
  function next() {
    setAnswer('');
    setRevealed(false);
    setResult(null);
    queryClient.invalidateQueries({ queryKey: ['personal-vocabulary', 'session'] });
  }
  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-center text-sm font-bold text-muted">
        {session.answeredCount + 1} / {session.totalItems}
      </p>
      <Card className="mt-4 p-6 sm:p-10">
        <Badge tone="info">
          {isReading ? 'lecture' : pending.kind === 'meaning' ? 'sens' : 'auto-évaluation'}
        </Badge>
        <p className="mt-6 text-center text-lg font-bold text-ink">
          {isReading
            ? 'Écrivez la lecture de ce mot.'
            : pending.kind === 'meaning'
              ? 'Rappelez-vous le sens de ce mot.'
              : 'Rappelez-vous ce mot dans son contexte.'}
        </p>
        <p className="mt-6 text-center font-jp text-6xl font-bold text-ink">{pending.surface}</p>
        {pending.excerpt ? (
          <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
            {pending.excerpt}
          </p>
        ) : null}
        {!result ? (
          <div className="mt-8">
            {isReading ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (answer.trim())
                    send.mutate({
                      sessionId: session.id,
                      sessionItemId: pending.sessionItemId,
                      answer: answer.trim(),
                    });
                }}
                className="flex flex-col items-center gap-3"
              >
                <label className="sr-only" htmlFor="personal-reading-answer">
                  Lecture
                </label>
                <input
                  id="personal-reading-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  lang="ja"
                  autoComplete="off"
                  className="h-14 w-full max-w-sm rounded-2xl border border-line bg-surface-2 px-4 text-center font-jp text-2xl text-ink outline-none focus:border-accent"
                />
                <Button type="submit" loading={send.isPending} disabled={!answer.trim()}>
                  Valider
                </Button>
              </form>
            ) : !revealed ? (
              <div className="text-center">
                <Button onClick={() => setRevealed(true)}>Voir la réponse</Button>
              </div>
            ) : (
              <div className="text-center">
                {expected ? (
                  <p className="mb-5 text-xl font-bold text-ink">{expected}</p>
                ) : (
                  <p className="mb-5 text-sm text-muted">
                    Évaluez votre rappel à partir du mot et de son contexte.
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-4">
                  {(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating) => (
                    <Button
                      key={rating}
                      variant={rating === 'again' ? 'danger' : 'secondary'}
                      onClick={() =>
                        send.mutate({
                          sessionId: session.id,
                          sessionItemId: pending.sessionItemId,
                          rating,
                        })
                      }
                    >
                      {RATING_LABELS[rating]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`mt-8 rounded-2xl border p-5 ${result.correct ? 'border-jade/40 bg-jade-soft' : 'border-danger/40 bg-danger-soft'}`}
          >
            <p className={result.correct ? 'font-bold text-jade' : 'font-bold text-danger'}>
              {result.correct ? 'Révision enregistrée.' : 'À revoir.'}
            </p>
            {result.expectedAnswer ? (
              <p className="mt-2 text-ink-soft">
                Réponse attendue :{' '}
                <span className="font-jp font-bold text-ink">{result.expectedAnswer}</span>
              </p>
            ) : null}
            <Button className="mt-5" onClick={next}>
              Continuer <ArrowRight aria-hidden className="size-4" />
            </Button>
          </div>
        )}
        {send.isError ? (
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            Impossible d’enregistrer cette réponse.
          </p>
        ) : null}
      </Card>
    </section>
  );
}
