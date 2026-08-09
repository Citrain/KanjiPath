import type { ConversationCorrection } from '@kanjipath/contracts';
import { Check, Languages, Volume2 } from 'lucide-react';

export function CorrectionCard({ correction }: { correction: ConversationCorrection | null }) {
  if (!correction) {
    return (
      <div className="ml-10 flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
        <span className="flex size-5 items-center justify-center rounded-full bg-jade-soft text-jade">
          <Check aria-hidden className="size-3" />
        </span>
        Phrase correcte.
      </div>
    );
  }
  return (
    <section className="ml-10 rounded-xl border border-gold/30 bg-gold-soft p-3 text-sm text-ink-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-bold text-gold">
          <Languages aria-hidden className="size-4" /> Correction{' '}
          {correction.severity === 'important' ? 'importante' : 'à retenir'}
        </p>
        <button
          type="button"
          aria-label="Écouter l’explication de correction en français"
          className="rounded-lg p-1 text-gold hover:bg-gold/15"
          onClick={() => speakFrench(correction.explanationFr)}
        >
          <Volume2 aria-hidden className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p>
          <span className="block text-xs font-semibold text-muted">Vous avez dit</span>
          {correction.original}
        </p>
        <p>
          <span className="block text-xs font-semibold text-muted">À dire</span>
          <span className="font-jp text-ink">{correction.corrected}</span>
        </p>
      </div>
      <p className="mt-3 border-t border-gold/20 pt-2">{correction.explanationFr}</p>
    </section>
  );
}

function speakFrench(text: string): void {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  window.speechSynthesis.speak(utterance);
}
