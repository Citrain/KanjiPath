import { Button, Field, Modal, useToast } from '@kanjipath/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus } from 'lucide-react';
import { useState } from 'react';
import { savePersonalVocabulary } from './api';

type SaveSource =
  | { origin: 'published'; vocabularyId: string; textId?: string; tokenId?: string }
  | { origin: 'conversation'; conversationTurnId: string };

export function SaveVocabularyButton({ source }: { source: SaveSource }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState('');
  const [reading, setReading] = useState('');
  const [meaningFr, setMeaningFr] = useState('');
  const save = useMutation({
    mutationFn: () =>
      source.origin === 'published'
        ? savePersonalVocabulary(source)
        : savePersonalVocabulary({
            origin: 'conversation',
            conversationTurnId: source.conversationTurnId,
            surface: surface.trim(),
            reading: reading.trim() || undefined,
            meaningFr: meaningFr.trim() || undefined,
          }),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['personal-vocabulary'] });
      toast(
        entry.archivedAt ? 'Mot déjà présent dans les archives.' : 'Mot enregistré dans le carnet.',
        'success',
      );
      setOpen(false);
      setSurface('');
      setReading('');
      setMeaningFr('');
    },
  });

  if (source.origin === 'published') {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        <BookmarkPlus aria-hidden className="size-4" /> Enregistrer
      </Button>
    );
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <BookmarkPlus aria-hidden className="size-4" /> Enregistrer un mot
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Ajouter au carnet"
        description="Le mot et son extrait restent privés, associés uniquement à votre conversation."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (surface.trim()) save.mutate();
          }}
        >
          <Field
            label="Mot"
            htmlFor="personal-word"
            error={save.isError ? 'Enregistrement impossible.' : undefined}
          >
            <input
              id="personal-word"
              value={surface}
              onChange={(event) => setSurface(event.target.value)}
              maxLength={80}
              required
              lang="ja"
              className="h-11 rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-accent"
            />
          </Field>
          <Field label="Lecture (facultative)" htmlFor="personal-reading">
            <input
              id="personal-reading"
              value={reading}
              onChange={(event) => setReading(event.target.value)}
              maxLength={80}
              lang="ja"
              className="h-11 rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-accent"
            />
          </Field>
          <Field label="Sens affiché (facultatif)" htmlFor="personal-meaning">
            <input
              id="personal-meaning"
              value={meaningFr}
              onChange={(event) => setMeaningFr(event.target.value)}
              maxLength={300}
              className="h-11 rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-accent"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!surface.trim()}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
