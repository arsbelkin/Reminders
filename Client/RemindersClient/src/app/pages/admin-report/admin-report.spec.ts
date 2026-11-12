import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { AdminService } from '../../api/services';
import { AdminResponseModel } from '../../api/models/admin-response-model';
import { AdminReportModel } from '../../api/models/admin-report-model';
import { TokenStorageService } from '../../auth/token-storage.service';
import { routes } from '../../app.routes';
import { Reports } from '../reports/reports';
import { AdminReport } from './admin-report';

@Component({selector: 'app-reports-login-stub', template: 'Вход'}) class LoginStub {}
@Component({selector: 'app-reports-reminders-stub', template: 'Напоминания'}) class RemindersStub {}

describe('Admin reports', () => {
  let harness: RouterTestingHarness;
  let response: Subject<AdminResponseModel>;
  let session: TokenStorageService;
  const api = {apiV1AdminReportGet$Json: vi.fn()};
  const root = () => harness.routeNativeElement!;
  const token = (role: string) => 'header.' + btoa(JSON.stringify({role})).replace(/=/g, '') + '.signature';
  const items: AdminReportModel[] = [{userId: 'one', userName: 'Анна', email: 'anna@example.test', numberOfReminders: '12', numberOfCompletedReminders: 5}];
  const nextRequest = () => { response = new Subject<AdminResponseModel>(); api.apiV1AdminReportGet$Json.mockReturnValue(response); };
  const resolve = (rows = items, title = 'Статистика по пользователям', description = 'Кол-во напоминаний и выполненных') => { response.next({title, description, report: rows}); response.complete(); harness.detectChanges(); };

  beforeEach(async () => {
    localStorage.removeItem('X-Access-Token'); api.apiV1AdminReportGet$Json.mockReset(); nextRequest();
    TestBed.configureTestingModule({providers: [
      {provide: AdminService, useValue: api},
      provideRouter([
        ...routes.filter(route => route.path === 'reports' || route.path === 'reports/:id'),
        {path: 'login', component: LoginStub}, {path: 'reminders', component: RemindersStub},
      ]),
    ]});
    session = TestBed.inject(TokenStorageService); session.saveToken(token('Admin'));
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => { localStorage.removeItem('X-Access-Token'); });

  it('loads the API title and description in the catalogue and details', async () => {
    await harness.navigateByUrl('/reports', Reports);
    expect(api.apiV1AdminReportGet$Json).toHaveBeenCalledTimes(1);
    resolve();
    expect(root().querySelector('.report-card h2')?.textContent).toBe('Статистика по пользователям');
    expect(root().querySelector('.report-card p')?.textContent).toBe('Кол-во напоминаний и выполненных');
    expect(root().querySelector('.report-card')?.textContent).not.toContain('Отчет 1');
    nextRequest(); root().querySelector<HTMLAnchorElement>('.report-card')!.click(); await harness.fixture.whenStable();
    expect(api.apiV1AdminReportGet$Json).toHaveBeenCalledTimes(2);
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем');
    resolve();
    expect(root().querySelector('h1')?.textContent).toBe('Статистика по пользователям');
    expect(root().querySelector('.page-heading p')?.textContent).toBe('Кол-во напоминаний и выполненных');
    expect(root().querySelector('caption')?.textContent).toContain('Статистика по пользователям');
    expect([...root().querySelectorAll('tbody td')].map(cell => cell.textContent?.trim())).toEqual(['Анна', 'anna@example.test', '12', '5', '7']);
    expect(root().querySelector('a[href="/reports"]')).not.toBeNull();
  });

  it('uses a fallback for missing metadata and treats a missing report array as empty', async () => {
    await harness.navigateByUrl('/reports', Reports);
    response.next({title: '   '}); response.complete(); harness.detectChanges();
    expect(root().querySelector('.report-card h2')?.textContent).toBe('Отчет 1');
    expect(root().querySelector('.report-card p')).toBeNull();
    nextRequest(); await harness.navigateByUrl('/reports/1', AdminReport);
    response.next({}); response.complete(); harness.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Отчет 1');
    expect(root().textContent).toContain('Данных пока нет');
  });

  it('retries catalogue errors and clears the card after an account change', async () => {
    const component = await harness.navigateByUrl('/reports', Reports);
    component.reload(); expect(api.apiV1AdminReportGet$Json).toHaveBeenCalledTimes(1);
    response.error({status: 500}); harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Не удалось загрузить отчёты');
    nextRequest(); component.reload(); resolve();
    expect(root().querySelector('.report-card')).not.toBeNull();
    session.saveToken(token('User')); harness.detectChanges(); TestBed.tick();
    expect(root().querySelector('.report-card')).toBeNull();
    expect(root().textContent).toContain('Нет доступа');
    expect(api.apiV1AdminReportGet$Json).toHaveBeenCalledTimes(2);
  });

  it.each(['/reports', '/reports/1'])('denies non-admin direct access to %s without querying the report', async url => {
    session.saveToken(token('User'));
    await harness.navigateByUrl(url, RemindersStub);
    expect(api.apiV1AdminReportGet$Json).not.toHaveBeenCalled();
  });

  it.each(['/reports', '/reports/1'])('redirects a guest from %s to login', async url => {
    session.clearToken(); await harness.navigateByUrl(url, LoginStub);
    expect(api.apiV1AdminReportGet$Json).not.toHaveBeenCalled();
  });

  it('handles empty data and missing numeric values without inventing counts', async () => {
    const component = await harness.navigateByUrl('/reports/1', AdminReport); resolve([]);
    expect(root().textContent).toContain('Данных пока нет');
    nextRequest(); component.reload(); resolve([{}]);
    expect(root().querySelector('tbody')?.textContent).toContain('Без имени');
    expect(component.count('')).toBeNull(); expect(component.count('NaN')).toBeNull();
    expect(component.count(-1)).toBeNull(); expect(component.activeCount({numberOfReminders: 2, numberOfCompletedReminders: 3})).toBeNull();
    expect(root().querySelectorAll('tbody td')[2].textContent?.trim()).toBe('—');
  });

  it('retries load errors, prevents duplicate refreshes and handles server denial', async () => {
    const component = await harness.navigateByUrl('/reports/1', AdminReport);
    component.reload(); expect(api.apiV1AdminReportGet$Json).toHaveBeenCalledTimes(1);
    response.error({status: 500}); harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Не удалось загрузить');
    nextRequest(); component.reload(); resolve();
    nextRequest(); component.reload(); response.error({status: 403}); harness.detectChanges();
    expect(root().textContent).toContain('Нет доступа'); expect(root().querySelector('table')).toBeNull();
  });

  it('clears report data and stops fetching after changing to a non-admin account', async () => {
    await harness.navigateByUrl('/reports/1', AdminReport); resolve();
    session.saveToken(token('User')); harness.detectChanges(); TestBed.tick();
    expect(root().querySelector('table')).toBeNull(); expect(root().textContent).not.toContain('anna@example.test');
    expect(api.apiV1AdminReportGet$Json).toHaveBeenCalledTimes(1);
  });

  it('handles an unknown report without calling the report endpoint', async () => {
    await harness.navigateByUrl('/reports/unknown', AdminReport);
    expect(root().textContent).toContain('Отчёт не найден'); expect(api.apiV1AdminReportGet$Json).not.toHaveBeenCalled();
  });
});
