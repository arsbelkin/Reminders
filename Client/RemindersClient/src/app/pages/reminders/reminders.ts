import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { ReminderCard } from '../../components/reminder-card/reminder-card';
import { ReminderTable, ReminderTableSort } from '../../components/reminder-table/reminder-table';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CategoriesService, RemindersService } from '../../api/services';
import { CategoryListViewDto } from '../../api/models/category-list-view-dto';
import {
  ReminderFilters,
  ReminderFiltersValue,
} from '../../components/reminder-filters/reminder-filters';

interface ReminderCategoryGroup {
  key: string;
  name: string;
  reminders: ReminderListViewDto[];
}

@Component({
  imports: [ReminderCard, ReminderTable, ReactiveFormsModule, ReminderFilters],
  selector: 'app-reminders',
  styleUrls: ['./reminders.css', './reminders-search.css'],
  templateUrl: './reminders.html',
})
export class Reminders implements OnInit {
  private readonly remindersApi = inject(RemindersService);

  readonly searchControl = new FormControl('', {
    nonNullable: true,
  });
  readonly searchForm = new FormGroup({
    searchText: this.searchControl,
  });

  readonly reminders = signal<ReminderListViewDto[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly viewMode = signal<'cards' | 'table'>('cards');
  readonly tableSort = signal<ReminderTableSort | null>(null);

  private readonly collapsedCategoryKeys = signal<ReadonlySet<string>>(new Set());

  private readonly categoriesApi = inject(CategoriesService);

  readonly categories = signal<CategoryListViewDto[]>([]);
  readonly categoriesLoading = signal(false);
  readonly categoriesError = signal<string | null>(null);

  readonly appliedFilters = signal<ReminderFiltersValue>({
    categoryIds: [],
    priorityTypes: [],
    completedStatus: null,
  });

  readonly activeFiltersCount = computed(() => {
    const filters = this.appliedFilters();
    return filters.categoryIds.length + filters.priorityTypes.length + (filters.completedStatus !== null ? 1 : 0);
  });

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
    this.loadCategories();
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
      .apiV1RemindersSearchPost$Json({
        body: {
          ...this.appliedFilters(),
          searchText: this.searchControl.value.trim() || null,
        },
      })
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

  loadCategories(): void {
    if (this.categoriesLoading()) {
      return;
    }

    this.categoriesLoading.set(true);
    this.categoriesError.set(null);

    this.categoriesApi
      .apiV1CategoriesGet$Json()
      .pipe(finalize(() => this.categoriesLoading.set(false)))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
        },
        error: () => {
          this.categoriesError.set('Не удалось загрузить категории.');
        },
      });
  }

  applyFilters(values: ReminderFiltersValue): void {
    if (this.isLoading()) {
      return;
    }

    this.appliedFilters.set(values);
    this.loadReminders();
  }
}
