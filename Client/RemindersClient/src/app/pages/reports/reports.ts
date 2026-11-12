import { Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../api/services';
import { TokenStorageService } from '../../auth/token-storage.service';

type ReportsState = {kind: 'loading' | 'error' | 'forbidden'} | {kind: 'ready'; title: string; description: string};

@Component({
  selector: 'app-reports',
  imports: [RouterLink],
  templateUrl: './reports.html',
  styleUrls: ['../notifications/notifications.css', './reports.css'],
})
export class Reports {
  private readonly api = inject(AdminService);
  private readonly session = inject(TokenStorageService);
  private readonly refresh = new Subject<void>();
  readonly state = toSignal(combineLatest([
    toObservable(this.session.token), this.refresh.pipe(startWith(undefined)),
  ]).pipe(switchMap(() => !this.session.isAdmin() ? of<ReportsState>({kind: 'forbidden'})
    : this.api.apiV1AdminReportGet$Json().pipe(
      map(response => ({kind: 'ready', title: response.title?.trim() || 'Отчет 1', description: response.description?.trim() || ''}) as ReportsState),
      catchError((error: {status?: number}) => of<ReportsState>({kind: error.status === 403 ? 'forbidden' : 'error'})),
      startWith<ReportsState>({kind: 'loading'}),
    ),
  )), {initialValue: {kind: 'loading'} as ReportsState});

  reload(): void { if (this.state().kind !== 'loading') this.refresh.next(); }
}
