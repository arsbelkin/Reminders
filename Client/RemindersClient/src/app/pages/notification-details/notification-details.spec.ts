import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { NotificationsService } from '../../api/services';
import { NotificationListDto } from '../../api/models/notification-list-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { routes } from '../../app.routes';
import { NotificationDetails } from './notification-details';

@Component({selector: 'app-notification-login-stub', template: 'Вход'}) class LoginStub {}

describe('NotificationDetails', () => {
  const api = {apiV1NotificationsGet$Json: vi.fn(), apiV1NotificationsNotificationIdPatch: vi.fn(), apiV1NotificationsNotificationIdDelete: vi.fn()};
  let response: Subject<NotificationListDto[]>;
  let harness: RouterTestingHarness;
  let component: NotificationDetails;
  let allowed: boolean;
  let token = signal<string | null>('token');
  const data: NotificationListDto = {id: 'first', reminderId: 'reminder', reminderTitle: 'Подготовить отчёт', reminderDescription: 'Первая строка\nВторая строка', categoryId: 'work', categoryTitle: 'Работа', notificationTime: '2026-11-18T10:00:00Z', recurrency: 7};
  const root = () => harness.routeNativeElement!;
  const nextRequest = () => {
    response = new Subject<NotificationListDto[]>();
    api.apiV1NotificationsGet$Json.mockReturnValue(response);
  };
  const resolve = (items = [data]) => { response.next(items); response.complete(); harness.detectChanges(); };
  const mockDialog = () => {
    const dialog = root().querySelector<HTMLDialogElement>('.navigation-dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    return dialog;
  };

  beforeEach(async () => {
    allowed = true; token = signal('token'); api.apiV1NotificationsGet$Json.mockReset(); nextRequest();
    TestBed.configureTestingModule({providers: [
      {provide: NotificationsService, useValue: api},
      {provide: TokenStorageService, useValue: {getToken: () => allowed ? token() : null, token: () => allowed ? token() : null}},
      provideRouter([routes.find(route => route.path === 'notifications/:id')!, {path: 'login', component: LoginStub}]),
    ]});
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/notifications/first', NotificationDetails);
  });

  it('saves date changes in place and refreshes the drawer data', () => {
    resolve();
    const operation = new Subject<void>(); api.apiV1NotificationsNotificationIdPatch.mockReturnValue(operation);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const dialog = root().querySelector<HTMLDialogElement>('.action-dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', '')); dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    root().querySelector<HTMLButtonElement>('.edit-category')!.click(); harness.detectChanges();
    const time = root().querySelector<HTMLInputElement>('#notification-edit-time')!;
    time.value = '2026-12-01T18:30'; time.dispatchEvent(new Event('input'));
    root().querySelector('.action-dialog form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    nextRequest(); operation.next(); operation.complete();
    resolve([{...data, notificationTime: '2026-12-01T15:30:00Z', recurrency: 1}]);
    expect(navigate).not.toHaveBeenCalled();
    expect(root().querySelector('.details-meta')?.textContent).toContain('Ежедневно');
    mockDialog(); component.openNavigation(); harness.detectChanges();
    expect(root().querySelector('.navigation-item')?.textContent).toContain(component.formatDate('2026-12-01T15:30:00Z'));
  });

  it('returns to the list only after successful confirmed deletion', () => {
    resolve();
    const operation = new Subject<void>(); api.apiV1NotificationsNotificationIdDelete.mockReturnValue(operation);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const dialog = root().querySelector<HTMLDialogElement>('.action-dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', '')); dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    root().querySelector<HTMLButtonElement>('.delete-category')!.click(); harness.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(root().querySelector('.delete-warning')?.textContent).toContain('Напоминание сохранится');
    root().querySelector('.action-dialog form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    operation.next(); operation.complete();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/notifications'], {replaceUrl: true});
  });

  it('loads a direct URL and renders description and links to related records', () => {
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем уведомление');
    component.reload(); expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(1);
    resolve();
    expect(root().querySelector('h1')?.textContent).toBe(data.reminderTitle);
    expect(root().querySelector('.description-text')?.textContent).toBe(data.reminderDescription);
    expect(root().querySelector('.details-meta')?.textContent).toContain('Еженедельно');
    expect(root().querySelector('.details-meta')?.textContent).toContain(component.formatDate(data.notificationTime));
    expect(root().querySelector('a[href="/notifications"]')).not.toBeNull();
    expect(root().querySelector('a[href="/categories/work"]')).not.toBeNull();
    expect(root().querySelector('a[href="/reminders/reminder"]')).not.toBeNull();
  });

  it('reports a missing target without showing another notification as its details', () => {
    resolve([{...data, id: 'other'}]);
    expect(root().querySelector('h1')?.textContent).toBe('Уведомление не найдено');
    expect(root().querySelector('.details-card')).toBeNull();
    expect(root().querySelector('.details-page')?.textContent).not.toContain(data.reminderTitle);
  });

  it('retries a failed request and refreshes the open detail page', () => {
    response.error({status: 500}); harness.detectChanges();
    expect(root().querySelector('[role="alert"]')).not.toBeNull(); nextRequest();
    root().querySelector<HTMLButtonElement>('.retry-button')!.click(); resolve();
    nextRequest(); component.reload(); resolve([{...data, reminderTitle: 'Обновлено'}]);
    expect(root().querySelector('h1')?.textContent).toBe('Обновлено');
    expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(3);
  });

  it('cancels the old request and removes stale content when IDs change', async () => {
    const old = response; nextRequest();
    await harness.navigateByUrl('/notifications/second', NotificationDetails);
    expect(old.observed).toBe(false);
    old.next([data]);
    expect(root().querySelector('.details-card')).toBeNull();
    resolve([{...data, id: 'second', reminderTitle: 'Второе уведомление'}]);
    expect(root().querySelector('h1')?.textContent).toBe('Второе уведомление');
  });

  it('handles missing optional fields without broken links', () => {
    resolve([{id: 'first'}]);
    expect(root().querySelector('h1')?.textContent).toBe('Без названия');
    expect(root().querySelector('.description-text')?.textContent).toBe('Описание не добавлено.');
    expect(root().querySelector('.details-meta')?.textContent).toContain('Не указано');
    expect(root().querySelector('a[href*="/reminders/"]')).toBeNull();
    expect(root().querySelector('a[href*="/categories/"]')).toBeNull();
  });

  it('does not load notifications for guests', async () => {
    allowed = false; api.apiV1NotificationsGet$Json.mockClear();
    await harness.navigateByUrl('/notifications/second', LoginStub);
    expect(root().textContent).toContain('Вход');
    expect(api.apiV1NotificationsGet$Json).not.toHaveBeenCalled();
    expect(response.observed).toBe(false);
  });

  it('opens the drawer using the already loaded list and highlights the current notification', () => {
    resolve([data, {...data, id: 'second', reminderTitle: 'Купить книгу', categoryTitle: 'Личное'}]);
    const dialog = mockDialog();
    root().querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!.click(); harness.detectChanges();
    expect(dialog.open).toBe(true);
    expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(1);
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(2);
    expect(root().querySelector('.navigation-item[aria-current="page"]')?.getAttribute('href')).toBe('/notifications/first');
    expect(root().querySelector('.navigation-item')?.textContent).toContain('Работа');
    expect(root().querySelector('.navigation-item')?.textContent).toContain(component.formatDate(data.notificationTime));
    component.closeNavigation(); expect(dialog.open).toBe(false);
  });

  it('filters by title and category locally and resets the search on reopening', () => {
    resolve([data, {...data, id: 'second', reminderTitle: 'Купить книгу', categoryTitle: 'Личное'}]);
    mockDialog(); component.openNavigation();
    component.navigationSearch.setValue('  КНИГУ '); harness.detectChanges();
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(1);
    expect(root().querySelector('.navigation-item')?.getAttribute('href')).toBe('/notifications/second');
    component.navigationSearch.setValue('работа'); harness.detectChanges();
    expect(root().querySelector('.navigation-item')?.getAttribute('href')).toBe('/notifications/first');
    component.navigationSearch.setValue('несуществующее'); harness.detectChanges();
    expect(root().querySelector('.navigation-state')?.textContent).toContain('Ничего не найдено');
    component.closeNavigation(); component.openNavigation(); harness.detectChanges();
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(2);
    expect(api.apiV1NotificationsGet$Json).toHaveBeenCalledTimes(1);
  });

  it('switches notifications from the drawer and closes it', async () => {
    const items = [data, {...data, id: 'second', reminderTitle: 'Другое уведомление'}];
    resolve(items); const dialog = mockDialog(); component.openNavigation(); harness.detectChanges();
    nextRequest(); root().querySelector<HTMLAnchorElement>('.navigation-item[href="/notifications/second"]')!.click();
    await harness.fixture.whenStable();
    expect(dialog.open).toBe(false);
    resolve(items);
    expect(root().querySelector('h1')?.textContent).toBe('Другое уведомление');
    component.openNavigation(); harness.detectChanges();
    expect(root().querySelector('.navigation-item[aria-current="page"]')?.getAttribute('href')).toBe('/notifications/second');
  });

  it('shows drawer loading and error states and retries the shared request', () => {
    mockDialog(); component.openNavigation(); harness.detectChanges();
    expect(root().querySelector('.navigation-content [role="status"]')).not.toBeNull();
    response.error({status: 500}); harness.detectChanges();
    expect(root().querySelector('.navigation-content [role="alert"]')?.textContent).toContain('Не удалось загрузить');
    nextRequest(); root().querySelector<HTMLButtonElement>('.navigation-content .retry-button')!.click();
    resolve(); expect(root().querySelector('.navigation-item')).not.toBeNull();
  });

  it('allows choosing another notification when the current one is missing and handles an empty list', () => {
    resolve([{...data, id: 'second'}]); mockDialog(); component.openNavigation(); harness.detectChanges();
    expect(root().querySelector('.navigation-item')?.getAttribute('href')).toBe('/notifications/second');
    expect(root().querySelector('.navigation-item[aria-current]')).toBeNull();
    nextRequest(); component.reload(); resolve([]);
    expect(root().querySelector('.navigation-state')?.textContent).toContain('Уведомлений пока нет');
  });
});
