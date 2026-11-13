import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { NotificationsService } from '../../api/services';
import { NotificationListDto } from '../../api/models/notification-list-dto';
import {
  formatNotificationDate,
  formatNotificationRecurrency,
} from '../../shared/notification-format';
import { NotificationActions } from '../../components/notification-actions/notification-actions';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; notification: NotificationListDto; notifications: NotificationListDto[] }
  | { kind: 'missing'; notifications: NotificationListDto[] }
  | { kind: 'error' };

@Component({
  selector: 'app-notification-details',
  imports: [RouterLink, ReactiveFormsModule, NotificationActions],
  templateUrl: './notification-details.html',
  styleUrls: [
    '../../shared/details-page.css',
    '../../shared/details-navigation.css',
    './notification-details.css',
  ],
})
export class NotificationDetails {
  private readonly router = inject(Router);
  private readonly actions = viewChild.required<NotificationActions>('notificationActions');
  private readonly api = inject(NotificationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new Subject<void>();
  private readonly navigationDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('navigationDialog');
  private readonly routeId = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    distinctUntilChanged(),
  );
  readonly notificationId = toSignal(this.routeId, {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  readonly formatDate = formatNotificationDate;
  readonly formatRecurrency = formatNotificationRecurrency;
  readonly state = toSignal(
    combineLatest([this.routeId, this.refresh.pipe(startWith(undefined))]).pipe(
      switchMap(([id]) =>
        this.api.apiV1NotificationsGet$Json().pipe(
          map((items) => {
            const notification = items.find((item) => item.id?.toLowerCase() === id.toLowerCase());
            return notification
              ? ({ kind: 'ready', notification, notifications: items } as DetailState)
              : ({ kind: 'missing', notifications: items } as DetailState);
          }),
          catchError(() => of<DetailState>({ kind: 'error' })),
          startWith<DetailState>({ kind: 'loading' }),
        ),
      ),
    ),
    { initialValue: { kind: 'loading' } as DetailState },
  );
  readonly currentNotification = computed(() => {
    const current = this.state();
    return current.kind === 'ready' ? current.notification : null;
  });

  onSaved(id: string): void {
    if (id === this.notificationId()) this.reload();
  }

  onDeleted(id: string): void {
    if (id === this.notificationId())
      void this.router.navigate(['/notifications'], { replaceUrl: true });
  }

  readonly navigationSearch = new FormControl('', { nonNullable: true });
  private readonly searchText = toSignal(this.navigationSearch.valueChanges, { initialValue: '' });
  readonly filteredNotifications = computed(() => {
    const current = this.state();
    const search = this.searchText().trim().toLocaleLowerCase('ru');
    const items =
      current.kind === 'ready' || current.kind === 'missing' ? current.notifications : [];
    return items.filter(
      (item) =>
        item.id &&
        `${item.reminderTitle || 'Без названия'} ${item.categoryTitle || 'Без категории'}`
          .toLocaleLowerCase('ru')
          .includes(search),
    );
  });

  openNavigation(): void {
    if (this.actions().busy()) return;
    this.navigationSearch.reset();
    this.navigationDialog().nativeElement.showModal();
  }

  closeNavigation(): void {
    this.navigationDialog().nativeElement.close();
  }

  reload(): void {
    if (this.state().kind !== 'loading') this.refresh.next();
  }
}
