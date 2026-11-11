import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReminderCard } from './reminder-card';

describe('ReminderCard', () => {
  let component: ReminderCard;
  let fixture: ComponentFixture<ReminderCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ReminderCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('reminder', { id: 'card-1', title: 'Задача' });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links the title to its details page', () => {
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/reminders/card-1');
  });

  it('keeps reminders without an ID readable without an invalid link', () => {
    fixture.componentRef.setInput('reminder', { title: 'Без ссылки' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.querySelector('.card-title')?.textContent.trim()).toBe('Без ссылки');
  });

  it('links the category independently from the full-card reminder link', () => {
    fixture.componentRef.setInput('reminder', {id: 'task', categoryId: 'work', categoryName: 'Работа', title: 'Отчёт'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.card-category a')?.getAttribute('href')).toBe('/categories/work');
    expect(fixture.nativeElement.querySelector('.card-title a')?.getAttribute('href')).toBe('/reminders/task');
  });
});
