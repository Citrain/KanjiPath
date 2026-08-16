import type { ShadowingSegmentStatus } from '@kanjipath/contracts';

export const SHADOWING_DISCLAIMER =
  'Aide à la correspondance entre votre transcription et la lecture cible : elle ne mesure ni la prononciation, ni l’accent, ni le rythme, ni l’intonation.';

export const SHADOWING_PRACTICE_NOTE =
  'Entraînement libre : vos essais n’ont aucun effet sur les cartes, les scores FSRS, la progression des kanji ou le curriculum.';

export function segmentStatusLabel(status: ShadowingSegmentStatus): string {
  return status === 'matched' ? 'Correspondance trouvée' : 'Segment à réécouter';
}

export function segmentStatusShort(status: ShadowingSegmentStatus): string {
  return status === 'matched' ? 'Correspond' : 'À réécouter';
}

export function emptyTranscriptLabel(): string {
  return 'Aucune parole détectée. Vérifiez votre micro puis réessayez — aucun résultat n’a été produit.';
}

export function sttUnavailableLabel(message: string): string {
  return `${message} Vous pouvez continuer à écouter les phrases, mais la comparaison est désactivée.`;
}

export function ttsUnavailableLabel(message: string): string {
  return `${message}`;
}

export function savedResultLabel(): string {
  return 'Résultat conservé dans votre historique personnel.';
}

export function repeatEncouragementLabel(matched: boolean): string {
  return matched
    ? 'Correspondance complète avec la lecture cible. Répétez autant que vous voulez, sans conséquence sur votre progression.'
    : 'Répétez librement : chaque essai est un entraînement, sans note ni effet sur votre progression.';
}
