import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { NotificationsService } from '../../api/services';
import { NotificationListDto } from '../../api/models/notification-list-dto';
import { RouterLink } from '@angular/router';
import {
  formatNotificationDate,
  formatNotificationRecurrency,
} from '../../shared/notification-format';

type NotificationsState =
  { kind: 'loading' } | { kind: 'ready'; notifications: NotificationListDto[] } | { kind: 'error' };

@Component({
  selector: 'app-notifications',
  imports: [RouterLink],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  private readonly api = inject(NotificationsService);
  private readonly refresh = new Subject<void>();
  readonly formatDate = formatNotificationDate;
  readonly formatRecurrency = formatNotificationRecurrency;
  readonly state = toSignal(
    this.refresh.pipe(
      startWith(undefined),
      switchMap(() =>
        this.api.apiV1NotificationsGet$Json().pipe(
          map((notifications) => ({ kind: 'ready', notifications }) as NotificationsState),
          catchError(() => of<NotificationsState>({ kind: 'error' })),
          startWith<NotificationsState>({ kind: 'loading' }),
        ),
      ),
    ),
    { initialValue: { kind: 'loading' } as NotificationsState },
  );

  reload(): void {
    if (this.state().kind !== 'loading') this.refresh.next();
  }
}
