import type { AudioResourceDto } from '@kanjipath/contracts';
import { Button } from '@kanjipath/ui';
import { LoaderCircle, Volume2 } from 'lucide-react';
import { useRef, useState } from 'react';

export function AudioButton({ audio, label }: { audio: AudioResourceDto; label: string }) {
  const player = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function play() {
    setState('loading');
    const element = player.current ?? new Audio(`/api/v1${audio.url}`);
    player.current = element;
    element.onended = () => setState('idle');
    element.onerror = () => setState('error');
    try {
      await element.play();
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" size="sm" loading={state === 'loading'} onClick={play}>
        {state === 'loading' ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <Volume2 aria-hidden className="size-4" />
        )}
        {label}
      </Button>
      {state === 'error' ? (
        <span role="alert" className="text-xs font-medium text-danger">
          Lecture audio impossible.
        </span>
      ) : null}
      {audio.attribution ? <span className="text-xs text-muted">{audio.attribution}</span> : null}
    </span>
  );
}
