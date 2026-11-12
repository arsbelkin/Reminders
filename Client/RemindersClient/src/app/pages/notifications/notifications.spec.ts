import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { NotificationsService } from '../../api/services';
import { NotificationListDto } from '../../api/models/notification-list-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { routes } from '../../app.routes';
import { authGuard } from '../../auth/auth.guard';
import { Notifications } from './notifications';

@Component({selector: 'app-login-stub', template: 'Вход'}) class LoginStub {}

describe('Notifications', () => {
  let fixture: ComponentFixture<Notifications>;
  let response: Subject<NotificationListDto[]>;
  const api = {apiV1NotificationsGet$Json: vi.fn()};
  const root = () => fixture.nativeElement as HTMLElement;
  const items: NotificationListDto[] = [{id: 'one', reminderTitle: 'Отчёт', reminderDescription: 'Первая строка\nВторая строка', categoryTitle: 'Работа', notificationTime: '2026-11-18T10:00:00Z', recurrency: 7}];

  beforeEach(() => {
    response = new Subject<NotificationListDto[]>();
    api.apiV1NotificationsGet$Json.mockReset().mockReturnValue(response);
    TestBed.configureTestingModule({providers: [provideRouter([]), {provide: NotificationsService, useValue: api}]});
    fixture = TestBed.createComponent(Notifications); fixture.detectChanges();
  });

  it('loads once and prevents duplicate refresh requests while loading', () => {
    expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(1);
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем');
    expect(root().querySelector<HTMLButtonElement>('.refresh-button')!.disabled).toBe(true);
    fixture.componentInstance.reload();
    expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(1);
  });

  it('renders four columns with a link to notification details', () => {
    response.next(items); response.complete(); fixture.detectChanges();
    expect(root().querySelectorAll('thead th')).toHaveLength(4);
    expect(root().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root().querySelector('tbody')?.textContent).toContain('Отчёт');
    expect(root().querySelector('tbody')?.textContent).toContain('Работа');
    expect(root().querySelector('.notification-description')).toBeNull();
    expect(root().querySelector('tbody')?.textContent).not.toContain(items[0].reminderDescription);
    expect(root().querySelector('.recurrency-label')?.textContent).toBe('Еженедельно');
    expect(root().querySelector('.notification-time')?.textContent).toBe(fixture.componentInstance.formatDate(items[0].notificationTime));
    expect(root().querySelector('.notifications-count')?.textContent).toContain('1 всего');
    expect(root().querySelector('tbody a')?.getAttribute('href')).toBe('/notifications/one');
    expect(root().querySelector('.table-scroll')?.getAttribute('tabindex')).toBe('0');
  });

  it('renders an empty state', () => {
    response.next([]); fixture.detectChanges();
    expect(root().textContent).toContain('Уведомлений пока нет');
    expect(root().querySelector('table')).toBeNull();
  });

  it('permits retry after a failed request and refreshes the list', () => {
    response.error({status: 500}); fixture.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Не удалось загрузить');
    const retry = new Subject<NotificationListDto[]>();
    api.apiV1NotificationsGet$Json.mockReturnValue(retry);
    root().querySelector<HTMLButtonElement>('.page-state button')!.click(); fixture.detectChanges();
    expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(2);
    retry.next(items); fixture.detectChanges();
    expect(root().querySelector('table')).not.toBeNull();
    const refresh = new Subject<NotificationListDto[]>();
    api.apiV1NotificationsGet$Json.mockReturnValue(refresh);
    root().querySelector<HTMLButtonElement>('.refresh-button')!.click(); fixture.detectChanges();
    refresh.next([]); fixture.detectChanges();
    expect(root().querySelector('table')).toBeNull();
    expect(root().textContent).toContain('Уведомлений пока нет');
  });

  it('handles missing fields, unknown recurrence and invalid dates', () => {
    response.next([{}]); fixture.detectChanges();
    expect(root().textContent).toContain('Без названия');
    expect(root().textContent).toContain('Без категории');
    expect(root().querySelector('tbody a')).toBeNull();
    expect(fixture.componentInstance.formatDate('invalid')).toBe('Не указано');
    expect(fixture.componentInstance.formatRecurrency(999)).toBe('Неизвестная периодичность');
    expect([0, 1, 7, 31, 355].map(value => fixture.componentInstance.formatRecurrency(value)))
      .toEqual(['Без повторения', 'Ежедневно', 'Еженедельно', 'Ежемесячно', 'Ежегодно']);
  });

  it('cancels the pending request when the page is destroyed', () => {
    expect(response.observed).toBe(true); fixture.destroy();
    expect(response.observed).toBe(false);
  });

  it('protects direct navigation with the auth guard', async () => {
    const route = routes.find(item => item.path === 'notifications')!;
    expect(route.canActivate).toContain(authGuard);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [
      provideRouter([route, {path: 'login', component: LoginStub}]),
      {provide: TokenStorageService, useValue: {getToken: () => null}},
      {provide: NotificationsService, useValue: api},
    ]});
    api.apiV1NotificationsGet$Json.mockClear();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/notifications', LoginStub);
    expect(harness.routeNativeElement?.textContent).toContain('Вход');
    expect(api.apiV1NotificationsGet$Json).not.toHaveBeenCalled();
  });
});
