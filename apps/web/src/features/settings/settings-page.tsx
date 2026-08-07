import type { FuriganaMode, JlptLevel } from '@kanjipath/contracts';
import { Button, Card, Segmented, Toggle } from '@kanjipath/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
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
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const [activeLevel, setActiveLevel] = useState<JlptLevel>('N5');
  const [dailyNewLimit, setDailyNewLimit] = useState(10);
  const [desiredRetention, setDesiredRetention] = useState(0.9);
  const [furiganaMode, setFuriganaMode] = useState<FuriganaMode>('always');
  const [romajiEnabled, setRomajiEnabled] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setActiveLevel(settings.data.activeLevel);
      setDailyNewLimit(settings.data.dailyNewLimit);
      setDesiredRetention(settings.data.desiredRetention);
      setFuriganaMode(settings.data.furiganaMode);
      setRomajiEnabled(settings.data.romajiEnabled);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      updateSettings({ activeLevel, dailyNewLimit, desiredRetention, furiganaMode, romajiEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  if (settings.isPending) {
    return <div className="shimmer mx-auto h-96 max-w-2xl rounded-3xl border border-line" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-2xl"
    >
      <h1 className="text-3xl font-extrabold tracking-tight">
        Pré<span className="gradient-text">férences</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Réglez votre expérience d'apprentissage.</p>

      <div className="mt-8 flex flex-col gap-5">
        <Card>
          <h2 className="text-lg font-bold">Apparence</h2>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Thème</p>
              <p className="text-sm text-muted">Encre (sombre) ou washi (clair).</p>
            </div>
            <Segmented
              ariaLabel="Thème"
              value={theme}
              options={[
                { value: 'dark', label: '🌙 Encre' },
                { value: 'light', label: '☀️ Washi' },
              ]}
              onChange={(next) => {
                setTheme(next);
                applyTheme(next);
              }}
            />
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Romaji</p>
              <p className="text-sm text-muted">Afficher les transcriptions en lettres latines.</p>
            </div>
            <Toggle checked={romajiEnabled} onChange={setRomajiEnabled} label="Activer le romaji" />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Furigana</p>
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
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Parcours</h2>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Niveau actif</p>
              <p className="text-sm text-muted">Les nouveaux kanji proposés en priorité.</p>
            </div>
            <Segmented
              ariaLabel="Niveau actif"
              value={activeLevel}
              options={LEVEL_OPTIONS}
              onChange={setActiveLevel}
            />
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Nouveaux kanji par jour</p>
              <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-extrabold text-accent">
                {dailyNewLimit}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={dailyNewLimit}
              onChange={(event) => setDailyNewLimit(Number(event.target.value))}
              className="mt-3 w-full accent-[var(--accent)]"
              aria-label="Nouveaux kanji par jour"
            />
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Rétention visée</p>
              <span className="rounded-lg bg-sky-soft px-2.5 py-1 text-sm font-extrabold text-sky">
                {Math.round(desiredRetention * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.7}
              max={0.99}
              step={0.01}
              value={desiredRetention}
              onChange={(event) => setDesiredRetention(Number(event.target.value))}
              className="mt-3 w-full accent-[var(--sky)]"
              aria-label="Rétention visée"
            />
            <p className="mt-2 text-xs text-muted">
              Plus la rétention est élevée, plus les révisions sont fréquentes.
            </p>
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer mes préférences'}
          </Button>
          {saved ? <span className="animate-pop font-semibold text-jade">✓ Enregistré</span> : null}
          {save.isError ? (
            <span className="text-sm font-medium text-danger">Enregistrement impossible.</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
