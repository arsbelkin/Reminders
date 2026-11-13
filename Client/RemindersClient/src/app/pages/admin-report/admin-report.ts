import { Component, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { AdminService } from '../../api/services';
import { AdminReportModel } from '../../api/models/admin-report-model';
import { TokenStorageService } from '../../auth/token-storage.service';

type ReportState =
  | { kind: 'loading' | 'error' | 'forbidden' | 'missing' }
  | { kind: 'ready'; title: string; description: string; rows: AdminReportModel[] };

@Component({
  selector: 'app-admin-report',
  imports: [RouterLink],
  templateUrl: './admin-report.html',
  styleUrls: ['../notifications/notifications.css', '../reports/reports.css'],
})
export class AdminReport {
  private readonly pageTitle = inject(Title);
  private readonly api = inject(AdminService);
  private readonly session = inject(TokenStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new Subject<void>();
  readonly state = toSignal(
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
      ),
      this.refresh.pipe(startWith(undefined)),
      toObservable(this.session.token),
    ]).pipe(
      switchMap(([id]) => {
        if (!this.session.isAdmin()) return of<ReportState>({ kind: 'forbidden' });
        if (id !== '1') return of<ReportState>({ kind: 'missing' });
        return this.api.apiV1AdminReportGet$Json().pipe(
          map(
            (response) =>
              ({
                kind: 'ready',
                title: response.title?.trim() || 'Отчет 1',
                description: response.description?.trim() || '',
                rows: response.report ?? [],
              }) as ReportState,
          ),
          catchError((error: { status?: number }) =>
            of<ReportState>({ kind: error.status === 403 ? 'forbidden' : 'error' }),
          ),
          startWith<ReportState>({ kind: 'loading' }),
        );
      }),
    ),
    { initialValue: { kind: 'loading' } as ReportState },
  );

  constructor() {
    effect(() => {
      const current = this.state();
      this.pageTitle.setTitle(`${current.kind === 'ready' ? current.title : 'Отчёт'} — Reminders`);
    });
  }

  reload(): void {
    if (this.state().kind !== 'loading') this.refresh.next();
  }

  count(value: number | string | undefined): number | null {
    if (value === undefined || (typeof value === 'string' && !value.trim())) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  activeCount(row: AdminReportModel): number | null {
    const total = this.count(row.numberOfReminders);
    const completed = this.count(row.numberOfCompletedReminders);
    return total !== null && completed !== null && total >= completed ? total - completed : null;
  }
}
