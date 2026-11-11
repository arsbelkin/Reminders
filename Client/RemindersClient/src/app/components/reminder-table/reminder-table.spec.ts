import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { ReminderTable } from './reminder-table';

describe('ReminderTable sorting', () => {
  let fixture: ComponentFixture<ReminderTable>;
  let root: HTMLElement;
  const reminders: ReminderListViewDto[] = [
    { id: 'z', title: 'Яблоко', categoryName: 'Работа', priority: 4, isCompleted: 1 },
    { id: '10', title: 'Задача 10', categoryName: 'Дом', priority: 2, isCompleted: 0 },
    { id: '2', title: 'задача 2', categoryName: 'Учёба', priority: 0, isCompleted: 0 },
    { id: 'a', title: 'Арбуз', categoryName: 'дом', priority: 3, isCompleted: 1 },
    { id: 'tie', title: 'арбуз', categoryName: 'Работа', priority: 1, isCompleted: 0 },
  ];
  Object.freeze(reminders);

  function titles(): string[] {
    return [...root.querySelectorAll('tbody th')].map((cell) => cell.textContent!.trim());
  }

  function sortBy(label: string): void {
    [...root.querySelectorAll<HTMLButtonElement>('thead button')]
      .find((button) => button.textContent!.trim() === label)!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReminderTable], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(ReminderTable);
    fixture.componentRef.setInput('reminders', reminders);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  it('keeps the API order until a column is selected', () => {
    expect(titles()).toEqual(['Яблоко', 'Задача 10', 'задача 2', 'Арбуз', 'арбуз']);
    expect(root.querySelector('thead [aria-sort]')).toBeNull();
    expect(root.querySelectorAll('thead button')).toHaveLength(4);
  });

  it('sorts Russian titles in both directions without changing the input array', () => {
    sortBy('Название');
    expect(titles()).toEqual(['Арбуз', 'арбуз', 'задача 2', 'Задача 10', 'Яблоко']);
    expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');

    sortBy('Название');
    expect(titles()).toEqual(['Яблоко', 'Задача 10', 'задача 2', 'Арбуз', 'арбуз']);
    expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
    expect(reminders.map((reminder) => reminder.id)).toEqual(['z', '10', '2', 'a', 'tie']);
  });

  it('starts the next column in ascending order and marks only that header', () => {
    sortBy('Название');
    sortBy('Название');
    sortBy('Категория');

    expect(titles()).toEqual(['Задача 10', 'Арбуз', 'Яблоко', 'арбуз', 'задача 2']);
    const sortedHeaders = root.querySelectorAll('thead th[aria-sort]');
    expect(sortedHeaders).toHaveLength(1);
    expect(sortedHeaders[0].textContent?.trim()).toBe('Категория');
    expect(sortedHeaders[0].getAttribute('aria-sort')).toBe('ascending');
  });

  it.each([
    { label: 'Приоритет', ascending: ['задача 2', 'арбуз', 'Задача 10', 'Арбуз', 'Яблоко'],
      descending: ['Яблоко', 'Арбуз', 'Задача 10', 'арбуз', 'задача 2'] },
    { label: 'Статус', ascending: ['Задача 10', 'задача 2', 'арбуз', 'Яблоко', 'Арбуз'],
      descending: ['Яблоко', 'Арбуз', 'Задача 10', 'задача 2', 'арбуз'] },
  ])('sorts $label by its numeric value, including zero', ({ label, ascending, descending }) => {
    sortBy(label);
    expect(titles()).toEqual(ascending);
    sortBy(label);
    expect(titles()).toEqual(descending);
  });

  it('uses the displayed fallback labels and default numeric values', () => {
    fixture.componentRef.setInput('reminders', [
      { id: 'blank' },
      { id: 'a', title: 'Альфа', categoryName: 'Работа', priority: 1, isCompleted: 1 },
      { id: 'b', title: 'Встреча', categoryName: 'Архив', priority: 0, isCompleted: 0 },
    ]);
    fixture.detectChanges();

    sortBy('Название');
    expect(titles()).toEqual(['Альфа', 'Без названия', 'Встреча']);
    sortBy('Категория');
    expect(titles()).toEqual(['Встреча', 'Без названия', 'Альфа']);
    sortBy('Приоритет');
    expect(titles()).toEqual(['Без названия', 'Встреча', 'Альфа']);
    sortBy('Статус');
    expect(titles()).toEqual(['Без названия', 'Встреча', 'Альфа']);
  });

  it('keeps the selected order when results change or become empty', () => {
    sortBy('Название');
    fixture.componentRef.setInput('reminders', []);
    fixture.detectChanges();
    expect(titles()).toEqual([]);

    fixture.componentRef.setInput('reminders', [
      { id: 'z', title: 'Яблоко' }, { id: 'a', title: 'Абрикос' },
    ]);
    fixture.detectChanges();
    expect(titles()).toEqual(['Абрикос', 'Яблоко']);
    expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');
  });
});
