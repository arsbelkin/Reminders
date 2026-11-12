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
import { NotificationListDto } from '../../api/models/notification-list-dto';
import { NOTIFICATION_RECURRENCY_LABELS } from '../../shared/notification-format';
import { TokenStorageService } from '../../auth/token-storage.service';

@Component({
  selector: 'app-notification-actions',
  imports: [ReactiveFormsModule],
  templateUrl: './notification-actions.html',
  styleUrls: ['../category-actions/category-actions.css', './notification-actions.css'],
})
export class NotificationActions {
  private readonly api = inject(NotificationsService);
  private readonly session = inject(TokenStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('actionDialog');
  readonly notification = input<NotificationListDto | null>(null);
  readonly notificationId = input.required<string>();
  readonly saved = output<string>();
  readonly deleted = output<string>();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<'edit' | 'delete'>('edit');
  readonly target = signal<{
    id: string;
    title: string;
    notificationTime: string | undefined;
    localDate: string;
    sessionToken: string;
  } | null>(null);
  readonly canManage = computed(() => !!this.session.token() && !!this.notification()?.id);
  readonly recurrencyOptions = Object.entries(NOTIFICATION_RECURRENCY_LABELS).map(([value, label]) => ({value: Number(value), label}));
  readonly form = new FormGroup({
    notificationTime: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    recurrency: new FormControl(0, {nonNullable: true, validators: [Validators.required, Validators.pattern(/^(0|1|7|31|355)$/)]}),
  });

  constructor() {
    effect(() => {
      const target = this.target();
      if (
        target &&
        (target.id !== this.notificationId() ||
          target.sessionToken !== this.session.token() ||
          !this.canManage())
      ) {
        this.dialog().nativeElement.close();
        this.target.set(null);
        this.error.set(null);
      }
    });
  }

  open(mode: 'edit' | 'delete'): void {
    const notification = this.notification();
    const sessionToken = this.session.token();
    if (!notification || !sessionToken || !this.canManage() || this.busy()) return;
    const localDate = this.toLocalDate(notification.notificationTime);
    this.mode.set(mode);
    this.target.set({id: this.notificationId(), title: notification.reminderTitle || 'Без названия', notificationTime: notification.notificationTime, localDate, sessionToken});
    this.form.reset({notificationTime: localDate, recurrency: notification.recurrency ?? 0});
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
      !this.canManage() ||
      target.id !== this.notificationId() ||
      target.sessionToken !== this.session.token()
    )
      return;
    const deleting = this.mode() === 'delete';
    this.form.markAllAsTouched();
    if (!deleting && this.form.invalid) return;
    const values = this.form.getRawValue();
    const date = new Date(values.notificationTime);
    if (!deleting && Number.isNaN(date.getTime())) {
      this.form.controls.notificationTime.setErrors({invalidDate: true});
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const request = deleting
      ? this.api.apiV1NotificationsNotificationIdDelete({ notificationId: target.id })
      : this.api.apiV1NotificationsNotificationIdPatch({
          notificationId: target.id,
          body: {
            notificationTime: values.notificationTime === target.localDate && target.notificationTime
              ? target.notificationTime : date.toISOString(),
            recurrency: values.recurrency,
          },
        });
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          if (target.sessionToken !== this.session.token()) return;
          if (this.target() === target) {
            this.dialog().nativeElement.close();
            this.target.set(null);
          }
          if (deleting) this.deleted.emit(target.id);
          else this.saved.emit(target.id);
        },
        error: (error: { status?: number }) => {
          if (this.target() !== target) return;
          const action = deleting ? 'удалить' : 'сохранить';
          this.error.set(
            error.status === 403 || error.status === 404
              ? 'Уведомление удалено или у вас нет прав на его изменение.'
              : `Не удалось ${action} уведомление. Попробуйте ещё раз.`,
          );
        },
      });
  }

  private toLocalDate(value: string | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
