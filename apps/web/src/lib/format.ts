export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function formatDateShort(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export function todayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) {
    return 'Bonne nuit';
  }
  if (hour < 18) {
    return 'Bonjour';
  }
  return 'Bonsoir';
}

export function todayLong(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
