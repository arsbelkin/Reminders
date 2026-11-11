import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { RemindersService } from '../../api/services';
import { ReminderInfoViewDto } from '../../api/models/reminder-info-view-dto';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; reminder: ReminderInfoViewDto }
  | { kind: 'error'; title: string; message: string; retry: boolean };

@Component({
  selector: 'app-reminder-details',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './reminder-details.html',
  styleUrls: [
    '../../shared/reminder-badges.css',
    './reminder-details.css',
    './reminder-details-navigation.css',
  ],
})
export class ReminderDetails {
  private readonly api = inject(RemindersService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private readonly routeId = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    distinctUntilChanged(),
  );
  private readonly navigationDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('navigationDialog');
  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  readonly priorityLabels = PRIORITY_LABELS;
  readonly reminderId = toSignal(this.routeId, {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  readonly state = toSignal(
    combineLatest([this.routeId, this.reload.pipe(startWith(undefined))]).pipe(
      switchMap(([id]) =>
        this.api.apiV1RemindersReminderIdGet$Json({ reminderId: id }).pipe(
          map((reminder) => ({ kind: 'ready', reminder }) as DetailState),
          catchError((error: { status?: number }) =>
            of<DetailState>(
              error.status === 404 || error.status === 400
                ? {
                    kind: 'error',
                    title: 'Напоминание не найдено',
                    message: 'Возможно, оно удалено или у вас нет доступа к нему.',
                    retry: false,
                  }
                : error.status === 403
                  ? {
                      kind: 'error',
                      title: 'Нет доступа к напоминанию',
                      message: 'Откройте другое напоминание или вернитесь к своему списку.',
                      retry: false,
                    }
                  : {
                      kind: 'error',
                      title: 'Не удалось загрузить напоминание',
                      message: 'Проверьте соединение и попробуйте ещё раз.',
                      retry: true,
                    },
            ),
          ),
          startWith<DetailState>({ kind: 'loading' }),
        ),
      ),
    ),
    { initialValue: { kind: 'loading' } as DetailState },
  );

  readonly navigationReminders = signal<ReminderListViewDto[]>([]);
  readonly navigationLoading = signal(false);
  readonly navigationError = signal<string | null>(null);
  private navigationLoaded = false;
  readonly navigationSearch = new FormControl('', { nonNullable: true });
  private readonly searchText = toSignal(this.navigationSearch.valueChanges, { initialValue: '' });
  readonly filteredReminders = computed(() => {
    const search = this.searchText().trim().toLocaleLowerCase('ru');
    return this.navigationReminders().filter(
      (reminder) =>
        reminder.id && (reminder.title || 'Без названия').toLocaleLowerCase('ru').includes(search),
    );
  });

  retry(): void {
    this.reload.next();
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Не указана';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Не указана' : this.dateFormatter.format(date);
  }

  openNavigation(): void {
    this.navigationSearch.reset();
    this.navigationDialog().nativeElement.showModal();
    if (!this.navigationLoaded) this.loadNavigation();
  }

  closeNavigation(): void {
    this.navigationDialog().nativeElement.close();
  }

  loadNavigation(): void {
    if (this.navigationLoading()) return;
    this.navigationLoading.set(true);
    this.navigationError.set(null);
    this.api
      .apiV1RemindersGet$Json()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.navigationLoading.set(false)),
      )
      .subscribe({
        next: (reminders) => {
          this.navigationReminders.set(reminders);
          this.navigationLoaded = true;
        },
        error: () => this.navigationError.set('Не удалось загрузить список напоминаний.'),
      });
  }
}
