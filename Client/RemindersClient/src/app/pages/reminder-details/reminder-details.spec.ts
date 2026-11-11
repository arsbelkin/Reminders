import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of } from 'rxjs';
import { CategoriesService, RemindersService } from '../../api/services';
import { ReminderInfoViewDto } from '../../api/models/reminder-info-view-dto';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { authGuard } from '../../auth/auth.guard';
import { TokenStorageService } from '../../auth/token-storage.service';
import { routes } from '../../app.routes';
import { ReminderDetails } from './reminder-details';

@Component({template: '<p>Вход</p>'}) class LoginStub {}
@Component({template: '<p>Список</p>'}) class ListStub {}

describe('ReminderDetails', () => {
  const api = {apiV1RemindersReminderIdGet$Json: vi.fn(), apiV1RemindersGet$Json: vi.fn(), apiV1RemindersReminderIdDelete: vi.fn(), apiV1RemindersReminderIdCompletePost: vi.fn(), apiV1RemindersReminderIdReopenPost: vi.fn(), apiV1RemindersReminderIdPatch: vi.fn()};
  let deletion: Subject<void>;
  let completion: Subject<void>;
  let reopening: Subject<void>;
  let currentUserId = signal<string | null>('owner');
  let sessionToken = signal<string | null>('token');
  let requests: Map<string, Subject<ReminderInfoViewDto>>;
  let harness: RouterTestingHarness;
  let component: ReminderDetails;
  let allowed: boolean;
  const data: ReminderInfoViewDto = {
    creatorId: 'owner',
    id: 'first', title: 'Подготовить отчёт', categoryId: 'work', categoryName: 'Работа', description: 'Первая строка.\nВторая строка.',
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

  function mockDeleteDialog(): HTMLDialogElement {
    const dialog = root().querySelector<HTMLDialogElement>('.delete-dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    return dialog;
  }

  beforeEach(async () => {
    allowed = true;
    currentUserId = signal('owner');
    sessionToken = signal('token');
    deletion = new Subject<void>();
    completion = new Subject<void>();
    reopening = new Subject<void>();
    api.apiV1RemindersReminderIdReopenPost.mockReset().mockReturnValue(reopening.asObservable());
    api.apiV1RemindersReminderIdCompletePost.mockReset().mockReturnValue(completion.asObservable());
    api.apiV1RemindersReminderIdDelete.mockReset().mockReturnValue(deletion.asObservable());
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
        {provide: CategoriesService, useValue: {apiV1CategoriesGet$Json: () => of([{id: 'work', title: 'Работа'}])}},
        {provide: TokenStorageService, useValue: {getToken: () => allowed ? sessionToken() : null, token: sessionToken, userId: currentUserId}},
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

  it('reopens once and refreshes the same detail page', () => {
    resolve('first', data);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    root().querySelector<HTMLButtonElement>('.reopen-button')!.click();
    harness.detectChanges();
    expect(root().querySelector<HTMLButtonElement>('.reopen-button')!.disabled).toBe(true);
    expect(root().querySelector<HTMLButtonElement>('.delete-button')!.disabled).toBe(true);
    expect(root().querySelector('.reopen-button')?.textContent).toContain('Возобновляем');
    component.reopenReminder();
    component.completeReminder();
    expect(api.apiV1RemindersReminderIdReopenPost).toHaveBeenCalledExactlyOnceWith({reminderId: 'first'});
    expect(api.apiV1RemindersReminderIdCompletePost).not.toHaveBeenCalled();
    reopening.next(); reopening.complete();
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/reminders/first');
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenCalledTimes(2);
    resolve('first', {...data, isCompleted: 0, completedTime: null});
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(root().querySelector('.completion-status')?.textContent).toContain('Не выполнено');
    expect(root().querySelector('.reopen-button')).toBeNull();
    expect(root().querySelector('.complete-button')?.textContent).toContain('Завершить');
    expect(root().textContent).not.toContain('Дата выполнения');
  });

  it.each([0, 403, 404, 500])('keeps completed details and permits retry on reopen error %s', (status) => {
    resolve('first', data);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.reopenReminder();
    reopening.error({status});
    harness.detectChanges();
    expect(root().querySelector('.completion-error')?.textContent).toContain('Не удалось возобновить');
    expect(root().querySelector('.completion-status')?.textContent).toContain('Выполнено');
    expect(root().querySelector<HTMLButtonElement>('.reopen-button')!.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    api.apiV1RemindersReminderIdReopenPost.mockReturnValue(of(undefined));
    component.reopenReminder();
    expect(navigate).not.toHaveBeenCalled();
    resolve('first', {...data, isCompleted: 0, completedTime: null});
    expect(component.canComplete()).toBe(true);
  });

  it('does not reopen an active reminder or allow another owner', () => {
    resolve('first', {...data, isCompleted: 0});
    expect(root().querySelector('.reopen-button')).toBeNull();
    component.reopenReminder();
    currentUserId.set('other');
    harness.detectChanges();
    expect(root().querySelector('.reopen-button')).toBeNull();
    component.reopenReminder();
    expect(api.apiV1RemindersReminderIdReopenPost).not.toHaveBeenCalled();
  });

  it('does not redirect another detail page after a late reopen response', async () => {
    resolve('first', data);
    component.reopenReminder();
    await harness.navigateByUrl('/reminders/second', ReminderDetails);
    resolve('second', {...data, id: 'second'});
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    reopening.next(); reopening.complete();
    expect(navigate).not.toHaveBeenCalled();
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenCalledTimes(2);
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
  });

  it('completes once, disables conflicting actions and refreshes the same detail page', () => {
    resolve('first', {...data, isCompleted: 0});
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    root().querySelector<HTMLButtonElement>('.complete-button')!.click();
    harness.detectChanges();
    expect(root().querySelector<HTMLButtonElement>('.complete-button')!.disabled).toBe(true);
    expect(root().querySelector<HTMLButtonElement>('.delete-button')!.disabled).toBe(true);
    component.completeReminder();
    expect(api.apiV1RemindersReminderIdCompletePost).toHaveBeenCalledExactlyOnceWith({reminderId: 'first'});
    completion.next(); completion.complete();
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/reminders/first');
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenCalledTimes(2);
    resolve('first', data);
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(root().querySelector('.completion-status')?.textContent).toContain('Выполнено');
    expect(root().querySelector('.reopen-button')?.textContent).toContain('Возобновить');
    expect(root().textContent).toContain('Дата выполнения');
  });

  it('keeps details on completion failure and permits retry', () => {
    resolve('first', {...data, isCompleted: 0});
    component.completeReminder();
    completion.error({status: 500});
    harness.detectChanges();
    expect(root().querySelector('.completion-error')?.textContent).toContain('Не удалось завершить');
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(root().querySelector<HTMLButtonElement>('.complete-button')!.disabled).toBe(false);
  });

  it('does not offer completion for completed reminders or another owner', () => {
    resolve('first', data);
    expect(component.canComplete()).toBe(false);
    expect(root().querySelector('.reopen-button')).not.toBeNull();
    component.completeReminder();
    currentUserId.set('other');
    resolve('first', {...data, isCompleted: 0});
    component.completeReminder();
    expect(api.apiV1RemindersReminderIdCompletePost).not.toHaveBeenCalled();
  });

  it('does not redirect another reminder after a late completion response', async () => {
    resolve('first', {...data, isCompleted: 0});
    component.completeReminder();
    await harness.navigateByUrl('/reminders/second', ReminderDetails);
    resolve('second', {...data, id: 'second', isCompleted: 0});
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    completion.next(); completion.complete();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('loads details from the route and renders all user-facing fields', () => {
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем напоминание');
    expect(api.apiV1RemindersReminderIdGet$Json).toHaveBeenCalledExactlyOnceWith({reminderId: 'first'});
    expect(api.apiV1RemindersGet$Json).not.toHaveBeenCalled();
    resolve('first', data);
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(root().querySelector('.description-text')?.textContent).toBe(data.description);
    expect(root().querySelector('.category-label')?.textContent).toContain('Работа');
    expect(root().querySelector('.category-label a')?.getAttribute('href')).toBe('/categories/work');
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

  it('shows deletion only to the creator and opens a named confirmation before requesting DELETE', () => {
    resolve('first', data);
    const dialog = mockDeleteDialog();
    root().querySelector<HTMLButtonElement>('.delete-button')!.click();
    harness.detectChanges();
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(root().querySelector('.delete-record-name')?.textContent).toBe(data.title);
    expect(api.apiV1RemindersReminderIdDelete).not.toHaveBeenCalled();
    root().querySelector<HTMLButtonElement>('.delete-cancel')!.click();
    harness.detectChanges();
    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(component.deleteTarget()).toBeNull();
    expect(api.apiV1RemindersReminderIdDelete).not.toHaveBeenCalled();
  });

  it.each(['another-owner', null])('does not offer or allow deletion for identity %s', identity => {
    currentUserId.set(identity);
    resolve('first', data);
    const dialog = mockDeleteDialog();
    expect(root().querySelector('.delete-button')).toBeNull();
    component.openDelete();
    component.deleteReminder();
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(api.apiV1RemindersReminderIdDelete).not.toHaveBeenCalled();
  });

  it('does not offer deletion when creator information is missing', () => {
    resolve('first', {id: 'first', title: 'Задача'});
    expect(root().querySelector('.delete-button')).toBeNull();
  });

  it('blocks repeated DELETE calls and dismissal while the request is pending', () => {
    resolve('first', data);
    const dialog = mockDeleteDialog();
    component.openDelete();
    harness.detectChanges();
    root().querySelector<HTMLButtonElement>('.delete-confirm')!.click();
    component.deleteReminder();
    component.cancelDelete();
    harness.detectChanges();
    const cancel = new Event('cancel', {cancelable: true});
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(component.isDeleting()).toBe(true);
    expect(api.apiV1RemindersReminderIdDelete).toHaveBeenCalledExactlyOnceWith({reminderId: 'first'});
    expect(root().querySelector<HTMLButtonElement>('.delete-confirm')!.disabled).toBe(true);
    expect(root().querySelector<HTMLButtonElement>('.delete-cancel')!.disabled).toBe(true);
  });

  it('allows Escape before deletion and makes no request', () => {
    resolve('first', data);
    const dialog = mockDeleteDialog();
    component.openDelete();
    harness.detectChanges();
    const cancel = new Event('cancel', {cancelable: true});
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(false);
    expect(component.deleteTarget()).toBeNull();
    expect(api.apiV1RemindersReminderIdDelete).not.toHaveBeenCalled();
  });

  it('removes the cached item and replaces the details route with the list after success', async () => {
    resolve('first', data);
    mockDeleteDialog();
    component.navigationReminders.set([{id: 'first'}, {id: 'second'}]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    component.openDelete();
    component.deleteReminder();
    deletion.next();
    deletion.complete();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/reminders'], {replaceUrl: true});
    expect(root().textContent).toContain('Список');
    expect(component.navigationReminders().map(item => item.id)).toEqual(['second']);
    expect(component.isDeleting()).toBe(false);
  });

  it.each([0, 403, 404, 500])('keeps the current reminder on deletion error %s and supports retry', status => {
    resolve('first', data);
    const dialog = mockDeleteDialog();
    component.openDelete();
    component.deleteReminder();
    deletion.error({status});
    harness.detectChanges();
    expect(component.isDeleting()).toBe(false);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(root().querySelector('h1')?.textContent).toBe(data.title);
    expect(root().querySelector('.delete-error')?.textContent).toBeTruthy();
    expect(root().querySelector<HTMLButtonElement>('.delete-confirm')!.disabled).toBe(false);
    const retry = new Subject<void>();
    api.apiV1RemindersReminderIdDelete.mockReturnValue(retry.asObservable());
    component.deleteReminder();
    expect(api.apiV1RemindersReminderIdDelete).toHaveBeenCalledTimes(2);
    expect(component.deleteError()).toBeNull();
  });

  it('closes an obsolete confirmation and never deletes the next route by mistake', async () => {
    resolve('first', data);
    const dialog = mockDeleteDialog();
    component.openDelete();
    harness.detectChanges();
    await harness.navigateByUrl('/reminders/second', ReminderDetails);
    expect(dialog.close).toHaveBeenCalled();
    resolve('second', {...data, id: 'second', title: 'Другая задача'});
    component.deleteReminder();
    expect(component.deleteTarget()).toBeNull();
    expect(api.apiV1RemindersReminderIdDelete).not.toHaveBeenCalled();
  });

  it('keeps an in-flight DELETE bound to its original ID without redirecting another detail page', async () => {
    resolve('first', data);
    mockDeleteDialog();
    component.openDelete();
    component.deleteReminder();
    await harness.navigateByUrl('/reminders/second', ReminderDetails);
    resolve('second', {...data, id: 'second', title: 'Другая задача'});
    deletion.next();
    deletion.complete();
    harness.detectChanges();
    expect(api.apiV1RemindersReminderIdDelete).toHaveBeenCalledExactlyOnceWith({reminderId: 'first'});
    expect(TestBed.inject(Router).url).toBe('/reminders/second');
    expect(root().querySelector('h1')?.textContent).toBe('Другая задача');
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
