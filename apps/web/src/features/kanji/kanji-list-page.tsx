import type { KanjiStatus } from '@kanjipath/contracts';
import { Badge, Progress } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchKanjiList } from '../content/api';

const STATUS_META: Record<
  KanjiStatus,
  { label: string; dot: string; badge: 'neutral' | 'info' | 'warning' | 'success' }
> = {
  new: { label: 'Nouveau', dot: 'bg-muted', badge: 'neutral' },
  learning: { label: 'Apprentissage', dot: 'bg-sky', badge: 'info' },
  reviewing: { label: 'Révision', dot: 'bg-accent-2', badge: 'warning' },
  mastered: { label: 'Maîtrisé', dot: 'bg-jade', badge: 'success' },
};

const FILTERS: Array<{ value: KanjiStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'new', label: 'Nouveaux' },
  { value: 'learning', label: 'Apprentissage' },
  { value: 'reviewing', label: 'Révision' },
  { value: 'mastered', label: 'Maîtrisés' },
];

const SKELETON_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'];

export function KanjiListPage() {
  const kanjiList = useQuery({ queryKey: ['kanji', 'N5'], queryFn: () => fetchKanjiList('N5') });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<KanjiStatus | 'all'>('all');

  const items = kanjiList.data?.kanji ?? [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((kanji) => {
      if (filter !== 'all' && kanji.status !== filter) {
        return false;
      }
      if (query.length === 0) {
        return true;
      }
      return (
        kanji.literal.includes(query) || (kanji.primaryMeaning ?? '').toLowerCase().includes(query)
      );
    });
  }, [items, search, filter]);

  const counts = useMemo(() => {
    const base: Record<KanjiStatus, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const kanji of items) {
      base[kanji.status] += 1;
    }
    return base;
  }, [items]);

  const masteredRatio = items.length > 0 ? counts.mastered / items.length : 0;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            Parcours aligné sur le JLPT — non officiel
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            Les kanji <span className="gradient-text">N5</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {items.length} kanji · {counts.mastered} maîtrisés ·{' '}
            {counts.reviewing + counts.learning} en cours
          </p>
          <div className="mt-3 w-64">
            <Progress value={masteredRatio} tone="jade" label="Progression du niveau N5" />
          </div>
        </div>

        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Rechercher un kanji ou un sens</span>
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted"
          >
            🔍
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher : 時, montagne…"
            className="h-12 w-full rounded-2xl border border-line bg-card pl-11 pr-4 text-base text-ink placeholder:text-muted focus:border-accent/60 focus:outline-2 focus:outline-accent/30"
          />
        </label>
      </header>

      <div role="tablist" aria-label="Filtrer par statut" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const activeFilter = filter === item.value;
          const count = item.value === 'all' ? items.length : counts[item.value];
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={activeFilter}
              onClick={() => setFilter(item.value)}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                activeFilter
                  ? 'gradient-accent border-transparent text-white shadow-[0_8px_20px_-10px_var(--glow)]'
                  : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              {item.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {kanjiList.isPending ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {SKELETON_IDS.map((id) => (
            <div key={id} className="shimmer h-44 rounded-2xl border border-line" />
          ))}
        </div>
      ) : null}
      {kanjiList.isError ? (
        <p className="mt-8 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          Impossible de charger la liste des kanji.
        </p>
      ) : null}

      <motion.ul
        layout
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      >
        {filtered.map((kanji, index) => {
          const meta = STATUS_META[kanji.status];
          return (
            <motion.li
              key={kanji.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.015, 0.35), duration: 0.3 }}
            >
              <Link
                to={`/kanji/${kanji.literal}`}
                className="card-hover group flex h-full flex-col items-center rounded-2xl border border-line bg-card px-4 pb-4 pt-6 text-center"
              >
                <span className="relative">
                  <span className="font-kanji text-glow text-6xl text-ink transition-transform duration-300 group-hover:scale-110 inline-block">
                    {kanji.literal}
                  </span>
                  <span
                    aria-hidden
                    className={`absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full ${meta.dot}`}
                  />
                </span>
                <span className="mt-3 line-clamp-2 min-h-9 text-sm font-medium text-ink-soft">
                  {kanji.primaryMeaning ?? '—'}
                </span>
                <span className="mt-2 flex items-center gap-2">
                  <Badge tone={meta.badge}>{meta.label}</Badge>
                </span>
                <span className="mt-3 w-full">
                  <Progress value={kanji.overallScore} tone="accent" className="h-1.5" />
                </span>
                <span className="mt-2 text-[11px] font-semibold text-muted">
                  {kanji.strokeCount} traits · #{kanji.order}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>

      {kanjiList.data && filtered.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <span className="font-kanji text-5xl text-muted">探</span>
          <p className="text-muted">Aucun kanji ne correspond à votre recherche.</p>
        </div>
      ) : null}
    </div>
  );
}
