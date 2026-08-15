import type { DailyMissionStep } from '@kanjipath/contracts';
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  GraduationCap,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createDailyMission, getDailyMission, updateDailyMissionStep } from './api';

const STEP_LABELS: Record<DailyMissionStep['type'], string> = {
  study: 'Révisions ciblées',
  vocabulary: 'Mot en contexte',
  text: 'Lecture immersive',
};

export function DailyMissionPage() {
  const queryClient = useQueryClient();
  const missionQuery = useQuery({ queryKey: ['study', 'daily-mission'], queryFn: getDailyMission });
  const create = useMutation({
    mutationFn: createDailyMission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['study', 'daily-mission'] }),
  });
  const updateStep = useMutation({
    mutationFn: ({
      missionId,
      stepId,
      status,
    }: {
      missionId: string;
      stepId: string;
      status: 'completed' | 'skipped';
    }) => updateDailyMissionStep(missionId, stepId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['study', 'daily-mission'] }),
  });

  if (missionQuery.isPending) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-8 h-64 rounded-3xl" />
      </div>
    );
  }

  if (missionQuery.isError) {
    return (
      <ErrorState
        title="Impossible de charger la mission"
        description="Réessayez dans un instant."
        onRetry={() => missionQuery.refetch()}
        className="mt-10"
      />
    );
  }

  const mission = missionQuery.data?.mission ?? null;
  if (!mission) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Parcours du jour"
          title="Une mission courte, utile et variée"
          description="Révisions prioritaires, vocabulaire et lecture : une progression guidée qui respecte votre charge."
        />
        <Card className="mt-8 flex flex-col items-start gap-5 border-accent/30 bg-accent-soft p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-white shadow-glow">
            <Sparkles aria-hidden className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-ink">Prêt pour aujourd'hui ?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              La mission est préparée une seule fois pour votre journée locale. Vous pourrez la
              reprendre plus tard.
            </p>
          </div>
          <Button size="lg" loading={create.isPending} onClick={() => create.mutate()}>
            Préparer ma mission
            <ArrowRight aria-hidden className="size-4.5" />
          </Button>
          {create.isError ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              Impossible de préparer la mission pour le moment.
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  const completed = mission.steps.filter((step) => step.status !== 'pending').length;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow={`Mission du ${mission.localDate}`}
        title={mission.status === 'completed' ? 'Mission terminée' : 'Votre mission du jour'}
        description={
          mission.status === 'completed'
            ? 'Les étapes du jour sont enregistrées. Revenez demain pour une nouvelle composition.'
            : `${completed}/${mission.steps.length} étape${mission.steps.length > 1 ? 's' : ''} terminée${completed > 1 ? 's' : ''}.`
        }
      />

      <ol className="flex flex-col gap-4">
        {mission.steps.map((step) => (
          <li key={step.id}>
            <MissionStepCard
              missionId={mission.id}
              step={step}
              pendingUpdate={updateStep.isPending && updateStep.variables?.stepId === step.id}
              onUpdate={(status) =>
                updateStep.mutate({ missionId: mission.id, stepId: step.id, status })
              }
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MissionStepCard({
  missionId,
  step,
  pendingUpdate,
  onUpdate,
}: {
  missionId: string;
  step: DailyMissionStep;
  pendingUpdate: boolean;
  onUpdate: (status: 'completed' | 'skipped') => void;
}) {
  const pending = step.status === 'pending';
  const Icon = step.type === 'study' ? GraduationCap : step.type === 'text' ? BookOpen : Sparkles;
  return (
    <Card className={step.status === 'completed' ? 'border-jade/30 bg-jade-soft/30' : ''}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            step.status === 'completed' ? 'bg-jade text-white' : 'bg-accent-soft text-accent'
          }`}
        >
          {step.status === 'completed' ? <Check className="size-5" /> : <Icon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Étape {step.position + 1}
            </p>
            <Badge
              tone={
                step.status === 'completed'
                  ? 'success'
                  : step.status === 'skipped'
                    ? 'neutral'
                    : 'accent'
              }
            >
              {step.status === 'completed'
                ? 'terminée'
                : step.status === 'skipped'
                  ? 'passée'
                  : STEP_LABELS[step.type]}
            </Badge>
          </div>
          <StepContent
            missionId={missionId}
            step={step}
            pending={pending}
            onUpdate={onUpdate}
            pendingUpdate={pendingUpdate}
          />
        </div>
      </div>
    </Card>
  );
}

function StepContent({
  missionId,
  step,
  pending,
  pendingUpdate,
  onUpdate,
}: {
  missionId: string;
  step: DailyMissionStep;
  pending: boolean;
  pendingUpdate: boolean;
  onUpdate: (status: 'completed' | 'skipped') => void;
}) {
  if (step.type === 'study') {
    const remaining = step.items.filter((item) => item.status === 'pending').length;
    return (
      <>
        <h2 className="mt-3 text-lg font-bold">Consolider vos cartes prioritaires</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {remaining > 0
            ? `${remaining} exercice${remaining > 1 ? 's' : ''} préparé${remaining > 1 ? 's' : ''} selon vos révisions et points faibles.`
            : 'Cette sous-session est terminée.'}
        </p>
        {pending ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/etude?session=${step.session.id}&mission=${missionId}`}>
                {remaining > 0 ? 'Commencer les révisions' : 'Voir la session'}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" loading={pendingUpdate} onClick={() => onUpdate('skipped')}>
              <SkipForward aria-hidden className="size-4" />
              Passer cette étape
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  if (step.type === 'vocabulary') {
    return (
      <>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-jp text-3xl font-bold text-ink">{step.vocabulary.writtenForm}</h2>
          <span className="font-jp text-lg text-ink-soft">{step.vocabulary.reading}</span>
          {step.vocabulary.romaji ? (
            <span className="text-sm text-muted">{step.vocabulary.romaji}</span>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{step.vocabulary.meaningFr}</p>
        {pending ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => onUpdate('completed')} loading={pendingUpdate}>
              <Check aria-hidden className="size-4" />
              J'ai étudié ce mot
            </Button>
            <Button variant="ghost" onClick={() => onUpdate('skipped')} disabled={pendingUpdate}>
              <Circle aria-hidden className="size-4" />
              Plus tard
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <h2 className="mt-3 text-lg font-bold">{step.text.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Lecture graduée {step.text.level}, avec les aides configurées dans vos préférences.
      </p>
      {pending ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link to={`/lecture/${step.text.id}`}>
              Lire le texte
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
          <Button variant="secondary" onClick={() => onUpdate('completed')} loading={pendingUpdate}>
            <Check aria-hidden className="size-4" />
            Marquer comme lu
          </Button>
          <Button variant="ghost" onClick={() => onUpdate('skipped')} disabled={pendingUpdate}>
            <Circle aria-hidden className="size-4" />
            Plus tard
          </Button>
        </div>
      ) : null}
    </>
  );
}
