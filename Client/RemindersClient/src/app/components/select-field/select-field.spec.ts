import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectField } from './select-field';

@Component({imports: [ReactiveFormsModule, SelectField], template: `
  <form [formGroup]="form" (ngSubmit)="submits = submits + 1">
    <label id="category-label" for="category">Категория</label>
    <app-select-field formControlName="category" inputId="category" [options]="options()" [disabled]="disabled()" [required]="true" [category]="true" />
    <label id="priority-label" for="priority">Приоритет</label>
    <app-select-field formControlName="priority" inputId="priority" [options]="priorities" />
    <button type="submit">Сохранить</button>
  </form>`})
class Host {
  readonly form = new FormGroup({category: new FormControl('', {nonNullable: true, validators: Validators.required}), priority: new FormControl(0, {nonNullable: true})});
  readonly options = signal([{value: 'work', label: 'Работа'}, {value: 'home', label: 'Личное'}, {value: 'study', label: 'Учёба'}]);
  readonly priorities = [{value: 0, label: 'Без приоритета'}, {value: 4, label: 'Критический'}];
  readonly disabled = signal(false);
  submits = 0;
}

describe('SelectField', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const root = () => fixture.nativeElement as HTMLElement;
  const trigger = (id = 'category') => root().querySelector<HTMLButtonElement>('#' + id)!;
  const panel = (id = 'category') => root().querySelector<HTMLDivElement>('#' + id + '-options')!;
  const key = (value: string, id = 'category') => {
    const event = new KeyboardEvent('keydown', {key: value, bubbles: true, cancelable: true});
    trigger(id).dispatchEvent(event); fixture.detectChanges(); return event;
  };
  beforeEach(async () => {
    TestBed.configureTestingModule({}); fixture = TestBed.createComponent(Host); host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('selects an option through the styled menu and marks the form control touched', () => {
    expect(host.form.controls.category.invalid).toBe(true);
    trigger().click(); fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    panel().querySelectorAll<HTMLButtonElement>('[role="option"]')[1].click(); fixture.detectChanges();
    expect(host.form.controls.category.value).toBe('home'); expect(host.form.controls.category.touched).toBe(true);
    expect(trigger().textContent).toContain('Личное'); expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger()); expect(host.submits).toBe(0);
  });

  it('preserves numeric zero and marks the selected priority', () => {
    host.form.controls.priority.setValue(4); fixture.detectChanges(); trigger('priority').click(); fixture.detectChanges();
    expect(panel('priority').querySelector('.selected')?.textContent).toContain('Критический');
    panel('priority').querySelector<HTMLButtonElement>('[role="option"]')!.click(); fixture.detectChanges();
    expect(host.form.controls.priority.value).toBe(0); expect(trigger('priority').textContent).toContain('Без приоритета');
  });

  it('opens, navigates with arrows and commits with Enter without submitting the outer form', () => {
    expect(key('Enter').defaultPrevented).toBe(true); key('ArrowDown'); key('Enter');
    expect(host.form.controls.category.value).toBe('home'); expect(host.submits).toBe(0);
  });

  it('supports Home, End and typing the beginning of a label', () => {
    key('End'); key('Enter'); expect(host.form.controls.category.value).toBe('study');
    key('Home'); key('Enter'); expect(host.form.controls.category.value).toBe('work');
    key('л'); key('Enter'); expect(host.form.controls.category.value).toBe('home');
  });

  it('closes on Escape without changing the value or dismissing the parent dialog', () => {
    host.form.controls.category.setValue('work'); fixture.detectChanges(); key('Enter'); key('ArrowDown');
    const escape = key('Escape');
    expect(escape.defaultPrevented).toBe(true); expect(host.form.controls.category.value).toBe('work');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on outside clicks, focus leaving and Tab', () => {
    trigger().click(); fixture.detectChanges(); document.body.click(); fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    trigger().click(); fixture.detectChanges();
    trigger().dispatchEvent(new FocusEvent('focusout', {bubbles: true, relatedTarget: trigger('priority')})); fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    trigger().click(); fixture.detectChanges(); expect(key('Tab').defaultPrevented).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('resets a pending choice without leaving the control touched', () => {
    host.form.controls.category.setValue('work'); fixture.detectChanges(); trigger().click(); fixture.detectChanges();
    host.form.reset(); fixture.detectChanges();
    expect(host.form.controls.category.value).toBe(''); expect(host.form.controls.category.untouched).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('blocks interaction both through its input and the Angular form disabled state', () => {
    trigger().click(); fixture.detectChanges(); host.disabled.set(true); fixture.detectChanges();
    expect(trigger().disabled).toBe(true); expect(trigger().getAttribute('aria-expanded')).toBe('false');
    trigger().click(); expect(host.form.controls.category.value).toBe('');
    host.disabled.set(false); host.form.controls.category.disable(); fixture.detectChanges(); expect(trigger().disabled).toBe(true);
  });

  it('positions a native popover above a low trigger and hides it when the dialog closes', () => {
    const show = vi.fn(); const hide = vi.fn();
    panel().showPopover = show; panel().hidePopover = hide;
    vi.spyOn(trigger(), 'getBoundingClientRect').mockReturnValue({top: 700, bottom: 750, left: 30, width: 300} as DOMRect);
    trigger().click(); fixture.detectChanges();
    expect(show).toHaveBeenCalledTimes(1); expect(parseFloat(panel().style.top)).toBeLessThan(700); expect(panel().style.width).toBe('300px');
    root().dispatchEvent(new Event('close')); fixture.detectChanges();
    expect(hide).toHaveBeenCalledTimes(1); expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('handles empty option lists without selecting an invalid value', () => {
    host.options.set([]); fixture.detectChanges(); key('Enter'); key('Enter');
    expect(host.form.controls.category.value).toBe(''); expect(panel().textContent).toContain('Нет доступных вариантов');
  });

  it('keeps the menu anchored when validation shifts and scrolls the form', () => {
    panel().showPopover = vi.fn(); panel().hidePopover = vi.fn();
    const rect = vi.spyOn(trigger(), 'getBoundingClientRect');
    rect.mockReturnValue({top: 100, bottom: 150, left: 30, width: 300} as DOMRect);
    trigger().click(); fixture.detectChanges();
    rect.mockReturnValue({top: 120, bottom: 170, left: 30, width: 300} as DOMRect);
    root().dispatchEvent(new Event('scroll')); fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel().style.top).toBe('176px');
  });
});
