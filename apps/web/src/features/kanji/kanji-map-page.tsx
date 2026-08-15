import type { KanjiMapLinkType, KanjiMapNodeDto } from '@kanjipath/contracts';
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitFork, Network } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/status-badge';
import { fetchKanjiMap } from '../content/api';

const RELATION_META: Record<
  KanjiMapLinkType,
  { label: string; line: string; dot: string; badge: 'info' | 'danger' | 'success' | 'warning' }
> = {
  shared_component: {
    label: 'Composant partagé',
    line: 'stroke-sky',
    dot: 'bg-sky',
    badge: 'info',
  },
  visual_confusion: {
    label: 'Confusion visuelle',
    line: 'stroke-danger',
    dot: 'bg-danger',
    badge: 'danger',
  },
  shared_word: { label: 'Mot partagé', line: 'stroke-jade', dot: 'bg-jade', badge: 'success' },
  curriculum_neighbor: {
    label: 'Voisin du parcours',
    line: 'stroke-gold',
    dot: 'bg-gold',
    badge: 'warning',
  },
};

function nodePositions(
  nodes: KanjiMapNodeDto[],
  centerId: string,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>([[centerId, { x: 50, y: 50 }]]);
  const surrounding = nodes.filter((node) => node.id !== centerId);
  for (const [index, node] of surrounding.entries()) {
    const angle = -Math.PI / 2 + (index / surrounding.length) * Math.PI * 2;
    const radius = surrounding.length > 12 ? 39 : 34;
    positions.set(node.id, { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius });
  }
  return positions;
}

