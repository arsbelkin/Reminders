import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { RemindersService } from '../../api/services';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { ReminderCard } from '../../components/reminder-card/reminder-card';
import { ReminderTable } from '../../components/reminder-table/reminder-table';

interface ReminderCategoryGroup {
  key: string;
  name: string;
  reminders: ReminderListViewDto[];
}

@Component({
  imports: [ReminderCard, ReminderTable],
  selector: 'app-reminders',
  styleUrl: './reminders.css',
  templateUrl: './reminders.html',
})
export class Reminders implements OnInit {
  private readonly remindersApi = inject(RemindersService);

  readonly reminders = signal<ReminderListViewDto[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly viewMode = signal<'cards' | 'table'>('cards');

  private readonly collapsedCategoryKeys = signal<ReadonlySet<string>>(new Set());

  readonly categoryGroups = computed(() => {
    const groups = new Map<string, ReminderCategoryGroup>();

    for (const reminder of this.reminders()) {
      const categoryId = reminder.categoryId?.trim();
      const categoryName = reminder.categoryName?.trim();
      const key = categoryId
        ? `id:${categoryId}`
        : categoryName
          ? `name:${categoryName}`
          : 'uncategorized';

      let group = groups.get(key);

      if (!group) {
        group = { key, name: categoryName || 'Без категории', reminders: [] };
        groups.set(key, group);
      }

      group.reminders.push(reminder);
    }

    return [...groups.values()];
  });

  ngOnInit(): void {
    this.loadReminders();
  }

  isCategoryCollapsed(key: string): boolean {
    return this.collapsedCategoryKeys().has(key);
  }

  toggleCategory(key: string): void {
    this.collapsedCategoryKeys.update((keys) => {
      const updated = new Set(keys);

      if (updated.has(key)) {
        updated.delete(key);
      } else {
        updated.add(key);
      }

      return updated;
    });
  }

  loadReminders(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.remindersApi
      .apiV1RemindersGet$Json()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (reminders) => {
          this.reminders.set(reminders);
        },
        error: (error) => {
          this.errorMessage.set(
            error.status === 401
              ? 'Войдите снова, чтобы загрузить напоминания.'
              : 'Не удалось загрузить напоминания.',
          );
        },
      });
  }
}
