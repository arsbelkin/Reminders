const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
export const NOTIFICATION_RECURRENCY_LABELS: Readonly<Record<number, string>> = {
  0: 'Без повторения', 1: 'Ежедневно', 7: 'Еженедельно', 31: 'Ежемесячно', 355: 'Ежегодно',
};

export function formatNotificationDate(value: string | undefined): string {
  if (!value) return 'Не указано';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Не указано' : dateFormatter.format(date);
}

export function formatNotificationRecurrency(value: number | undefined): string {
  return value === undefined ? 'Не указано' : NOTIFICATION_RECURRENCY_LABELS[value] ?? 'Неизвестная периодичность';
}