export function KanjiMapPage() {
  const { literal = '' } = useParams();
  const [enabledTypes, setEnabledTypes] = useState<Record<KanjiMapLinkType, boolean>>({
    shared_component: true,
    visual_confusion: true,
    shared_word: true,
    curriculum_neighbor: true,
  });
  const map = useQuery({
    queryKey: ['kanji', literal, 'map'],
    queryFn: () => fetchKanjiMap(literal),
    enabled: literal.length > 0,
  });

  if (map.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 max-w-2xl" />
        <Skeleton className="h-[30rem] rounded-3xl" />
      </div>
    );
  }
  if (map.isError || !map.data) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <ErrorState
          title="Carte indisponible"
          description="Ce kanji n'est pas disponible dans le parcours publié."
        />
        <div className="mt-6 text-center">
          <Button asChild variant="secondary">
            <Link to={`/kanji/${encodeURIComponent(literal)}`}>
              <ArrowLeft aria-hidden className="size-4" />
              Retour à la fiche
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const visibleLinks = map.data.links.filter((link) => enabledTypes[link.type]);
  const visibleNodeIds = new Set([map.data.centerId, ...visibleLinks.map((link) => link.targetId)]);
  const visibleNodes = map.data.nodes.filter((node) => visibleNodeIds.has(node.id));
  const positions = nodePositions(visibleNodes, map.data.centerId);
  const center = map.data.nodes.find((node) => node.id === map.data.centerId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow="Relations pédagogiques"
        title={
          <span className="flex items-center gap-3">
            Carte de {center?.literal ?? literal}
            <span className="font-jp text-4xl font-semibold text-accent">
              {center?.literal ?? literal}
            </span>
          </span>
        }
        description="Relations publiées entre composants, confusions, mots et voisins du parcours. La disposition est calculée sur cet appareil."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to={`/kanji/${encodeURIComponent(literal)}`}>
              <ArrowLeft aria-hidden className="size-4" />
              Fiche kanji
            </Link>
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Network aria-hidden className="size-5 text-accent" />
              Filtres de relations
            </h2>
            <p className="mt-1 text-sm text-muted">
              {visibleNodes.length} nœuds affichés sur {map.data.limit} maximum.
            </p>
          </div>
          <Badge>{visibleLinks.length} liens</Badge>
        </div>
        <fieldset className="mt-5 flex flex-wrap gap-2">
          <legend className="sr-only">Types de relation affichés</legend>
          {(Object.keys(RELATION_META) as KanjiMapLinkType[]).map((type) => {
            const meta = RELATION_META[type];
            const active = enabledTypes[type];
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setEnabledTypes((current) => ({ ...current, [type]: !current[type] }))
                }
                className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-line-strong bg-surface-3 text-ink'
                    : 'border-line bg-surface-2 text-muted'
                }`}
              >
                <span aria-hidden className={`mr-2 inline-block size-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </button>
            );
          })}
        </fieldset>
      </Card>

      <section aria-labelledby="carte-graphique">
        <h2 id="carte-graphique" className="sr-only">
          Carte graphique des relations
        </h2>
        <div className="relative min-h-[30rem] overflow-hidden rounded-3xl border border-line bg-surface shadow-1 sm:min-h-[36rem]">
          <svg
            role="img"
            aria-label="Carte graphique des relations, détaillées dans la liste ci-dessous"
            className="absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <title>Liens entre les kanji publiés</title>
            {visibleLinks.map((link) => {
              const position = positions.get(link.targetId);
              if (!position) {
                return null;
              }
              return (
                <line
                  key={`${link.targetId}-${link.type}`}
                  x1="50"
                  y1="50"
                  x2={position.x}
                  y2={position.y}
                  className={`${RELATION_META[link.type].line} stroke-[0.35] opacity-70`}
                  strokeDasharray={link.type === 'visual_confusion' ? '1.2 0.8' : undefined}
                />
              );
            })}
          </svg>
          {visibleNodes.map((node) => {
            const position = positions.get(node.id);
            if (!position) {
              return null;
            }
            const isCenter = node.id === map.data.centerId;
            return (
              <Link
                key={node.id}
                to={`/kanji/${encodeURIComponent(node.literal)}`}
                aria-label={`${isCenter ? 'Centre de la carte' : 'Voir'} ${node.literal}, ${node.primaryMeaning ?? 'sens non renseigné'}, ${Math.round(node.overallScore * 100)} % de maîtrise, ${node.status}`}
                className={`absolute flex min-h-16 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border px-2 text-center shadow-1 transition-all hover:z-10 hover:scale-105 focus:z-10 ${
                  isCenter
                    ? 'border-accent bg-accent text-white shadow-glow'
                    : 'border-line-strong bg-surface-2 text-ink hover:border-accent'
                }`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
              >
                <span className="font-jp text-3xl font-semibold leading-none">{node.literal}</span>
                <span
                  className={`mt-1 line-clamp-1 text-[0.6875rem] font-semibold ${isCenter ? 'text-white/80' : 'text-muted'}`}
                >
                  {node.primaryMeaning ?? '—'} · {Math.round(node.overallScore * 100)}%
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          Chaque nœud est un lien vers sa fiche. Les états et pourcentages accompagnent les couleurs
          de progression.
        </p>
      </section>

      <section aria-labelledby="liste-relations">
        <div className="flex items-center gap-2">
          <GitFork aria-hidden className="size-5 text-accent" />
          <h2 id="liste-relations" className="text-lg font-bold text-ink">
            Liste des relations
          </h2>
        </div>
        {visibleLinks.length > 0 ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleLinks.map((link) => {
              const target = map.data.nodes.find((node) => node.id === link.targetId);
              if (!target) {
                return null;
              }
              const meta = RELATION_META[link.type];
              return (
                <li key={`${link.targetId}-${link.type}`}>
                  <Link
                    to={`/kanji/${encodeURIComponent(target.literal)}`}
                    className="flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-1"
                  >
                    <span className="font-jp text-4xl text-ink">{target.literal}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={meta.badge}>{meta.label}</Badge>
                        <StatusBadge status={target.status} />
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-ink-soft">
                        {link.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {target.primaryMeaning ?? 'Sens non renseigné'} · maîtrise{' '}
                        {Math.round(target.overallScore * 100)} % · source{' '}
                        {link.provenance.sourceId ?? 'non renseignée'}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
            Aucun lien ne correspond aux filtres actifs.
          </p>
        )}
      </section>
    </div>
  );
}
