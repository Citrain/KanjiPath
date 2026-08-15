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
  onTokenClick,
  activeTokenId,
}: {
  tokens: SentenceTokenDto[];
  japanese: string;
  highlight?: string;
  romajiEnabled: boolean;
  furiganaMode: FuriganaMode;
  className?: string;
  onTokenClick?: (token: SentenceTokenDto) => void;
  activeTokenId?: string | null;
}) {
  const romaji = romajiEnabled ? romajiLine(tokens) : '';
  const hoverClass = furiganaMode === 'hover' ? 'furigana-hover' : '';
  return (
    <div>
      <p
        className={`leading-[1.9] text-ink ${hoverClass} ${className ?? 'text-[1.375rem]'}`.trim()}
      >
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
                    className="rounded-md bg-accent-soft px-1 font-jp text-accent"
                  >
                    {content}
                  </mark>
                );
              }
              if (onTokenClick) {
                const active =
                  activeTokenId !== null && 'id' in token && token.id === activeTokenId;
                return (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: tokens statiques, jamais réordonnés
                    key={`${token.surface}-${index}`}
                    type="button"
                    onClick={() => onTokenClick(token)}
                    aria-label={`Consulter « ${token.surface} »`}
                    className={`cursor-pointer rounded-md font-jp transition-colors duration-150 ${
                      active
                        ? 'bg-accent-soft px-1 text-accent'
                        : 'px-0.5 text-ink hover:bg-accent-soft hover:text-accent'
                    }`}
                  >
                    {content}
                  </button>
                );
              }
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: tokens statiques, jamais réordonnés
                <span key={`${token.surface}-${index}`} className="font-jp">
                  {content}
                </span>
              );
            })
          : japanese}
      </p>
      {romaji ? (
        <p className="mt-1.5 text-[0.9375rem] font-medium tracking-wide text-muted">{romaji}</p>
      ) : null}
    </div>
  );
}

