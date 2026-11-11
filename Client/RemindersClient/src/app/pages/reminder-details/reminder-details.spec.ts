import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of } from 'rxjs';
import { RemindersService } from '../../api/services';
import { ReminderInfoViewDto } from '../../api/models/reminder-info-view-dto';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { authGuard } from '../../auth/auth.guard';
import { TokenStorageService } from '../../auth/token-storage.service';
import { routes } from '../../app.routes';
import { ReminderDetails } from './reminder-details';

@Component({template: '<p>Вход</p>'}) class LoginStub {}
@Component({template: '<p>Список</p>'}) class ListStub {}

describe('ReminderDetails', () => {
  const api = {apiV1RemindersReminderIdGet$Json: vi.fn(), apiV1RemindersGet$Json: vi.fn()};
  let requests: Map<string, Subject<ReminderInfoViewDto>>;
  let harness: RouterTestingHarness;
  let component: ReminderDetails;
  let allowed: boolean;
  const data: ReminderInfoViewDto = {
    id: 'first', title: 'Подготовить отчёт', categoryName: 'Работа', description: 'Первая строка.\nВторая строка.',
    priority: 3, isCompleted: 1, createdTime: '2026-11-01T09:00:00Z',
    dueDate: '2026-11-15T10:30:00Z', completedTime: '2026-11-12T12:00:00Z',
    memberEmails: ['anna@example.test', 'ivan@example.test'],
  };

  function root(): HTMLElement { return harness.routeNativeElement!; }
  function resolve(id: string, value: ReminderInfoViewDto): void {
    requests.get(id)!.next(value);
    requests.get(id)!.complete();
    harness.detectChanges();
  }
  function mockDialog(): HTMLDialogElement {
    const dialog = root().querySelector('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    return dialog;
  }

  beforeEach(async () => {
    allowed = true;
    requests = new Map();
    api.apiV1RemindersReminderIdGet$Json.mockReset().mockImplementation(({reminderId}: {reminderId: string}) => {
      const response = new Subject<ReminderInfoViewDto>();
      requests.set(reminderId, response);
      return response.asObservable();
    });
    api.apiV1RemindersGet$Json.mockReset().mockReturnValue(of([
      {id: 'first', title: 'Подготовить отчёт', categoryName: 'Работа'},
      {id: 'second', title: 'Купить книгу', categoryName: 'Личное', isCompleted: 1},
    ]));
    TestBed.configureTestingModule({
      providers: [
        {provide: RemindersService, useValue: api},
        {provide: TokenStorageService, useValue: {getToken: () => allowed ? 'token' : null}},
        provideRouter([
          {path: 'reminders/:id', component: ReminderDetails, canActivate: [authGuard]},
          {path: 'reminders', component: ListStub},
          {path: 'login', component: LoginStub},
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/reminders/first', ReminderDetails);
  });

  it('loads details from the route and renders all user-facing fields', () => {
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем напоминание');
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenCalledExactlyOnceWith({reminderId: 'first'});
    expect(api.apiV1RemindersGet$Json).not.toHaveBeenCalled();
    resolve('first', data);
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(root().querySelector('.description-text')?.textContent).toBe(data.description);
    expect(root().querySelector('.category-label')?.textContent).toContain('Работа');
    expect(root().querySelector('.priority-badge')?.textContent).toBe('Высокий');
    expect(root().querySelector('.completion-status')?.textContent).toContain('Выполнено');
    expect(root().querySelectorAll('.members-list li')).toHaveLength(2);
    expect(root().querySelectorAll('time')).toHaveLength(3);
    expect(root().querySelector('.back-link')?.getAttribute('href')).toBe('/reminders');
  });

  it('shows sensible fallbacks for optional and empty fields', () => {
    resolve('first', {id: 'first', description: '   '});
    expect(root().querySelector('h1')?.textContent).toBe('Без названия');
    expect(root().textContent).toContain('Описание не добавлено.');
    expect(root().textContent).toContain('Участники не указаны.');
    expect(root().textContent).toContain('Без даты');
    expect(root().textContent).not.toContain('Дата выполнения');
    expect(component.formatDate('invalid date')).toBe('Не указана');
  });

  it('cancels earlier details and removes stale content when switching IDs', async () => {
    const first = requests.get('first')!;
    await harness.navigateByUrl('/reminders/second', ReminderDetails);
    expect(first.observed).toBe(false);
    first.next(data);
    harness.detectChanges();
    expect(root().querySelector('.details-card')).toBeNull();
    resolve('second', {id: 'second', title: 'Другая задача'});
    expect(root().querySelector('h1')?.textContent).toBe('Другая задача');
    expect(root().textContent).not.toContain('Подготовить отчёт');
  });

  it.each([400, 404])('handles an invalid or inaccessible ID (status=%s)', status => {
    requests.get('first')!.error({status});
    harness.detectChanges();
    expect(root().querySelector('.details-state h1')?.textContent).toBe('Напоминание не найдено');
    expect(root().querySelector('.details-state .retry-button')).toBeNull();
    expect(root().querySelector('.details-state a')?.getAttribute('href')).toBe('/reminders');
  });

  it('handles forbidden details without showing stale information', () => {
    requests.get('first')!.error({status: 403});
    harness.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Нет доступа к напоминанию');
    expect(root().querySelector('.details-card')).toBeNull();
  });

  it.each([0, 500])('can retry the same ID after a transient failure (status=%s)', status => {
    requests.get('first')!.error({status});
    harness.detectChanges();
    root().querySelector<HTMLButtonElement>('.retry-button')!.click();
    harness.detectChanges();
    expect(root().querySelector('[role="status"]')).not.toBeNull();
    resolve('first', data);
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenCalledTimes(2);
  });

  it('opens a lazy-loaded drawer with the current item highlighted and reuses its list', () => {
    resolve('first', data);
    const dialog = mockDialog();
    component.openNavigation();
    harness.detectChanges();
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(api.apiV1RemindersGet$Json).toHaveBeenCalledTimes(1);
    expect(root().querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/reminders/first');
    component.closeNavigation();
    component.openNavigation();
    harness.detectChanges();
    expect(api.apiV1RemindersGet$Json).toHaveBeenCalledTimes(1);
  });

  it('filters the drawer locally and switches details through its links', async () => {
    resolve('first', data);
    const dialog = mockDialog();
    component.openNavigation();
    harness.detectChanges();
    component.navigationSearch.setValue('  КНИГУ  ');
    harness.detectChanges();
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(1);
    root().querySelector<HTMLAnchorElement>('.navigation-item')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenLastCalledWith({reminderId: 'second'});
    resolve('second', {id: 'second', title: 'Купить книгу'});
    expect(root().querySelector('h1')?.textContent).toBe('Купить книгу');
    expect(api.apiV1RemindersGet$Json).toHaveBeenCalledTimes(1);
  });

  it('can retry a drawer error without losing loaded details', () => {
    resolve('first', data);
    mockDialog();
    const list = new Subject<ReminderListViewDto[]>();
    api.apiV1RemindersGet$Json.mockReturnValueOnce(list.asObservable());
    component.openNavigation();
    harness.detectChanges();
    expect(root().querySelector('.navigation-state[role="status"]')).not.toBeNull();
    list.error({status: 500});
    harness.detectChanges();
    expect(root().querySelector('.details-card h1')?.textContent).toBe(data.title);
    root().querySelector<HTMLButtonElement>('.navigation-state .retry-button')!.click();
    harness.detectChanges();
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(2);
  });

  it('handles empty navigation and unmatched searches', () => {
    resolve('first', data);
    mockDialog();
    api.apiV1RemindersGet$Json.mockReturnValue(of([]));
    component.openNavigation();
    harness.detectChanges();
    expect(root().querySelector('.navigation-state')?.textContent).toContain('Напоминаний пока нет.');
    component.navigationSearch.setValue('нет совпадений');
    harness.detectChanges();
    expect(root().querySelector('.navigation-state')?.textContent).toContain('Ничего не найдено');
  });

  it('protects direct URLs with the auth guard in the real route configuration', async () => {
    expect(routes.find(route => route.path === 'reminders/:id')?.canActivate).toContain(authGuard);
    allowed = false;
    api.apiV1RemindersReminderIdGet$Json.mockClear();
    await harness.navigateByUrl('/reminders/another', LoginStub);
    expect(root().textContent).toContain('Вход');
    expect(api.apiV1RemindersReminderIdGet$Json).not.toHaveBeenCalled();
  });
});
