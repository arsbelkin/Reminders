import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { RemindersService } from '../../api/services';
import { Reminders } from './reminders';

describe('Reminders', () => {
  let component: Reminders;
  let fixture: ComponentFixture<Reminders>;
  let response: Subject<ReminderListViewDto[]>;
  const remindersApi = { apiV1RemindersGet$Json: vi.fn() };
  const workReminders: ReminderListViewDto[] = [
    { id: 'work-1', title: 'Отчёт', categoryId: 'work', categoryName: 'Работа' },
    { id: 'home-1', title: 'Покупки', categoryId: 'home', categoryName: 'Дом' },
    { id: 'work-2', title: 'Встреча', categoryId: 'work', categoryName: 'Работа' },
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

  beforeEach(async () => {
    response = new Subject<ReminderListViewDto[]>();
    remindersApi.apiV1RemindersGet$Json.mockReset();
    remindersApi.apiV1RemindersGet$Json.mockReturnValue(response.asObservable());

    await TestBed.configureTestingModule({
      imports: [Reminders],
      providers: [{ provide: RemindersService, useValue: remindersApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(Reminders);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('shows loading before displaying category groups', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Загружаем');
    expect(root.querySelector('.category-group')).toBeNull();
    expect(remindersApi.apiV1RemindersGet$Json).toHaveBeenCalledTimes(1);
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
    remindersApi.apiV1RemindersGet$Json.mockReturnValue(refreshedResponse.asObservable());
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

  it('shows the empty state without empty category headers', () => {
    const root = finishLoading([]);
    expect(root.querySelector('.category-group')).toBeNull();
    expect(root.querySelector('.state-title')?.textContent).toBe('Напоминаний пока нет');
  });

  it('shows the request error instead of category groups', () => {
    response.error({ status: 500 });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent)
      .toContain('Не удалось загрузить напоминания.');
    expect(root.querySelector('.category-group')).toBeNull();
  });
});
