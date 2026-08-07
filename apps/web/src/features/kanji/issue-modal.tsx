import { Button, Field, Modal, Textarea, useToast } from '@kanjipath/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { createIssue } from '../content/api';

export function IssueModal({
  literal,
  open,
  onOpenChange,
}: {
  literal: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      createIssue({ subjectType: 'kanji', subjectRef: literal, message: message.trim() }),
    onSuccess: () => {
      toast('Merci, votre signalement a bien été transmis.', 'success');
      setMessage('');
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Signaler un problème sur ${literal}`}
      description="Erreur de sens, de lecture, de tracé ou de contenu : décrivez le problème."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (message.trim().length >= 10) {
            submit.mutate();
          }
        }}
        className="flex flex-col gap-4"
      >
        <Field
          label="Description du problème"
          htmlFor="issue-message"
          hint="10 caractères minimum."
          error={
            submit.isError
              ? 'Envoi impossible pour le moment. Réessayez dans quelques instants.'
              : undefined
          }
        >
          <Textarea
            id="issue-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ex. : la lecture kun « たか.い » manque pour ce kanji…"
            required
            minLength={10}
            rows={4}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" loading={submit.isPending} disabled={message.trim().length < 10}>
            Envoyer le signalement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
