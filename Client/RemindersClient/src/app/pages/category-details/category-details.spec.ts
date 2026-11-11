import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of } from 'rxjs';
import { CategoriesService, RemindersService } from '../../api/services';
import { CategoryInfoViewDto } from '../../api/models/category-info-view-dto';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { authGuard } from '../../auth/auth.guard';
import { routes } from '../../app.routes';
import { CategoryDetails } from './category-details';

@Component({template: '<p>Вход</p>'}) class LoginStub {}
@Component({template: '<p>Список</p>'}) class ListStub {}

describe('CategoryDetails', () => {
  const categories = {apiV1CategoriesCategoryIdGet$Json: vi.fn(), apiV1CategoriesGet$Json: vi.fn()};
  const reminders = {apiV1RemindersSearchPost$Json: vi.fn()};
  let categoryRequests: Map<string, Subject<CategoryInfoViewDto>>;
  let reminderRequests: Map<string, Subject<ReminderListViewDto[]>>;
  let harness: RouterTestingHarness;
  let component: CategoryDetails;
  let allowed: boolean;
  const data: CategoryInfoViewDto = {
    id: 'work', title: 'Работа', description: 'Задачи команды.\nОбщие планы.',
    createdTime: '2026-11-01T09:00:00Z', creatorEmail: 'anna@example.test',
    usersEmails: ['anna@example.test', 'ivan@example.test'],
  };
  const items: ReminderListViewDto[] = [
    {id: 'task-1', categoryId: 'work', categoryName: 'Работа', title: 'Отчёт', priority: 3, isCompleted: 0},
    {id: 'task-2', categoryId: 'work', categoryName: 'Работа', title: 'Встреча', priority: 2, isCompleted: 1},
  ];
  function root(): HTMLElement { return harness.routeNativeElement!; }
  function resolveCategory(id = 'work', value = data): void {
    categoryRequests.get(id)!.next(value);
    categoryRequests.get(id)!.complete();
    harness.detectChanges();
  }
  function resolveReminders(id = 'work', value = items): void {
    reminderRequests.get(id)!.next(value);
    reminderRequests.get(id)!.complete();
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
    categoryRequests = new Map();
    reminderRequests = new Map();
    categories.apiV1CategoriesGet$Json.mockReset().mockReturnValue(of([
      {id: 'work', title: 'Работа'}, {id: 'home', title: 'Личное'},
    ]));
    categories.apiV1CategoriesCategoryIdGet$Json.mockReset().mockImplementation(({categoryId}: {categoryId: string}) => {
      const response = new Subject<CategoryInfoViewDto>();
      categoryRequests.set(categoryId, response);
      return response.asObservable();
    });
    reminders.apiV1RemindersSearchPost$Json.mockReset().mockImplementation(({body}: {body: {categoryIds: string[]}}) => {
      const response = new Subject<ReminderListViewDto[]>();
      reminderRequests.set(body.categoryIds[0], response);
      return response.asObservable();
    });
    TestBed.configureTestingModule({
      providers: [
        {provide: CategoriesService, useValue: categories},
        {provide: RemindersService, useValue: reminders},
        {provide: TokenStorageService, useValue: {getToken: () => allowed ? 'token' : null}},
        provideRouter([
          {path: 'categories/:id', component: CategoryDetails, canActivate: [authGuard]},
          {path: 'reminders', component: ListStub},
          {path: 'login', component: LoginStub},
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/categories/work', CategoryDetails);
  });

  it('loads the category once and fetches only its reminders after access is confirmed', () => {
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем категорию');
    expect(categories.apiV1CategoriesCategoryIdGet$Json).toHaveBeenCalledExactlyOnceWith({categoryId: 'work'});
    expect(reminders.apiV1RemindersSearchPost$Json).not.toHaveBeenCalled();
    resolveCategory();
    expect(root().querySelector('h1')?.textContent).toBe('Работа');
    expect(root().querySelector('.description-text')?.textContent).toBe(data.description);
    expect(root().querySelectorAll('.members-list li')).toHaveLength(2);
    expect(root().querySelector('.details-meta')?.textContent).toContain(data.creatorEmail);
    expect(root().querySelector('time')?.getAttribute('datetime')).toBe(data.createdTime);
    expect(reminders.apiV1RemindersSearchPost$Json).toHaveBeenCalledExactlyOnceWith({body: {categoryIds: ['work'], completedStatus: 0}});
    expect(root().querySelector('.category-reminders [role="status"]')).not.toBeNull();
    resolveReminders();
    expect(root().querySelectorAll('app-reminder-card')).toHaveLength(2);
    expect(root().querySelector('.category-reminders-heading .members-count')?.textContent).toBe('2');
    expect(root().querySelector('.card-title a')?.getAttribute('href')).toBe('/reminders/task-1');
  });

  it('toggles completed reminders within the current category', () => {
    resolveCategory();
    resolveReminders();
    const toggle = root().querySelector<HTMLButtonElement>('.completed-toggle')!;
    toggle.click();
    harness.detectChanges();
    TestBed.tick();
    expect(reminders.apiV1RemindersSearchPost$Json).toHaveBeenLastCalledWith({body: {categoryIds: ['work'], completedStatus: null}});
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    harness.detectChanges();
    TestBed.tick();
    expect(reminders.apiV1RemindersSearchPost$Json).toHaveBeenLastCalledWith({body: {categoryIds: ['work'], completedStatus: 0}});
  });

  it('handles empty categories and optional metadata', () => {
    resolveCategory('work', {id: 'work', description: '  '});
    resolveReminders('work', []);
    expect(root().querySelector('h1')?.textContent).toBe('Без названия');
    expect(root().textContent).toContain('Описание не добавлено.');
    expect(root().textContent).toContain('Участники не указаны.');
    expect(root().querySelector('.details-meta')?.textContent).toContain('Не указан');
    expect(root().querySelector('.category-reminders-state')?.textContent).toContain('Нет незавершённых напоминаний');
    expect(root().querySelector('.category-reminders-heading .members-count')?.textContent).toBe('0');
    expect(component.formatDate('invalid date')).toBe('Не указана');
  });

  it.each([400, 404])('does not load reminders for a missing category (status=%s)', status => {
    categoryRequests.get('work')!.error({status});
    harness.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Категория не найдена');
    expect(root().querySelector('.category-reminders')).toBeNull();
    expect(reminders.apiV1RemindersSearchPost$Json).not.toHaveBeenCalled();
    expect(root().querySelector('.details-state a')?.getAttribute('href')).toBe('/reminders');
  });

  it('handles forbidden categories without requesting their reminders', () => {
    categoryRequests.get('work')!.error({status: 403});
    harness.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Нет доступа к категории');
    expect(reminders.apiV1RemindersSearchPost$Json).not.toHaveBeenCalled();
  });

  it.each([0, 500])('can retry the category after a transient error (status=%s)', status => {
    categoryRequests.get('work')!.error({status});
    harness.detectChanges();
    root().querySelector<HTMLButtonElement>('.retry-button')!.click();
    harness.detectChanges();
    expect(root().querySelector('[role="status"]')).not.toBeNull();
    resolveCategory();
    resolveReminders();
    expect(root().querySelector('h1')?.textContent).toBe('Работа');
    expect(categories.apiV1CategoriesCategoryIdGet$Json).toHaveBeenCalledTimes(2);
  });

  it('retries failed reminders without refetching or hiding category information', () => {
    resolveCategory();
    reminderRequests.get('work')!.error({status: 500});
    harness.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Работа');
    expect(root().querySelector('.category-reminders [role="alert"]')).not.toBeNull();
    root().querySelector<HTMLButtonElement>('.category-reminders .retry-button')!.click();
    harness.detectChanges();
    resolveReminders();
    expect(categories.apiV1CategoriesCategoryIdGet$Json).toHaveBeenCalledTimes(1);
    expect(reminders.apiV1RemindersSearchPost$Json).toHaveBeenCalledTimes(2);
    expect(root().querySelectorAll('app-reminder-card')).toHaveLength(2);
  });

  it('cancels older category requests when switching IDs', async () => {
    const pending = categoryRequests.get('work')!;
    await harness.navigateByUrl('/categories/home', CategoryDetails);
    expect(pending.observed).toBe(false);
    pending.next(data);
    resolveCategory('home', {id: 'home', title: 'Личное'});
    resolveReminders('home', []);
    expect(root().querySelector('h1')?.textContent).toBe('Личное');
    expect(reminders.apiV1RemindersSearchPost$Json).toHaveBeenCalledExactlyOnceWith({body: {categoryIds: ['home'], completedStatus: 0}});
  });

  it('cancels stale reminders and clears old content while the next category is loading', async () => {
    resolveCategory();
    const pending = reminderRequests.get('work')!;
    await harness.navigateByUrl('/categories/home', CategoryDetails);
    expect(pending.observed).toBe(false);
    pending.next(items);
    harness.detectChanges();
    expect(root().querySelector('.details-card')).toBeNull();
    expect(root().querySelector('app-reminder-card')).toBeNull();
    resolveCategory('home', {id: 'home', title: 'Личное'});
    resolveReminders('home', []);
    expect(root().querySelector('h1')?.textContent).toBe('Личное');
    expect(root().querySelectorAll('app-reminder-card')).toHaveLength(0);
  });

  it('loads the category drawer lazily and reuses its list', () => {
    resolveCategory();
    resolveReminders();
    const dialog = mockDialog();
    expect(categories.apiV1CategoriesGet$Json).not.toHaveBeenCalled();
    component.openNavigation();
    harness.detectChanges();
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(categories.apiV1CategoriesGet$Json).toHaveBeenCalledTimes(1);
    expect(root().querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/categories/work');
    component.closeNavigation();
    component.openNavigation();
    harness.detectChanges();
    expect(categories.apiV1CategoriesGet$Json).toHaveBeenCalledTimes(1);
  });

  it('filters the drawer locally, switches categories and resets the search on reopening', async () => {
    resolveCategory();
    resolveReminders();
    const dialog = mockDialog();
    component.openNavigation();
    harness.detectChanges();
    component.navigationSearch.setValue('  ЛИЧНОЕ  ');
    harness.detectChanges();
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(1);
    root().querySelector<HTMLAnchorElement>('.navigation-item')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(categories.apiV1CategoriesCategoryIdGet$Json).toHaveBeenLastCalledWith({categoryId: 'home'});
    resolveCategory('home', {id: 'home', title: 'Личное'});
    resolveReminders('home', []);
    component.openNavigation();
    harness.detectChanges();
    expect(component.navigationSearch.value).toBe('');
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(2);
    expect(root().querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/categories/home');
    expect(categories.apiV1CategoriesGet$Json).toHaveBeenCalledTimes(1);
  });

  it('can retry a category-list failure without losing the current category', () => {
    resolveCategory();
    resolveReminders();
    mockDialog();
    const response = new Subject<{id: string; title: string}[]>();
    categories.apiV1CategoriesGet$Json.mockReturnValueOnce(response.asObservable());
    component.openNavigation();
    harness.detectChanges();
    expect(root().querySelector('.navigation-state[role="status"]')).not.toBeNull();
    response.error({status: 500});
    harness.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Работа');
    root().querySelector<HTMLButtonElement>('.navigation-state .retry-button')!.click();
    harness.detectChanges();
    expect(root().querySelectorAll('.navigation-item')).toHaveLength(2);
    expect(categories.apiV1CategoriesGet$Json).toHaveBeenCalledTimes(2);
  });

  it('shows empty and unmatched category lists', () => {
    resolveCategory();
    resolveReminders();
    mockDialog();
    categories.apiV1CategoriesGet$Json.mockReturnValue(of([]));
    component.openNavigation();
    harness.detectChanges();
    expect(root().querySelector('.navigation-state')?.textContent).toContain('Категорий пока нет.');
    component.navigationSearch.setValue('нет совпадений');
    harness.detectChanges();
    expect(root().querySelector('.navigation-state')?.textContent).toContain('Ничего не найдено');
  });

  it('cancels a pending category-list request when leaving the page', async () => {
    resolveCategory();
    resolveReminders();
    mockDialog();
    const response = new Subject<{id: string; title: string}[]>();
    categories.apiV1CategoriesGet$Json.mockReturnValue(response.asObservable());
    component.openNavigation();
    expect(response.observed).toBe(true);
    await harness.navigateByUrl('/reminders', ListStub);
    expect(response.observed).toBe(false);
  });

  it('protects direct category URLs with the auth guard', async () => {
    expect(routes.find(route => route.path === 'categories/:id')?.canActivate).toContain(authGuard);
    allowed = false;
    categories.apiV1CategoriesCategoryIdGet$Json.mockClear();
    await harness.navigateByUrl('/categories/another', LoginStub);
    expect(root().textContent).toContain('Вход');
    expect(categories.apiV1CategoriesCategoryIdGet$Json).not.toHaveBeenCalled();
  });
});
