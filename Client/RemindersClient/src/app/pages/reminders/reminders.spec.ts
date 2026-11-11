import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { CategoriesService, RemindersService } from '../../api/services';
import { Reminders } from './reminders';

describe('Reminders', () => {
  let component: Reminders;
  let fixture: ComponentFixture<Reminders>;
  let response: Subject<ReminderListViewDto[]>;
  const remindersApi = { apiV1RemindersSearchPost$Json: vi.fn() };
  const categoriesApi = { apiV1CategoriesGet$Json: () => of([]) };
  const workReminders: ReminderListViewDto[] = [
    { id: 'work-1', title: 'Отчёт', categoryId: 'work', categoryName: 'Работа', priority: 3, isCompleted: 0 },
    { id: 'home-1', title: 'Покупки', categoryId: 'home', categoryName: 'Дом', priority: 1, isCompleted: 1 },
    { id: 'work-2', title: 'Встреча', categoryId: 'work', categoryName: 'Работа', priority: 2, isCompleted: 0 },
  ];

  function finishLoading(reminders: ReminderListViewDto[]): HTMLElement {
    response.next(reminders);
    response.complete();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function panelFor(button: HTMLButtonElement): HTMLUListElement {
    return fixture.nativeElement.querySelector(`#${button.getAttribute('aria-controls')}`)!;
  }

  function selectView(root: HTMLElement, mode: 'Карточки' | 'Таблица'): void {
    root.querySelector<HTMLButtonElement>(`.view-button[aria-label="${mode}"]`)!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    response = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReset();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(response.asObservable());

    await TestBed.configureTestingModule({
      imports: [Reminders],
      providers: [
        { provide: RemindersService, useValue: remindersApi },
        { provide: CategoriesService, useValue: categoriesApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Reminders);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it.each(['Карточки', 'Таблица'] as const)('shows loading before displaying %s', (mode) => {
    const root = fixture.nativeElement as HTMLElement;
    selectView(root, mode);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Загружаем');
    expect(root.querySelector('.category-group')).toBeNull();
    expect(root.querySelector('table')).toBeNull();
    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenCalledTimes(1);
  });

  it('groups interleaved reminders by category and keeps their original order', () => {
    const root = finishLoading(workReminders);
    const groups = root.querySelectorAll('.category-group');

    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('.category-name')?.textContent).toBe('Работа');
    expect(groups[0].querySelector('.category-count')?.textContent).toBe('2');
    expect([...groups[0].querySelectorAll('.card-title')].map((title) => title.textContent))
      .toEqual(['Отчёт', 'Встреча']);
    expect(groups[1].querySelector('.category-name')?.textContent).toBe('Дом');
    expect(groups[1].querySelector('.card-title')?.textContent).toBe('Покупки');
    expect(root.querySelector('.reminders-count')?.textContent).toContain('3 всего');
    expect([...root.querySelectorAll<HTMLButtonElement>('.category-toggle')]
      .every((button) => button.getAttribute('aria-expanded') === 'true')).toBe(true);
  });

  it('keeps categories with identical names and different IDs separate', () => {
    const root = finishLoading([
      { id: '1', title: 'Первое', categoryId: 'category-1', categoryName: 'Работа' },
      { id: '2', title: 'Второе', categoryId: 'category-2', categoryName: 'Работа' },
    ]);

    expect(root.querySelectorAll('.category-group')).toHaveLength(2);
    expect(component.categoryGroups().map((group) => group.reminders.length)).toEqual([1, 1]);
  });

  it('uses category names when IDs are absent and groups uncategorized reminders', () => {
    const root = finishLoading([
      { id: '1', categoryName: ' Учёба ' },
      { id: '2', categoryName: 'Учёба' },
      { id: '3' },
      { id: '4', categoryId: '', categoryName: '  ' },
    ]);

    expect([...root.querySelectorAll('.category-name')].map((name) => name.textContent))
      .toEqual(['Учёба', 'Без категории']);
    expect([...root.querySelectorAll('.category-count')].map((count) => count.textContent))
      .toEqual(['2', '2']);
  });

  it('collapses categories independently and restores their cards on the next click', () => {
    const root = finishLoading(workReminders);
    const [workButton, homeButton] = root.querySelectorAll<HTMLButtonElement>('.category-toggle');

    workButton.click();
    fixture.detectChanges();

    expect(workButton.getAttribute('aria-expanded')).toBe('false');
    expect(panelFor(workButton).hidden).toBe(true);
    expect(panelFor(homeButton).hidden).toBe(false);
    expect(workButton.querySelector('.category-name')?.textContent).toBe('Работа');
    expect(workButton.querySelector('.category-count')?.textContent).toBe('2');

    homeButton.click();
    fixture.detectChanges();
    expect(panelFor(homeButton).hidden).toBe(true);

    workButton.click();
    fixture.detectChanges();

    expect(workButton.getAttribute('aria-expanded')).toBe('true');
    expect(panelFor(workButton).hidden).toBe(false);
    expect(panelFor(workButton).querySelectorAll('app-reminder-card')).toHaveLength(2);
    expect(panelFor(homeButton).hidden).toBe(true);
  });

  it('keeps a category collapsed after reloading and renaming it', () => {
    const root = finishLoading(workReminders);
    root.querySelector<HTMLButtonElement>('.category-toggle')!.click();
    fixture.detectChanges();

    const refreshedResponse = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(refreshedResponse.asObservable());
    component.loadReminders();
    fixture.detectChanges();
    refreshedResponse.next([
      { id: 'new-1', categoryId: 'new', categoryName: 'Новая категория' },
      { id: 'work-1', categoryId: 'work', categoryName: 'Рабочие задачи' },
    ]);
    refreshedResponse.complete();
    fixture.detectChanges();

    const [newButton, workButton] = root.querySelectorAll<HTMLButtonElement>('.category-toggle');
    expect(panelFor(newButton).hidden).toBe(false);
    expect(workButton.querySelector('.category-name')?.textContent).toBe('Рабочие задачи');
    expect(workButton.getAttribute('aria-expanded')).toBe('false');
    expect(panelFor(workButton).hidden).toBe(true);
    expect(panelFor(workButton).getAttribute('aria-labelledby')).toBe(workButton.id);
  });

  it('switches from icon-only controls to an ungrouped table with the same fields', () => {
    const root = finishLoading(workReminders);
    const cardsButton = root.querySelector<HTMLButtonElement>('[aria-label="Карточки"]')!;
    const tableButton = root.querySelector<HTMLButtonElement>('[aria-label="Таблица"]')!;

    expect(cardsButton.textContent?.trim()).toBe('');
    expect(tableButton.textContent?.trim()).toBe('');
    expect(cardsButton.querySelector('svg')).not.toBeNull();
    expect(tableButton.querySelector('svg')).not.toBeNull();
    expect(cardsButton.getAttribute('aria-pressed')).toBe('true');
    expect(tableButton.getAttribute('aria-pressed')).toBe('false');

    selectView(root, 'Таблица');

    expect(cardsButton.getAttribute('aria-pressed')).toBe('false');
    expect(tableButton.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.category-group')).toBeNull();
    expect(root.querySelector('app-reminder-card')).toBeNull();
    expect([...root.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim()))
      .toEqual(['Название', 'Категория', 'Приоритет', 'Статус']);

    const rows = root.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect([...rows].map((row) => row.cells[0].textContent?.trim()))
      .toEqual(['Отчёт', 'Покупки', 'Встреча']);
    expect([...rows].map((row) => row.cells[1].textContent?.trim()))
      .toEqual(['Работа', 'Дом', 'Работа']);
    expect([...rows].map((row) => row.cells[2].textContent?.trim()))
      .toEqual(['Высокий', 'Низкий', 'Средний']);
    expect([...rows].map((row) => row.cells[3].textContent?.trim()))
      .toEqual(['Не выполнено', 'Выполнено', 'Не выполнено']);
    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenCalledTimes(1);
  });

  it('includes collapsed categories in the table and restores their state when returning to cards', () => {
    const root = finishLoading(workReminders);
    root.querySelector<HTMLButtonElement>('.category-toggle')!.click();
    fixture.detectChanges();

    selectView(root, 'Таблица');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    selectView(root, 'Карточки');

    const [workButton, homeButton] = root.querySelectorAll<HTMLButtonElement>('.category-toggle');
    expect(workButton.getAttribute('aria-expanded')).toBe('false');
    expect(panelFor(workButton).hidden).toBe(true);
    expect(panelFor(homeButton).hidden).toBe(false);
    expect(root.querySelector('table')).toBeNull();
    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenCalledTimes(1);
  });

  it('keeps table sorting across view switches and new search results without changing cards', () => {
    const root = finishLoading(workReminders);
    selectView(root, 'Таблица');
    root.querySelector<HTMLButtonElement>('thead button')!.click();
    fixture.detectChanges();
    expect([...root.querySelectorAll('tbody th')].map((cell) => cell.textContent?.trim()))
      .toEqual(['Встреча', 'Отчёт', 'Покупки']);
    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenCalledTimes(1);

    selectView(root, 'Карточки');
    expect([...root.querySelector('.category-group')!.querySelectorAll('.card-title')]
      .map((title) => title.textContent)).toEqual(['Отчёт', 'Встреча']);
    selectView(root, 'Таблица');
    expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');

    const refreshed = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(refreshed.asObservable());
    component.loadReminders();
    fixture.detectChanges();
    refreshed.next([{ id: 'z', title: 'Яблоко' }, { id: 'a', title: 'Абрикос' }]);
    refreshed.complete();
    fixture.detectChanges();
    expect([...root.querySelectorAll('tbody th')].map((cell) => cell.textContent?.trim()))
      .toEqual(['Абрикос', 'Яблоко']);
    expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('uses the same fallback labels and completion states in the table', () => {
    const root = finishLoading([
      { id: '1' },
      { id: '2', title: 'Задача', categoryName: 'Личное', priority: 4, isCompleted: 1 },
      { id: '3', title: 'Проверка', priority: 99, isCompleted: 0 },
    ]);
    selectView(root, 'Таблица');

    const rows = root.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect([...rows[0].cells].map((cell) => cell.textContent?.trim()))
      .toEqual(['Без названия', 'Без категории', 'Без приоритета', 'Не выполнено']);
    expect(rows[1].querySelector('.priority-badge')?.textContent).toBe('Критический');
    expect(rows[1].querySelector('.completion-status--completed')).not.toBeNull();
    expect(rows[2].querySelector('.priority-badge')?.textContent).toBe('Неизвестен');
    expect(rows[2].querySelector('.completion-status--completed')).toBeNull();
  });

  it('submits the search form without a page reload and displays the matching reminders', () => {
    const root = finishLoading(workReminders);
    const input = root.querySelector<HTMLInputElement>('#reminder-search')!;
    input.value = '  Отчёт  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const searchResponse = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(searchResponse.asObservable());
    const submission = new Event('submit', { bubbles: true, cancelable: true });

    root.querySelector('form')!.dispatchEvent(submission);
    fixture.detectChanges();

    expect(submission.defaultPrevented).toBe(true);
    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenLastCalledWith({
      body: { categoryIds: [], priorityTypes: [], completedStatus: null, searchText: 'Отчёт' },
    });
    expect(component.isLoading()).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    searchResponse.next([workReminders[0]]);
    searchResponse.complete();
    fixture.detectChanges();

    expect([...root.querySelectorAll('.card-title')].map((title) => title.textContent)).toEqual(['Отчёт']);
    expect(input.value).toBe('  Отчёт  ');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('searches on the submit button and restores all reminders after clearing the input', () => {
    const root = finishLoading(workReminders);
    const input = root.querySelector<HTMLInputElement>('#reminder-search')!;
    input.value = 'Покупки';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const searchResponse = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(searchResponse.asObservable());
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenCalledTimes(2);
    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenLastCalledWith({
      body: { categoryIds: [], priorityTypes: [], completedStatus: null, searchText: 'Покупки' },
    });
    searchResponse.next([workReminders[1]]);
    searchResponse.complete();
    fixture.detectChanges();

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const clearedResponse = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(clearedResponse.asObservable());
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenLastCalledWith({
      body: { categoryIds: [], priorityTypes: [], completedStatus: null, searchText: null },
    });
    clearedResponse.next(workReminders);
    clearedResponse.complete();
    fixture.detectChanges();
    expect(root.querySelectorAll('app-reminder-card')).toHaveLength(3);
  });

  it('counts active selections and combines them with the search, preserving status zero', () => {
    const root = finishLoading(workReminders);
    component.searchControl.setValue('Отчёт');
    const filteredResponse = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersSearchPost$Json.mockReturnValue(filteredResponse.asObservable());
    component.applyFilters({ categoryIds: ['work'], priorityTypes: [3], completedStatus: 0 });
    fixture.detectChanges();

    expect(remindersApi.apiV1RemindersSearchPost$Json).toHaveBeenLastCalledWith({
      body: { categoryIds: ['work'], priorityTypes: [3], completedStatus: 0, searchText: 'Отчёт' },
    });
    expect(component.activeFiltersCount()).toBe(3);
    expect(root.querySelector('.filter-count')?.textContent).toBe('3');
    filteredResponse.next([workReminders[0]]);
    filteredResponse.complete();
  });

  it.each(['Карточки', 'Таблица'] as const)('shows the empty state in %s mode', (mode) => {
    const root = finishLoading([]);
    selectView(root, mode);
    expect(root.querySelector('.category-group')).toBeNull();
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.state-title')?.textContent).toBe('Напоминаний пока нет');
  });

  it.each(['Карточки', 'Таблица'] as const)('shows the request error in %s mode', (mode) => {
    response.error({ status: 500 });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    selectView(root, mode);
    expect(root.querySelector('[role="alert"]')?.textContent)
      .toContain('Не удалось загрузить напоминания.');
    expect(root.querySelector('.category-group')).toBeNull();
    expect(root.querySelector('table')).toBeNull();
  });
});
