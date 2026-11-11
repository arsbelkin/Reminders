import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReminderFilters } from './reminder-filters';

describe('ReminderFilters', () => {
  let component: ReminderFilters;
  let fixture: ComponentFixture<ReminderFilters>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderFilters],
    }).compileComponents();

    fixture = TestBed.createComponent(ReminderFilters);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('selects several checkboxes and emits numeric priorities and status only on apply', () => {
    fixture.componentRef.setInput('categories', [
      { id: 'work', title: 'Работа' }, { id: 'home', title: 'Дом' },
    ]);
    component.setValues({ categoryIds: ['work'], priorityTypes: [0, 3], completedStatus: 0 });
    fixture.detectChanges();
    const onApply = vi.fn();
    component.filtersApplied.subscribe(onApply);
    const close = vi.spyOn(component, 'close').mockImplementation(() => {});
    const root = fixture.nativeElement as HTMLElement;
    const categories = root.querySelectorAll<HTMLInputElement>('.category-options input');
    const priorities = root.querySelectorAll<HTMLInputElement>('.priority-options input');

    expect(categories[0].checked).toBe(true);
    expect(priorities[0].checked).toBe(true);
    expect(priorities[3].checked).toBe(true);
    categories[1].click();
    priorities[0].click();
    fixture.detectChanges();
    expect(component.form.controls.priorityTypes.value).toEqual([3]);
    priorities[0].click();
    fixture.detectChanges();
    expect(onApply).not.toHaveBeenCalled();

    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({
      categoryIds: ['work', 'home'], priorityTypes: [3, 0], completedStatus: 0,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('resets the draft without mutating applied values and restores checked options', () => {
    fixture.componentRef.setInput('categories', [
      { id: 'work', title: 'Работа' }, { id: 'home', title: 'Дом' },
    ]);
    const applied = { categoryIds: ['work'], priorityTypes: [4], completedStatus: 1 };
    component.setValues(applied);
    fixture.detectChanges();
    const onApply = vi.fn();
    component.filtersApplied.subscribe(onApply);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLInputElement>('.category-options input')[1].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.reset-button')!.click();
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({ categoryIds: [], priorityTypes: [], completedStatus: null });
    expect(applied).toEqual({ categoryIds: ['work'], priorityTypes: [4], completedStatus: 1 });
    expect(onApply).not.toHaveBeenCalled();
    component.setValues(applied);
    fixture.detectChanges();
    expect(root.querySelectorAll<HTMLInputElement>('.category-options input')[0].checked).toBe(true);
    expect(root.querySelectorAll<HTMLInputElement>('.category-options input')[1].checked).toBe(false);
    expect(root.querySelectorAll<HTMLInputElement>('.priority-options input')[4].checked).toBe(true);
  });
});
