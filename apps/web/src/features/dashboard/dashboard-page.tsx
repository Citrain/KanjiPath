import { Badge, Button, Card, Progress, Ring } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/use-auth';
import { fetchDashboard, fetchHistory, fetchWeakPoints } from '../content/api';

const STATUS_META = [
  { key: 'newCount', label: 'Nouveaux', kanji: '新', tone: 'text-muted', bg: 'bg-card-2' },
  {
    key: 'learningCount',
    label: 'En apprentissage',
    kanji: '習',
    tone: 'text-sky',
    bg: 'bg-sky-soft',
  },
  {
    key: 'reviewingCount',
    label: 'En révision',
    kanji: '復',
    tone: 'text-accent-2',
    bg: 'bg-accent-soft',
  },
  { key: 'masteredCount', label: 'Maîtrisés', kanji: '完', tone: 'text-jade', bg: 'bg-jade-soft' },
] as const;

export function DashboardPage() {
  const me = useMe();
  const dashboard = useQuery({ queryKey: ['progress', 'dashboard'], queryFn: fetchDashboard });
  const weakPoints = useQuery({ queryKey: ['progress', 'weak-points'], queryFn: fetchWeakPoints });
  const history = useQuery({ queryKey: ['progress', 'history'], queryFn: fetchHistory });

  const user = me.data?.user;
  const data = dashboard.data;
  const active = data?.levels.find((level) => level.level === data.activeLevel);
  const totalDue = data?.levels.reduce((sum, level) => sum + level.dueToday, 0) ?? 0;
  const historyDays = history.data?.days ?? [];
  const maxAnswered = Math.max(1, ...historyDays.map((day) => day.answered));

  return (
    <div className="flex flex-col gap-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-line bg-panel p-8 sm:p-10"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="font-kanji animate-float absolute -right-6 -top-10 select-none text-[11rem] font-bold text-ink opacity-[0.05]">
            学
          </span>
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-sky/10 blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Parcours aligné sur le JLPT
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Bonjour{user ? `, ${user.displayName}` : ''} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-3 text-muted">
              {totalDue > 0 ? (
                <>
                  <span className="font-bold text-accent">{totalDue}</span> révision
                  {totalDue > 1 ? 's' : ''} vous attend{totalDue > 1 ? 'ent' : ''} aujourd'hui.
                  C'est le moment idéal pour consolider votre mémoire.
                </>
              ) : (
                'Aucune révision urgente — parfait pour découvrir de nouveaux kanji.'
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="xl">
                <Link to="/etude">Étudier maintenant</Link>
              </Button>
              <Button asChild variant="secondary" size="xl">
                <Link to="/kanji">Explorer les kanji</Link>
              </Button>
              {data?.accuracyLast7Days != null ? (
                <Badge tone="success" className="px-3 py-1.5 text-sm">
                  Précision 7j : {Math.round(data.accuracyLast7Days * 100)} %
                </Badge>
              ) : null}
            </div>
          </div>

          {active ? (
            <div className="flex flex-col items-center gap-2">
              <Ring value={active.weightedMastery} size={170} stroke={12}>
                <div className="text-center">
                  <p className="text-4xl font-extrabold">
                    {Math.round(active.weightedMastery * 100)}%
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    maîtrise {active.level}
                  </p>
                </div>
              </Ring>
              <p className="text-sm text-muted">
                {active.masteredCount}/{active.total} kanji maîtrisés
              </p>
            </div>
          ) : (
            <div className="shimmer h-44 w-44 rounded-full border border-line" />
          )}
        </div>
      </motion.section>

      {active ? (
        <section
          aria-label="Répartition des kanji"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {STATUS_META.map((meta, index) => (
            <motion.div
              key={meta.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.06, duration: 0.4 }}
            >
              <Card hover className="flex items-center gap-4">
                <span
                  className={`font-kanji flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${meta.bg} ${meta.tone}`}
                >
                  {meta.kanji}
                </span>
                <div>
                  <p className="text-2xl font-extrabold leading-none">{active[meta.key]}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {meta.label}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          aria-labelledby="historique"
          className="lg:col-span-3"
        >
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <h2 id="historique" className="text-lg font-bold">
                Activité des 30 derniers jours
              </h2>
              <Badge tone="info">
                {historyDays.reduce((sum, day) => sum + day.answered, 0)} révisions
              </Badge>
            </div>
            {historyDays.length === 0 ? (
              <div className="mt-6 flex h-40 flex-col items-center justify-center gap-2 text-center">
                <span className="font-kanji text-4xl text-muted">始</span>
                <p className="text-sm text-muted">
                  Votre historique démarre ici — lancez votre première session !
                </p>
              </div>
            ) : (
              <div
                className="mt-6 flex h-40 items-end gap-1.5"
                role="img"
                aria-label="Histogramme des révisions par jour"
              >
                {historyDays.map((day) => (
                  <div
                    key={day.date}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                  >
                    <div
                      className="gradient-accent w-full rounded-t-md opacity-85 transition-opacity group-hover:opacity-100"
                      style={{ height: `${Math.max(6, (day.answered / maxAnswered) * 100)}%` }}
                    />
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-panel px-2 py-1 text-xs font-semibold opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                      {new Date(day.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {day.correct}/{day.answered}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.45 }}
          aria-labelledby="points-faibles"
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <h2 id="points-faibles" className="text-lg font-bold">
                Points faibles
              </h2>
              <Badge tone="warning">à retravailler</Badge>
            </div>
            {weakPoints.data && weakPoints.data.weakPoints.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {weakPoints.data.weakPoints.slice(0, 5).map((point) => (
                  <li key={point.kanjiId}>
                    <Link
                      to={`/kanji/${point.literal}`}
                      className="card-hover flex items-center gap-3 rounded-xl border border-line bg-card-2 px-3 py-2.5"
                    >
                      <span className="font-kanji text-3xl text-ink">{point.literal}</span>
                      <span className="flex-1 text-sm text-muted">
                        Fragile en{' '}
                        <span className="font-bold text-ink-soft">{point.weakestSkill}</span>
                      </span>
                      <span className="text-sm font-extrabold text-accent-2">
                        {Math.round(point.score * 100)}%
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
        </motion.section>
      </div>

      {data ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.45 }}
          aria-labelledby="tous-les-niveaux"
        >
          <Card>
            <h2 id="tous-les-niveaux" className="text-lg font-bold">
              Votre parcours
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {data.levels.map((level) => {
                const ratio = level.total > 0 ? level.masteredCount / level.total : 0;
                const isActive = level.level === data.activeLevel;
                return (
                  <li
                    key={level.level}
                    className={`rounded-2xl border p-4 ${
                      isActive ? 'border-accent/40 bg-accent-soft' : 'border-line bg-card-2'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-extrabold">{level.level}</span>
                      {isActive ? <Badge tone="accent">actif</Badge> : null}
                      {level.total === 0 ? <Badge>bientôt</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {level.masteredCount}/{level.total} maîtrisés
                      {level.dueToday > 0 ? ` · ${level.dueToday} dues` : ''}
                    </p>
                    <Progress value={ratio} tone={isActive ? 'accent' : 'jade'} className="mt-3" />
                  </li>
                );
              })}
            </ul>
          </Card>
        </motion.section>
      ) : null}
    </div>
  );
}
