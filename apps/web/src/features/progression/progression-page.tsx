import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Progress,
  SectionHeader,
  Skeleton,
  Stat,
  Tabs,
} from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Flame,
  ListChecks,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HistoryChart } from '../../components/history-chart';
import { LevelBadge } from '../../components/level-badge';
import { StatusBadge } from '../../components/status-badge';
import { formatDateShort, formatPercent } from '../../lib/format';
import { computeStreak } from '../../lib/progress';
import { SKILL_LABELS } from '../../lib/skills';
import { fetchDashboard, fetchHistory, fetchLevelProgress, fetchWeakPoints } from '../content/api';

const STATUS_SPLIT = [
  { key: 'newCount', label: 'Nouveaux', className: 'bg-muted' },
  { key: 'learningCount', label: 'Apprentissage', className: 'bg-sky' },
  { key: 'reviewingCount', label: 'Révision', className: 'bg-gold' },
  { key: 'masteredCount', label: 'Maîtrisés', className: 'bg-jade' },
] as const;

type TabValue = 'overview' | 'activity' | 'weak';

export function ProgressionPage() {
  const [tab, setTab] = useState<TabValue>('overview');
  const dashboard = useQuery({ queryKey: ['progress', 'dashboard'], queryFn: fetchDashboard });
  const history = useQuery({ queryKey: ['progress', 'history'], queryFn: fetchHistory });
  const weakPoints = useQuery({ queryKey: ['progress', 'weak-points'], queryFn: fetchWeakPoints });

  const activeLevel = dashboard.data?.activeLevel;
  const levelProgress = useQuery({
    queryKey: ['progress', 'levels', activeLevel ?? 'N5'],
    queryFn: () => fetchLevelProgress(activeLevel ?? 'N5'),
    enabled: Boolean(activeLevel),
  });

  const data = dashboard.data;
  const totals = data
    ? {
        total: data.levels.reduce((sum, level) => sum + level.total, 0),
        mastered: data.levels.reduce((sum, level) => sum + level.masteredCount, 0),
        mastery:
          data.levels.reduce((sum, level) => sum + level.weightedMastery * level.total, 0) /
          Math.max(
            1,
            data.levels.reduce((sum, level) => sum + level.total, 0),
          ),
      }
    : null;
  const historyDays = history.data?.days ?? [];
  const totalAnswered = historyDays.reduce((sum, day) => sum + day.answered, 0);
  const totalCorrect = historyDays.reduce((sum, day) => sum + day.correct, 0);
  const streak = history.data ? computeStreak(history.data.days) : null;

  if (dashboard.isError) {
    return (
      <ErrorState
        title="Impossible de charger votre progression"
        description="Vérifiez votre connexion puis réessayez."
        onRetry={() => dashboard.refetch()}
        className="mt-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Parcours aligné sur le JLPT"
        title="Votre progression"
        description="Maîtrise par niveau, activité quotidienne et points à retravailler."
      />

      <Tabs<TabValue>
        ariaLabel="Sections de progression"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Vue d’ensemble', icon: <ListChecks /> },
          { value: 'activity', label: 'Activité', icon: <Activity /> },
          { value: 'weak', label: 'Points faibles', icon: <TriangleAlert /> },
        ]}
      />

      {tab === 'overview' ? (
        <div className="flex flex-col gap-8">
          <section
            aria-label="Statistiques globales"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            <Stat
              label="Kanji maîtrisés"
              tone="jade"
              icon={<BadgeCheck />}
              value={totals ? `${totals.mastered}` : <Skeleton className="h-9 w-16" />}
              hint={totals ? `sur ${totals.total} au total` : ''}
            />
            <Stat
              label="Maîtrise globale"
              tone="accent"
              icon={<Target />}
              value={totals ? formatPercent(totals.mastery) : <Skeleton className="h-9 w-16" />}
              hint="Moyenne pondérée"
            />
            <Stat
              label="Réponses (30 j)"
              tone="sky"
              icon={<BarChart3 />}
              value={history.data ? `${totalAnswered}` : <Skeleton className="h-9 w-16" />}
              hint={
                totalAnswered > 0 ? `${formatPercent(totalCorrect / totalAnswered)} correctes` : ''
              }
            />
            <Stat
              label="Série"
              tone="gold"
              icon={<Flame />}
              value={streak ? `${streak.days} j` : <Skeleton className="h-9 w-16" />}
              hint="Jours d’étude consécutifs"
            />
          </section>

          <section aria-labelledby="niveaux">
            <SectionHeader title="Progression par niveau" />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(data?.levels ?? []).map((level) => {
                const isActive = level.level === data?.activeLevel;
                const ratio = level.total > 0 ? level.masteredCount / level.total : 0;
                return (
                  <Card
                    key={level.level}
                    className={isActive ? 'border-accent/40 bg-accent-soft' : ''}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <LevelBadge level={level.level} prefix="" className="text-sm" />
                      <div className="flex items-center gap-2">
                        {isActive ? <Badge tone="accent">actif</Badge> : null}
                        {level.dueToday > 0 ? (
                          <Badge tone="warning">{level.dueToday} dus</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-2xl font-extrabold tracking-tight">
                      {Math.round(level.weightedMastery * 100)}
                      <span className="text-base text-muted">%</span>
                    </p>
                    <p className="text-xs font-semibold text-muted">maîtrise pondérée</p>
                    <Progress
                      value={ratio}
                      tone={isActive ? 'accent' : 'jade'}
                      className="mt-3"
                      label={`Kanji maîtrisés en ${level.level}`}
                    />
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {level.masteredCount}/{level.total} kanji maîtrisés
                    </p>
                    {level.total > 0 ? (
                      <>
                        <div
                          aria-hidden
                          className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
                        >
                          {STATUS_SPLIT.map((part) =>
                            level[part.key] > 0 ? (
                              <span
                                key={part.key}
                                className={part.className}
                                style={{ width: `${(level[part.key] / level.total) * 100}%` }}
                              />
                            ) : null,
                          )}
                        </div>
                        <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                          {STATUS_SPLIT.map((part) => (
                            <li
                              key={part.key}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"
                            >
                              <span
                                aria-hidden
                                className={`size-1.5 rounded-full ${part.className}`}
                              />
                              {part.label} · {level[part.key]}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-muted">Contenu bientôt disponible.</p>
                    )}
                  </Card>
                );
              })}
              {!data ? (
                <>
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                </>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="detail-niveau">
            <SectionHeader
              title={
                <>
                  Détail du niveau {activeLevel ?? 'N5'}
                  {levelProgress.data ? (
                    <Badge>{levelProgress.data.kanji.length} kanji</Badge>
                  ) : null}
                </>
              }
            />
            {levelProgress.isPending ? (
              <div className="mt-4 flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: squelettes interchangeables
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : levelProgress.data && levelProgress.data.kanji.length > 0 ? (
              <ul className="mt-4 grid gap-2 md:grid-cols-2">
                {levelProgress.data.kanji.map((row) => (
                  <li key={row.kanjiId}>
                    <Link
                      to={`/kanji/${row.literal}`}
                      className="flex items-center gap-3.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 transition-all duration-150 hover:-translate-y-px hover:border-line-strong"
                    >
                      <span className="font-jp w-9 text-center text-2xl text-ink">
                        {row.literal}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Progress
                          value={row.overallScore}
                          tone={row.status === 'mastered' ? 'jade' : 'accent'}
                          className="h-1.5"
                          label={`Maîtrise de ${row.literal}`}
                        />
                      </span>
                      <span className="hidden w-24 shrink-0 text-right text-xs font-semibold text-muted sm:block">
                        {row.nextDueAt ? `dû le ${formatDateShort(row.nextDueAt)}` : 'à jour'}
                      </span>
                      <StatusBadge status={row.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                glyph="空"
                title="Aucun kanji dans ce niveau pour l'instant"
                className="mt-4"
              />
            )}
          </section>
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionHeader
              title="Activité des 30 derniers jours"
              aside={
                history.data ? (
                  <Badge tone="neutral">
                    {totalAnswered} réponses ·{' '}
                    {formatPercent(totalAnswered > 0 ? totalCorrect / totalAnswered : 0)} correctes
                  </Badge>
                ) : null
              }
            />
            <div className="mt-6">
              {history.isPending ? (
                <Skeleton className="h-44 w-full" />
              ) : historyDays.length === 0 ? (
                <EmptyState
                  glyph="始"
                  title="Votre historique démarre ici"
                  description="Lancez votre première session : chaque réponse nourrit votre planification de révision."
                />
              ) : (
                <HistoryChart days={historyDays} />
              )}
            </div>
          </Card>
          <div className="flex flex-col gap-6">
            <Card>
              <SectionHeader title="Série en cours" />
              {streak ? (
                <div className="mt-4 flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-gold-soft text-gold">
                    <Flame aria-hidden className="size-7" />
                  </span>
                  <div>
                    <p className="text-3xl font-extrabold">
                      {streak.days} jour{streak.days > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-muted">
                      {streak.activeToday
                        ? 'Objectif du jour atteint — continuez sur votre lancée.'
                        : 'Étudiez aujourd’hui pour préserver la série.'}
                    </p>
                  </div>
                </div>
              ) : (
                <Skeleton className="mt-4 h-16 w-full" />
              )}
            </Card>
            <Card>
              <SectionHeader title="Aujourd'hui" />
              <p className="mt-4 text-3xl font-extrabold">
                {data ? data.reviewsToday : <Skeleton className="h-9 w-16" />}
                <span className="text-base font-semibold text-muted"> révisions</span>
              </p>
              {data?.accuracyLast7Days != null ? (
                <p className="mt-1 text-sm text-muted">
                  Précision sur 7 jours : {formatPercent(data.accuracyLast7Days)}
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'weak' ? (
        <Card>
          <SectionHeader
            title="Kanji à retravailler"
            aside={
              weakPoints.data && weakPoints.data.weakPoints.length > 0 ? (
                <Badge tone="warning">{weakPoints.data.weakPoints.length} kanji</Badge>
              ) : null
            }
          />
          {weakPoints.isPending ? (
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: squelettes interchangeables
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : weakPoints.data && weakPoints.data.weakPoints.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {weakPoints.data.weakPoints.map((point) => (
                <li key={point.kanjiId}>
                  <Link
                    to={`/kanji/${point.literal}`}
                    className="flex items-center gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:border-line-strong"
                  >
                    <span className="font-jp text-3xl text-ink">{point.literal}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-soft">
                        Fragile en {SKILL_LABELS[point.weakestSkill] ?? point.weakestSkill}
                      </span>
                      <span className="block text-xs text-muted">
                        {point.recentFailures} erreur{point.recentFailures > 1 ? 's' : ''} récente
                        {point.recentFailures > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="flex w-28 shrink-0 items-center gap-2">
                      <Progress
                        value={point.score}
                        tone="gold"
                        className="h-1.5 flex-1"
                        label={`Score de ${point.literal}`}
                      />
                      <span className="text-sm font-extrabold text-gold">
                        {formatPercent(point.score)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              glyph="強"
              title="Aucun point faible détecté"
              description="Vos réponses sont solides. Continuez à réviser régulièrement pour que cela dure."
              className="mt-4"
            />
          )}
        </Card>
      ) : null}
    </div>
  );
}
