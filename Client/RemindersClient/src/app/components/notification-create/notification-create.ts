import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { NotificationsService } from '../../api/services';
import { ReminderInfoViewDto } from '../../api/models/reminder-info-view-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import {
  NOTIFICATION_RECURRENCY_LABELS,
  toLocalNotificationTime,
} from '../../shared/notification-format';

export interface NotificationCreated {
  reminderId: string;
  id?: string;
}

@Component({
  selector: 'app-notification-create',
  imports: [ReactiveFormsModule],
  templateUrl: './notification-create.html',
  styleUrls: [
    '../category-actions/category-actions.css',
    '../notification-actions/notification-actions.css',
    './notification-create.css',
  ],
})
export class NotificationCreate {
  private readonly api = inject(NotificationsService);
  private readonly session = inject(TokenStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('createDialog');
  readonly reminder = input<ReminderInfoViewDto | null>(null);
  readonly reminderId = input.required<string>();
  readonly disabled = input(false);
  readonly created = output<NotificationCreated>();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly target = signal<{
    id: string;
    title: string;
    sessionToken: string;
    dueDate?: string | null;
    localDate: string;
  } | null>(null);
  readonly canCreate = computed(() => !!this.session.token() && !!this.reminder());
  readonly recurrencyOptions = Object.entries(NOTIFICATION_RECURRENCY_LABELS).map(
    ([value, label]) => ({ value: Number(value), label }),
  );
  readonly form = new FormGroup({
    notificationTime: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    recurrency: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(0|1|7|31|355)$/)],
    }),
  });

  constructor() {
    effect(() => {
      const target = this.target();
      if (
        target &&
        (target.id !== this.reminderId() ||
          target.sessionToken !== this.session.token() ||
          !this.canCreate())
      ) {
        this.dialog().nativeElement.close();
        this.target.set(null);
        this.error.set(null);
      }
    });
  }

  open(): void {
    const reminder = this.reminder();
    const sessionToken = this.session.token();
    if (!reminder || !sessionToken || !this.canCreate() || this.disabled() || this.busy()) return;
    const localDate = toLocalNotificationTime(reminder.dueDate);
    this.target.set({
      id: this.reminderId(),
      title: reminder.title || 'Без названия',
      sessionToken,
      dueDate: reminder.dueDate,
      localDate,
    });
    this.form.reset({ notificationTime: localDate, recurrency: 0 });
    this.error.set(null);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.target.set(null);
    this.error.set(null);
  }

  onCancel(event: Event): void {
    if (this.busy()) event.preventDefault();
    else {
      this.target.set(null);
      this.error.set(null);
    }
  }

  submit(): void {
    const target = this.target();
    if (
      !target ||
      this.busy() ||
      this.disabled() ||
      !this.canCreate() ||
      target.id !== this.reminderId() ||
      target.sessionToken !== this.session.token()
    )
      return;
    this.form.markAllAsTouched();
    const values = this.form.getRawValue();
    const date = new Date(values.notificationTime);
    if (Number.isNaN(date.getTime()))
      this.form.controls.notificationTime.setErrors({ invalidDate: true });
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .apiV1NotificationsPost$Json({
        body: {
          reminderId: target.id,
          recurrency: values.recurrency,
          notificationTime:
            values.notificationTime === target.localDate && target.dueDate
              ? target.dueDate
              : date.toISOString(),
        },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          if (target.sessionToken !== this.session.token()) return;
          if (this.target() === target) {
            this.dialog().nativeElement.close();
            this.target.set(null);
          }
          this.created.emit({ reminderId: target.id, id: result.id });
        },
        error: (error: { status?: number }) => {
          if (this.target() !== target) return;
          this.error.set(
            error.status === 403 || error.status === 404
              ? 'Напоминание удалено или у вас нет доступа к нему.'
              : 'Не удалось создать уведомление. Попробуйте ещё раз.',
          );
        },
      });
  }
}
