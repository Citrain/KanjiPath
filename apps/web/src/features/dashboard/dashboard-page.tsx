import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Progress,
  Ring,
  SectionHeader,
  Skeleton,
  Stat,
} from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, Flame, NotebookPen, Shapes, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { HistoryChart } from '../../components/history-chart';
import { LevelBadge } from '../../components/level-badge';
import { formatDateShort, formatPercent, todayGreeting, todayLong } from '../../lib/format';
import { computeStreak } from '../../lib/progress';
import { SKILL_LABELS } from '../../lib/skills';
import { useMe } from '../auth/use-auth';
import { fetchDashboard, fetchHistory, fetchLevelProgress, fetchWeakPoints } from '../content/api';

export function DashboardPage() {
  const me = useMe();
  const dashboard = useQuery({ queryKey: ['progress', 'dashboard'], queryFn: fetchDashboard });
  const weakPoints = useQuery({ queryKey: ['progress', 'weak-points'], queryFn: fetchWeakPoints });
  const history = useQuery({ queryKey: ['progress', 'history'], queryFn: fetchHistory });

  const activeLevel = dashboard.data?.activeLevel;
  const levelProgress = useQuery({
    queryKey: ['progress', 'levels', activeLevel ?? 'N5'],
    queryFn: () => fetchLevelProgress(activeLevel ?? 'N5'),
    enabled: Boolean(activeLevel),
  });

  const user = me.data?.user;
  const data = dashboard.data;
  const active = data?.levels.find((level) => level.level === data.activeLevel);
  const totalDue = data?.levels.reduce((sum, level) => sum + level.dueToday, 0) ?? 0;
  const streak = history.data ? computeStreak(history.data.days) : null;
  const historyDays = history.data?.days ?? [];

  const now = Date.now();
  const dueKanji = (levelProgress.data?.kanji ?? [])
    .filter((row) => row.nextDueAt !== null && new Date(row.nextDueAt).getTime() <= now)
    .sort((a, b) => new Date(a.nextDueAt ?? 0).getTime() - new Date(b.nextDueAt ?? 0).getTime())
    .slice(0, 6);

  if (dashboard.isError) {
    return (
      <ErrorState
        title="Impossible de charger votre tableau de bord"
        description="Vérifiez votre connexion puis réessayez."
        onRetry={() => dashboard.refetch()}
        className="mt-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={todayLong()}
        title={
          <>
            {todayGreeting()}
            {user ? `, ${user.displayName}` : ''}
          </>
        }
        description={
          totalDue > 0 ? (
            <>
              <span className="font-bold text-accent">{totalDue}</span> révision
              {totalDue > 1 ? 's' : ''} vous attend
              {totalDue > 1 ? 'ent' : ''} aujourd'hui — le bon moment pour consolider votre mémoire.
            </>
          ) : (
            'Aucune révision urgente : parfait pour découvrir de nouveaux kanji.'
          )
        }
      />

      {data && active ? (
        <section
          aria-label="Continuer l'apprentissage"
          className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-1 sm:p-8"
        >
          <span
            aria-hidden
            className="font-jp pointer-events-none absolute -right-4 -top-10 select-none text-[10rem] font-bold text-ink opacity-[0.04]"
          >
            学
          </span>
          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div className="min-w-0 max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <LevelBadge level={active.level} />
                {totalDue > 0 ? (
                  <Badge tone="accent">
                    {totalDue} révision{totalDue > 1 ? 's' : ''} due{totalDue > 1 ? 's' : ''}
                  </Badge>
                ) : null}
                {data.accuracyLast7Days != null ? (
                  <Badge tone="info">précision 7j : {formatPercent(data.accuracyLast7Days)}</Badge>
                ) : null}
              </div>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Continuer l'apprentissage
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {active.masteredCount}/{active.total} kanji maîtrisés en {active.level} ·{' '}
                {active.learningCount + active.reviewingCount} en cours d'acquisition.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="xl" className="group">
                  <Link to="/etude">
                    Étudier maintenant
                    <ArrowRight
                      aria-hidden
                      className="size-4.5 transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="xl" className="group">
                  <Link to="/kanji">
                    <Shapes
                      aria-hidden
                      className="size-4.5 text-muted transition-colors duration-200 group-hover:text-accent"
                    />
                    Explorer les kanji
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <Ring
                value={active.weightedMastery}
                size={164}
                stroke={12}
                tone="accent"
                label={`Maîtrise du niveau ${active.level}`}
              >
                <div className="text-center">
                  <p className="text-4xl font-extrabold tracking-tight">
                    {Math.round(active.weightedMastery * 100)}
                    <span className="text-xl">%</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    maîtrise {active.level}
                  </p>
                </div>
              </Ring>
              <p className="text-sm font-medium text-muted">
                {active.masteredCount}/{active.total} kanji maîtrisés
              </p>
            </div>
          </div>
        </section>
      ) : (
        <Skeleton className="h-64 rounded-3xl" />
      )}

      <section aria-label="Statistiques du jour" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Série"
          tone="gold"
          icon={<Flame />}
          value={streak ? `${streak.days} j` : <Skeleton className="h-9 w-16" />}
          hint={
            streak && streak.days > 0 && !streak.activeToday
              ? 'À confirmer aujourd’hui'
              : 'Jours d’étude consécutifs'
          }
        />
        <Stat
          label="Aujourd'hui"
          tone="accent"
          icon={<NotebookPen />}
          value={data ? data.reviewsToday : <Skeleton className="h-9 w-16" />}
          hint="Révisions effectuées"
        />
        <Stat
          label="Précision 7j"
          tone="sky"
          icon={<Target />}
          value={
            data ? (
              data.accuracyLast7Days != null ? (
                formatPercent(data.accuracyLast7Days)
              ) : (
                '—'
              )
            ) : (
              <Skeleton className="h-9 w-16" />
            )
          }
          hint="Bonnes réponses"
        />
        <Stat
          label="Maîtrisés"
          tone="jade"
          icon={<BadgeCheck />}
          value={active ? `${active.masteredCount}` : <Skeleton className="h-9 w-16" />}
          hint={active ? `sur ${active.total} kanji en ${active.level}` : ''}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section aria-labelledby="activite" className="lg:col-span-3">
          <Card className="h-full">
            <SectionHeader
              title="Activité des 30 derniers jours"
              aside={
                history.data ? (
                  <Badge tone="neutral">
                    {historyDays.reduce((sum, day) => sum + day.answered, 0)} réponses
                  </Badge>
                ) : null
              }
            />
            <div className="mt-6">
              {history.isPending ? (
                <Skeleton className="h-44 w-full" />
              ) : history.isError ? (
                <ErrorState
                  title="Impossible de charger l'activité"
                  onRetry={() => history.refetch()}
                />
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
        </section>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section aria-labelledby="a-reviser">
            <Card>
              <SectionHeader
                title="À réviser"
                aside={
                  dueKanji.length > 0 ? <Badge tone="accent">{dueKanji.length} dus</Badge> : null
                }
              />
              {levelProgress.isPending ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : dueKanji.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-jade-soft px-4 py-3 text-sm font-semibold text-jade">
                  <BadgeCheck aria-hidden className="size-4 shrink-0" />
                  Tout est à jour pour ce niveau.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {dueKanji.map((row) => (
                    <li key={row.kanjiId}>
                      <Link
                        to={`/kanji/${row.literal}`}
                        className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 transition-all duration-150 hover:-translate-y-px hover:border-line-strong"
                      >
                        <span className="font-jp text-2xl text-ink">{row.literal}</span>
                        <span className="flex-1">
                          <Progress
                            value={row.overallScore}
                            tone={row.overallScore >= 0.7 ? 'jade' : 'accent'}
                            className="h-1.5"
                            label={`Maîtrise de ${row.literal}`}
                          />
                        </span>
                        <span className="shrink-0 text-xs font-bold text-muted">
                          {row.nextDueAt ? formatDateShort(row.nextDueAt) : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section aria-labelledby="points-faibles">
            <Card>
              <SectionHeader
                title="Points faibles"
                aside={
                  weakPoints.data && weakPoints.data.weakPoints.length > 0 ? (
                    <Badge tone="warning">à retravailler</Badge>
                  ) : null
                }
              />
              {weakPoints.isPending ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : weakPoints.data && weakPoints.data.weakPoints.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-2">
                  {weakPoints.data.weakPoints.slice(0, 4).map((point) => (
                    <li key={point.kanjiId}>
                      <Link
                        to={`/kanji/${point.literal}`}
                        className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 transition-all duration-150 hover:-translate-y-px hover:border-line-strong"
                      >
                        <span className="font-jp text-2xl text-ink">{point.literal}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted">
                          Fragile en{' '}
                          <span className="font-bold text-ink-soft">
                            {SKILL_LABELS[point.weakestSkill] ?? point.weakestSkill}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-extrabold text-gold">
                          {formatPercent(point.score)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Aucun point faible détecté pour l'instant. Continuez !
                </p>
              )}
            </Card>
          </section>
        </div>
      </div>

      {data ? (
        <section aria-labelledby="parcours">
          <SectionHeader title="Votre parcours N5 → N1" />
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {data.levels.map((level) => {
              const ratio = level.total > 0 ? level.masteredCount / level.total : 0;
              const isActive = level.level === data.activeLevel;
              return (
                <motion.li
                  key={level.level}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <Link
                    to={isActive ? '/etude' : '/progression'}
                    aria-label={`Niveau ${level.level}, ${level.masteredCount} kanji maîtrisés sur ${level.total}`}
                    className={`block h-full rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2 ${
                      isActive
                        ? 'border-accent/40 bg-accent-soft'
                        : 'border-line bg-surface hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-extrabold tracking-tight">{level.level}</span>
                      {isActive ? <Badge tone="accent">actif</Badge> : null}
                      {level.total === 0 ? <Badge>bientôt</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {level.masteredCount}/{level.total} maîtrisés
                      {level.dueToday > 0 ? ` · ${level.dueToday} dus` : ''}
                    </p>
                    <Progress
                      value={level.total > 0 ? ratio : 0}
                      tone={isActive ? 'accent' : 'jade'}
                      className="mt-3"
                      label={`Progression ${level.level}`}
                    />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
