import type { FuriganaMode, ImmersionHelpLevel, JlptLevel } from '@kanjipath/contracts';
import {
  Button,
  Card,
  PageHeader,
  SectionHeader,
  Segmented,
  Skeleton,
  Slider,
  Toggle,
  useToast,
} from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  IMMERSION_HELP_LEVELS,
  IMMERSION_LEVEL_DESCRIPTIONS,
  IMMERSION_LEVEL_LABELS,
} from '../../lib/immersion';
import { applyTheme, getStoredTheme, type Theme } from '../../lib/theme';
import { fetchSettings, updateSettings } from './api';

const LEVEL_OPTIONS = [
  { value: 'N5' as JlptLevel, label: 'N5' },
  { value: 'N4' as JlptLevel, label: 'N4' },
  { value: 'N3' as JlptLevel, label: 'N3' },
  { value: 'N2' as JlptLevel, label: 'N2' },
  { value: 'N1' as JlptLevel, label: 'N1' },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const [activeLevel, setActiveLevel] = useState<JlptLevel>('N5');
  const [dailyNewLimit, setDailyNewLimit] = useState(10);
  const [reviewLimit, setReviewLimit] = useState(40);
  const [autoBalance, setAutoBalance] = useState(true);
  const [kanaInputEnabled, setKanaInputEnabled] = useState(true);
  const [desiredRetention, setDesiredRetention] = useState(0.9);
  const [furiganaMode, setFuriganaMode] = useState<FuriganaMode>('always');
  const [romajiEnabled, setRomajiEnabled] = useState(true);
  const [immersionEnabled, setImmersionEnabled] = useState(false);
  const [immersionHelpLevel, setImmersionHelpLevel] = useState<ImmersionHelpLevel | 'recommended'>(
    'recommended',
  );
  const [theme, setTheme] = useState<Theme>(getStoredTheme());

  useEffect(() => {
    if (settings.data) {
      setActiveLevel(settings.data.activeLevel);
      setDailyNewLimit(settings.data.dailyNewLimit);
      setReviewLimit(settings.data.reviewLimit);
      setAutoBalance(settings.data.autoBalance);
      setKanaInputEnabled(settings.data.kanaInputEnabled);
      setDesiredRetention(settings.data.desiredRetention);
      setFuriganaMode(settings.data.furiganaMode);
      setRomajiEnabled(settings.data.romajiEnabled);
      setImmersionEnabled(settings.data.immersionEnabled);
      setImmersionHelpLevel(settings.data.immersionHelpLevel ?? 'recommended');
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        activeLevel,
        dailyNewLimit,
        reviewLimit,
        autoBalance,
        kanaInputEnabled,
        desiredRetention,
        furiganaMode,
        romajiEnabled,
        immersionEnabled,
        immersionHelpLevel: immersionHelpLevel === 'recommended' ? null : immersionHelpLevel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('Préférences enregistrées.', 'success');
    },
    onError: () => {
      toast('Enregistrement impossible. Réessayez.', 'error');
    },
  });

  if (settings.isPending) {
    return (
      <div>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
        <Skeleton className="mt-5 h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Votre expérience"
        title="Préférences"
        description="Réglez l'apparence et le rythme de votre apprentissage."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Apparence" />
          <div className="mt-5 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Thème</p>
                <p className="text-sm text-muted">Encre (sombre) ou washi (clair).</p>
              </div>
              <Segmented
                ariaLabel="Thème"
                value={theme}
                options={[
                  {
                    value: 'dark',
                    label: (
                      <span className="flex items-center gap-1.5">
                        <Moon aria-hidden className="size-3.5" />
                        Encre
                      </span>
                    ),
                  },
                  {
                    value: 'light',
                    label: (
                      <span className="flex items-center gap-1.5">
                        <Sun aria-hidden className="size-3.5" />
                        Washi
                      </span>
                    ),
                  },
                ]}
                onChange={(next) => {
                  setTheme(next);
                  applyTheme(next);
                }}
              />
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Romaji</p>
                <p className="text-sm text-muted">
                  Afficher les transcriptions en lettres latines.
                </p>
              </div>
              <Toggle
                checked={romajiEnabled}
                onChange={setRomajiEnabled}
                label="Activer le romaji"
              />
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Furigana</p>
                <p className="text-sm text-muted">Lecture affichée au-dessus des kanji.</p>
              </div>
              <Segmented
                ariaLabel="Mode furigana"
                value={furiganaMode}
                options={[
                  { value: 'always', label: 'Toujours' },
                  { value: 'hover', label: 'Au survol' },
                  { value: 'never', label: 'Jamais' },
                ]}
                onChange={setFuriganaMode}
              />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Mode immersion" />
          <div className="mt-5 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Activer le mode immersion</p>
                <p className="text-sm text-muted">
                  Masque par défaut traduction, romaji et furigana dans la lecture, les fiches, les
                  exercices et la conversation. Chaque aide reste révélable à tout moment, sans
                  changer vos réponses ni votre progression.
                </p>
              </div>
              <Toggle
                checked={immersionEnabled}
                onChange={setImmersionEnabled}
                label="Activer le mode immersion"
              />
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-ink">Niveau d'aide</p>
              <Segmented
                ariaLabel="Niveau d'aide du mode immersion"
                value={String(immersionHelpLevel)}
                options={[
                  { value: 'recommended', label: 'Recommandé' },
                  ...IMMERSION_HELP_LEVELS.map((level) => ({
                    value: String(level),
                    label: IMMERSION_LEVEL_LABELS[level],
                  })),
                ]}
                onChange={(next) =>
                  setImmersionHelpLevel(
                    next === 'recommended' ? 'recommended' : (Number(next) as ImmersionHelpLevel),
                  )
                }
              />
              <p className="text-sm text-muted">
                {immersionHelpLevel === 'recommended'
                  ? "Le niveau recommandé évolue avec votre progression : vous pouvez toujours le remplacer dans la séance, ou revenir immédiatement à l'affichage complet."
                  : IMMERSION_LEVEL_DESCRIPTIONS[immersionHelpLevel]}
              </p>
            </div>
            {settings.data ? (
              <div className="rounded-xl border border-line bg-surface-2 p-4">
                <p className="text-sm font-bold text-ink">
                  Niveau recommandé actuellement :{' '}
                  {IMMERSION_LEVEL_LABELS[settings.data.immersionRecommendation.level]}
                </p>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                  {settings.data.immersionRecommendation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Parcours" />
          <div className="mt-5 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Niveau actif</p>
                <p className="text-sm text-muted">Les nouveaux kanji proposés en priorité.</p>
              </div>
              <Segmented
                ariaLabel="Niveau actif"
                value={activeLevel}
                options={LEVEL_OPTIONS}
                onChange={setActiveLevel}
              />
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Saisie en japonais</p>
                <p className="text-sm text-muted">
                  Inclure les questions qui demandent d'écrire en kana, dans tous les modes.
                </p>
              </div>
              <Toggle
                checked={kanaInputEnabled}
                onChange={setKanaInputEnabled}
                label="Inclure la saisie en japonais"
              />
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="daily-limit" className="font-semibold text-ink">
                  Nouveaux kanji par jour
                </label>
                <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-extrabold tabular-nums text-accent">
                  {dailyNewLimit}
                </span>
              </div>
              <Slider
                id="daily-limit"
                min={1}
                max={30}
                value={dailyNewLimit}
                onChange={setDailyNewLimit}
                className="mt-3"
              />
              <p className="mt-2 text-xs text-muted">
                Plus la limite est haute, plus le rythme d'apprentissage est intense.
              </p>
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="review-limit" className="font-semibold text-ink">
                  Révisions par session
                </label>
                <span className="rounded-lg bg-jade-soft px-2.5 py-1 text-sm font-extrabold tabular-nums text-jade">
                  {reviewLimit}
                </span>
              </div>
              <Slider
                id="review-limit"
                min={5}
                max={200}
                step={5}
                value={reviewLimit}
                onChange={setReviewLimit}
                className="mt-3"
              />
              <p className="mt-2 text-xs text-muted">
                Le nombre maximal de kanji déjà vus repris en priorité à chaque session.
              </p>
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Équilibrage automatique</p>
                <p className="text-sm text-muted">
                  Réduit les nouveaux kanji quand beaucoup de révisions sont dues.
                </p>
              </div>
              <Toggle
                checked={autoBalance}
                onChange={setAutoBalance}
                label="Équilibrer la charge"
              />
            </div>
            <div className="h-px bg-line" aria-hidden />
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="retention" className="font-semibold text-ink">
                  Rétention visée
                </label>
                <span className="rounded-lg bg-sky-soft px-2.5 py-1 text-sm font-extrabold tabular-nums text-sky">
                  {Math.round(desiredRetention * 100)}%
                </span>
              </div>
              <Slider
                id="retention"
                min={0.7}
                max={0.99}
                step={0.01}
                value={desiredRetention}
                onChange={setDesiredRetention}
                className="mt-3"
              />
              <p className="mt-2 text-xs text-muted">
                Plus la rétention est élevée, plus les révisions sont fréquentes.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-4 lg:col-span-2">
          <Button size="lg" loading={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer mes préférences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
