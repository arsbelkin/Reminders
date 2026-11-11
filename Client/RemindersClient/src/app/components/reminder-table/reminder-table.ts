import { Component, computed, input, model } from '@angular/core';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';

type SortColumn = 'title' | 'categoryName' | 'priority' | 'isCompleted';

export interface ReminderTableSort {
  column: SortColumn;
  direction: 'ascending' | 'descending';
}

@Component({
  selector: 'app-reminder-table',
  templateUrl: './reminder-table.html',
  styleUrl: './reminder-table.css',
})
export class ReminderTable {
  readonly reminders = input.required<ReminderListViewDto[]>();
  readonly sorting = model<ReminderTableSort | null>(null);
  readonly priorityLabels = PRIORITY_LABELS;
  readonly columns = [
    { key: 'title', label: 'Название' },
    { key: 'categoryName', label: 'Категория' },
    { key: 'priority', label: 'Приоритет' },
    { key: 'isCompleted', label: 'Статус' },
  ] as const;

  private readonly collator = new Intl.Collator('ru', { sensitivity: 'accent', numeric: true });

  readonly sortedReminders = computed(() => {
    const reminders = this.reminders();
    const sorting = this.sorting();

    if (!sorting) {
      return reminders;
    }

    const direction = sorting.direction === 'ascending' ? 1 : -1;
    return [...reminders].sort((left, right) =>
      direction * this.compare(left, right, sorting.column),
    );
  });

  sortBy(column: SortColumn): void {
    this.sorting.update((current) => ({
      column,
      direction: current?.column === column && current.direction === 'ascending'
        ? 'descending'
        : 'ascending',
    }));
  }

  sortHint(column: SortColumn): string {
    const current = this.sorting();
    return current?.column === column && current.direction === 'ascending'
      ? 'Сортировать по убыванию'
      : 'Сортировать по возрастанию';
  }

  private compare(left: ReminderListViewDto, right: ReminderListViewDto, column: SortColumn): number {
    if (column === 'priority' || column === 'isCompleted') {
      return (left[column] ?? 0) - (right[column] ?? 0);
    }

    const fallback = column === 'title' ? 'Без названия' : 'Без категории';
    return this.collator.compare(left[column] || fallback, right[column] || fallback);
  }
}
