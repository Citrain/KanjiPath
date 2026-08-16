import type { ImmersionAid, ImmersionHelpLevel } from '@kanjipath/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  effectiveHiddenAids,
  IMMERSION_AID_LABELS,
  resolveImmersionLevel,
} from '../../lib/immersion';
import { fetchSettings } from '../settings/api';

export interface ImmersionContextValue {
  enabled: boolean;
  level: ImmersionHelpLevel;
  savedLevel: ImmersionHelpLevel | null;
  recommendedLevel: ImmersionHelpLevel;
  recommendedReasons: string[];
  overrideLevel: ImmersionHelpLevel | null;
  hiddenAids: ImmersionAid[];
  announcement: string | null;
  isHidden(aid: ImmersionAid): boolean;
  reveal(aid: ImmersionAid): void;
  revealAll(): void;
  setOverrideLevel(level: ImmersionHelpLevel | null): void;
}

const ImmersionContext = createContext<ImmersionContextValue | null>(null);

export function ImmersionProvider({ children }: { children: ReactNode }) {
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const [revealed, setRevealed] = useState<ReadonlySet<ImmersionAid>>(new Set());
  const [overrideLevel, setOverrideLevel] = useState<ImmersionHelpLevel | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const enabled = settings.data?.immersionEnabled ?? false;
  const savedLevel = settings.data?.immersionHelpLevel ?? null;
  const recommendedLevel = settings.data?.immersionRecommendation.level ?? 0;
  const recommendedReasons = settings.data?.immersionRecommendation.reasons ?? [];

  const level = resolveImmersionLevel({ overrideLevel, savedLevel, recommendedLevel });
  const hiddenAids = useMemo(
    () => effectiveHiddenAids({ enabled, level, revealed }),
    [enabled, level, revealed],
  );

  const isHidden = useCallback((aid: ImmersionAid) => hiddenAids.includes(aid), [hiddenAids]);

  const reveal = useCallback((aid: ImmersionAid) => {
    setRevealed((current) => new Set([...current, aid]));
    setAnnouncement(IMMERSION_AID_LABELS[aid].revealed);
  }, []);

  const revealAll = useCallback(() => {
    setRevealed(new Set(['translation', 'romaji', 'furigana']));
    setAnnouncement('Toutes les aides sont affichées.');
  }, []);

  const changeOverride = useCallback((value: ImmersionHelpLevel | null) => {
    setOverrideLevel(value);
    setRevealed(new Set());
    setAnnouncement(null);
  }, []);

  const value = useMemo<ImmersionContextValue>(
    () => ({
      enabled,
      level,
      savedLevel,
      recommendedLevel,
      recommendedReasons,
      overrideLevel,
      hiddenAids,
      announcement,
      isHidden,
      reveal,
      revealAll,
      setOverrideLevel: changeOverride,
    }),
    [
      enabled,
      level,
      savedLevel,
      recommendedLevel,
      recommendedReasons,
      overrideLevel,
      hiddenAids,
      announcement,
      isHidden,
      reveal,
      revealAll,
      changeOverride,
    ],
  );

  return <ImmersionContext.Provider value={value}>{children}</ImmersionContext.Provider>;
}

export function useImmersion(): ImmersionContextValue {
  const context = useContext(ImmersionContext);
  if (!context) {
    throw new Error('useImmersion doit être utilisé sous <ImmersionProvider>');
  }
  return context;
}
