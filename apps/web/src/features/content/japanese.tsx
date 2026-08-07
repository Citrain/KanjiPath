import type { FuriganaMode, SentenceTokenDto } from '@kanjipath/contracts';
import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../settings/api';

const KANJI_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

export function useDisplaySettings() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  return {
    romajiEnabled: settings.data?.romajiEnabled ?? true,
    furiganaMode: (settings.data?.furiganaMode ?? 'always') as FuriganaMode,
  };
}

export function Furigana({
  text,
  reading,
  mode,
}: {
  text: string;
  reading: string | null;
  mode: FuriganaMode;
}) {
  if (!reading || mode === 'never' || !KANJI_RE.test(text)) {
    return <>{text}</>;
  }
  return (
    <ruby>
      {text}
      <rt>{reading}</rt>
    </ruby>
  );
}

export function romajiLine(tokens: SentenceTokenDto[]): string {
  return tokens
    .map((token) => token.romaji)
    .filter((romaji): romaji is string => Boolean(romaji))
    .join(' ');
}

export function SentenceView({
  tokens,
  japanese,
  highlight,
  romajiEnabled,
  furiganaMode,
  className,
}: {
  tokens: SentenceTokenDto[];
  japanese: string;
  highlight?: string;
  romajiEnabled: boolean;
  furiganaMode: FuriganaMode;
  className?: string;
}) {
  const romaji = romajiEnabled ? romajiLine(tokens) : '';
  const hoverClass = furiganaMode === 'hover' ? 'furigana-hover' : '';
  return (
    <div>
      <p className={`leading-relaxed text-ink ${hoverClass} ${className ?? 'text-lg'}`.trim()}>
        {tokens.length > 0
          ? tokens.map((token, index) => {
              const content = (
                <Furigana text={token.surface} reading={token.reading} mode={furiganaMode} />
              );
              if (highlight && token.surface.includes(highlight)) {
                return (
                  <mark
                    // biome-ignore lint/suspicious/noArrayIndexKey: tokens statiques, jamais réordonnés
                    key={`${token.surface}-${index}`}
                    className="rounded-md bg-accent-soft px-1 font-kanji text-accent"
                  >
                    {content}
                  </mark>
                );
              }
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: tokens statiques, jamais réordonnés
                <span key={`${token.surface}-${index}`} className="font-kanji">
                  {content}
                </span>
              );
            })
          : japanese}
      </p>
      {romaji ? <p className="mt-1 text-sm font-medium tracking-wide text-muted">{romaji}</p> : null}
    </div>
  );
}
