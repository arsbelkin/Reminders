import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { TokenStorageService } from '../../auth/token-storage.service';
import { ReminderEdit } from '../../components/reminder-edit/reminder-edit';
import {
  NotificationCreate,
  NotificationCreated,
} from '../../components/notification-create/notification-create';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; reminder: ReminderInfoViewDto }
  | { kind: 'error'; title: string; message: string; retry: boolean };

@Component({
  selector: 'app-reminder-details',
  imports: [RouterLink, ReactiveFormsModule, ReminderEdit, NotificationCreate],
  templateUrl: './reminder-details.html',
  styleUrls: [
    '../../shared/reminder-badges.css',
    '../../shared/details-page.css',
    '../../shared/details-navigation.css',
    './reminder-delete.css',
  ],
})
export class ReminderDetails {
  private readonly notificationWindow = viewChild.required<NotificationCreate>(
    'notificationCreateWindow',
  );
  readonly notificationCreated = signal<NotificationCreated | null>(null);

  onNotificationCreated(result: NotificationCreated): void {
    if (result.reminderId === this.reminderId()) this.notificationCreated.set(result);
  }
  private readonly editWindow = viewChild.required<ReminderEdit>('reminderEditWindow');
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
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

  readonly canDelete = computed(() => {
    const current = this.state();
    const userId = this.tokenStorage.userId();
    return (
      current.kind === 'ready' &&
      !!userId &&
      current.reminder.creatorId?.trim().toLowerCase() === userId
    );
  });
  readonly editableReminder = computed(() => {
    const current = this.state();
    return current.kind === 'ready' ? current.reminder : null;
  });

  onReminderSaved(id: string): void {
    this.navigationLoaded = false;
    if (id === this.reminderId()) this.reload.next();
  }
  readonly deleteTarget = signal<{ id: string; title: string } | null>(null);
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly isCompleting = signal(false);
  readonly completionError = signal<string | null>(null);
  readonly canComplete = computed(() => {
    const current = this.state();
    return this.canDelete() && current.kind === 'ready' && current.reminder.isCompleted === 0;
  });
  readonly canReopen = computed(() => {
    const current = this.state();
    return this.canDelete() && current.kind === 'ready' && current.reminder.isCompleted === 1;
  });

  completeReminder(): void {
    this.changeCompletion(false);
  }

  reopenReminder(): void {
    this.changeCompletion(true);
  }

  private changeCompletion(reopen: boolean): void {
    if (
      !(reopen ? this.canReopen() : this.canComplete()) ||
      this.isCompleting() ||
      this.isDeleting() ||
      this.editWindow().isSaving() ||
      this.notificationWindow().busy()
    )
      return;
    const id = this.reminderId();
    const ownerId = this.tokenStorage.userId();
    this.isCompleting.set(true);
    this.completionError.set(null);
    const request = reopen
      ? this.api.apiV1RemindersReminderIdReopenPost({ reminderId: id })
      : this.api.apiV1RemindersReminderIdCompletePost({ reminderId: id });
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isCompleting.set(false)),
      )
      .subscribe({
        next: () => {
          this.navigationReminders.update((items) =>
            reopen
              ? items.map((item) => (item.id === id ? { ...item, isCompleted: 0 } : item))
              : items.filter((item) => item.id !== id),
          );
          if (this.reminderId() === id && this.tokenStorage.userId() === ownerId) {
            this.reload.next();
          }
        },
        error: (error: { status?: number }) => {
          if (this.reminderId() !== id || this.tokenStorage.userId() !== ownerId) return;
          const action = reopen ? 'возобновить' : 'завершить';
          this.completionError.set(
            error.status === 403 || error.status === 404
              ? `Не удалось ${action} напоминание: оно удалено или у вас нет прав.`
              : `Не удалось ${action} напоминание. Попробуйте ещё раз.`,
          );
        },
      });
  }

  constructor() {
    effect(() => {
      this.reminderId();
      this.completionError.set(null);
      this.notificationCreated.set(null);
    });
    effect(() => {
      const target = this.deleteTarget();
      if (target && (target.id !== this.reminderId() || !this.canDelete())) {
        this.deleteDialog().nativeElement.close();
        this.deleteTarget.set(null);
        this.deleteError.set(null);
      }
    });
  }

  openDelete(): void {
    const current = this.state();
    if (
      this.isDeleting() ||
      this.isCompleting() ||
      this.editWindow().isSaving() ||
      this.notificationWindow().busy() ||
      !this.canDelete() ||
      current.kind !== 'ready'
    )
      return;
    this.deleteTarget.set({
      id: this.reminderId(),
      title: current.reminder.title || 'Без названия',
    });
    this.deleteError.set(null);
    this.deleteDialog().nativeElement.showModal();
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.deleteDialog().nativeElement.close();
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  onDeleteCancel(event: Event): void {
    if (this.isDeleting()) {
      event.preventDefault();
    } else {
      this.deleteTarget.set(null);
      this.deleteError.set(null);
    }
  }

  deleteReminder(): void {
    const target = this.deleteTarget();
    if (!target || this.isDeleting() || !this.canDelete() || target.id !== this.reminderId())
      return;
    const ownerId = this.tokenStorage.userId();
    this.isDeleting.set(true);
    this.deleteError.set(null);
    this.api
      .apiV1RemindersReminderIdDelete({ reminderId: target.id })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isDeleting.set(false)),
      )
      .subscribe({
        next: () => {
          this.deleteDialog().nativeElement.close();
          this.deleteTarget.set(null);
          this.navigationReminders.update((items) => items.filter((item) => item.id !== target.id));
          if (this.reminderId() === target.id && this.tokenStorage.userId() === ownerId) {
            void this.router.navigate(['/reminders'], { replaceUrl: true });
          }
        },
        error: (error: { status?: number }) => {
          this.deleteError.set(
            error.status === 403
              ? 'Недостаточно прав для удаления напоминания.'
              : error.status === 404
                ? 'Напоминание уже удалено или у вас нет прав на его удаление.'
                : 'Не удалось удалить напоминание. Попробуйте ещё раз.',
          );
        },
      });
  }

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
