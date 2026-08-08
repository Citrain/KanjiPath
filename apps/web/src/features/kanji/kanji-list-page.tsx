import type { JlptLevel, KanjiStatus } from '@kanjipath/contracts';
import { Badge, EmptyState, ErrorState, Progress, Segmented, Skeleton } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { KanjiTile } from '../../components/kanji-tile';
import { formatPercent } from '../../lib/format';
import { JLPT_LEVELS } from '../../lib/levels';
import { fetchCurricula, fetchKanjiList } from '../content/api';

const FILTERS: Array<{ value: KanjiStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'new', label: 'Nouveaux' },
  { value: 'learning', label: 'Apprentissage' },
  { value: 'reviewing', label: 'Révision' },
  { value: 'mastered', label: 'Maîtrisés' },
];

type FrequencyFilter = 'all' | 'top500' | 'top1000';
type SortMode = 'order' | 'frequency';

const FREQUENCY_FILTERS: Array<{ value: FrequencyFilter; label: string }> = [
  { value: 'all', label: 'Toutes fréquences' },
  { value: 'top500', label: 'Top 500' },
  { value: 'top1000', label: 'Top 1000' },
];

const SKELETON_COUNT = 12;

export function KanjiListPage() {
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<KanjiStatus | 'all'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all');
  const [sort, setSort] = useState<SortMode>('order');

  const curricula = useQuery({ queryKey: ['curricula'], queryFn: fetchCurricula });
  const kanjiList = useQuery({
    queryKey: ['kanji', level],
    queryFn: () => fetchKanjiList(level),
  });

  const availableLevels = useMemo(() => {
    const curriculum = curricula.data?.curricula[0];
    return new Set<JlptLevel>(curriculum ? curriculum.levels : ['N5']);
  }, [curricula.data]);

  const items = kanjiList.data?.kanji ?? [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const frequencyMax =
      frequencyFilter === 'top500' ? 500 : frequencyFilter === 'top1000' ? 1000 : null;
    const matching = items.filter((kanji) => {
      if (filter !== 'all' && kanji.status !== filter) {
        return false;
      }
      if (
        frequencyMax !== null &&
        (kanji.frequencyRank === null || kanji.frequencyRank > frequencyMax)
      ) {
        return false;
      }
      if (query.length === 0) {
        return true;
      }
      return (
        kanji.literal.includes(query) || (kanji.primaryMeaning ?? '').toLowerCase().includes(query)
      );
    });
    if (sort === 'frequency') {
      return [...matching].sort(
        (a, b) =>
          (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) -
          (b.frequencyRank ?? Number.MAX_SAFE_INTEGER),
      );
    }
    return matching;
  }, [items, search, filter, frequencyFilter, sort]);

  const counts = useMemo(() => {
    const base: Record<KanjiStatus, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const kanji of items) {
      base[kanji.status] += 1;
    }
    return base;
  }, [items]);

  const masteredRatio = items.length > 0 ? counts.mastered / items.length : 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Parcours aligné sur le JLPT — listes non officielles
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Les kanji <span className="text-accent">{level}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            {kanjiList.data ? (
              <>
                <span>
                  <span className="font-bold text-ink">{items.length}</span> kanji
                </span>
                <span>
                  <span className="font-bold text-jade">{counts.mastered}</span> maîtrisés
                </span>
                <span>
                  <span className="font-bold text-sky">{counts.reviewing + counts.learning}</span>{' '}
                  en cours
                </span>
                <span className="hidden w-56 sm:block">
                  <Progress
                    value={masteredRatio}
                    tone="jade"
                    className="h-1.5"
                    label={`Progression du niveau ${level}`}
                  />
                </span>
                <Badge tone="success">{formatPercent(masteredRatio)}</Badge>
              </>
            ) : (
              <Skeleton className="h-5 w-64" />
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Segmented
            ariaLabel="Choisir le niveau JLPT"
            value={level}
            options={JLPT_LEVELS.map((value) => ({
              value,
              label: value,
              disabled: !availableLevels.has(value),
            }))}
            onChange={(next) => {
              setLevel(next);
              setFilter('all');
              setFrequencyFilter('all');
              setSearch('');
            }}
          />
          <p className="text-xs text-muted">
            {availableLevels.size < JLPT_LEVELS.length
              ? 'Les autres niveaux arrivent au fur et à mesure du contenu.'
              : ''}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <fieldset aria-label="Filtrer par statut" className="flex min-w-0 flex-wrap gap-2">
          {FILTERS.map((item) => {
            const activeFilter = filter === item.value;
            const count = item.value === 'all' ? items.length : counts[item.value];
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={activeFilter}
                onClick={() => setFilter(item.value)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
                  activeFilter
                    ? 'border-transparent bg-accent text-white shadow-glow'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                {item.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </fieldset>

        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Rechercher un kanji ou un sens</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher : 時, montagne…"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-[0.9375rem] text-ink transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent/70 focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <fieldset aria-label="Filtrer par fréquence" className="flex min-w-0 flex-wrap gap-2">
          {FREQUENCY_FILTERS.map((item) => {
            const active = frequencyFilter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFrequencyFilter(item.value)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'border-transparent bg-sky text-white'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </fieldset>

        <Segmented
          ariaLabel="Trier les kanji"
          value={sort}
          options={[
            { value: 'order', label: 'Ordre du parcours' },
            { value: 'frequency', label: 'Fréquence' },
          ]}
          onChange={setSort}
        />
      </div>

      {kanjiList.isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: squelettes interchangeables
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      ) : kanjiList.isError ? (
        <ErrorState
          title="Impossible de charger la liste des kanji"
          description="Vérifiez votre connexion puis réessayez."
          onRetry={() => kanjiList.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          glyph="来"
          title={`Le niveau ${level} arrive bientôt`}
          description="Le contenu est publié niveau par niveau. Revenez bientôt, ou continuez à consolider le niveau actuel."
        />
      ) : (
        <>
          <AnimatePresence>
            <motion.ul
              layout
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            >
              {filtered.map((kanji, index) => (
                <motion.li
                  key={kanji.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.012, 0.3), duration: 0.25 }}
                >
                  <KanjiTile kanji={kanji} />
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>

          {filtered.length === 0 ? (
            <EmptyState
              glyph="探"
              title="Aucun kanji ne correspond"
              description="Essayez un autre terme ou réinitialisez les filtres."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                  className="cursor-pointer text-sm font-bold text-accent hover:underline"
                >
                  Réinitialiser la recherche
                </button>
              }
            />
          ) : null}
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {kanjiList.data ? `${filtered.length} kanji affichés` : ''}
      </p>
    </div>
  );
}
