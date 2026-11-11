import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { CategoriesService, RemindersService } from '../../api/services';
import { CategoryListViewDto } from '../../api/models/category-list-view-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { ReminderEdit } from './reminder-edit';

describe('ReminderEdit', () => {
  let fixture: ComponentFixture<ReminderEdit>;
  let component: ReminderEdit;
  let response: Subject<void>;
  let userId = signal<string | null>('owner');
  const api = {apiV1RemindersReminderIdPatch: vi.fn()};
  const categories = {apiV1CategoriesGet$Json: vi.fn()};
  const data = {id: 'first', creatorId: 'owner', title: 'Отчёт', description: 'Детали', categoryId: 'work', categoryName: 'Работа', priority: 3, dueDate: '2026-11-18T10:15:24.123Z', memberEmails: ['owner@example.test', 'member@example.test'], isCompleted: 0};
  const root = () => fixture.nativeElement as HTMLElement;
  const dialog = () => root().querySelector<HTMLDialogElement>('dialog')!;

  beforeEach(async () => {
    userId = signal('owner'); response = new Subject<void>();
    api.apiV1RemindersReminderIdPatch.mockReset().mockReturnValue(response.asObservable());
    categories.apiV1CategoriesGet$Json.mockReset().mockReturnValue(of([{id: 'work', title: 'Работа'}, {id: 'home', title: 'Дом'}]));
    TestBed.configureTestingModule({providers: [
      {provide: RemindersService, useValue: api}, {provide: CategoriesService, useValue: categories},
      {provide: TokenStorageService, useValue: {userId}},
    ]});
    fixture = TestBed.createComponent(ReminderEdit); component = fixture.componentInstance;
    fixture.componentRef.setInput('reminder', data); fixture.componentRef.setInput('reminderId', 'first');
    await fixture.whenStable();
    dialog().showModal = vi.fn(() => dialog().setAttribute('open', ''));
    dialog().close = vi.fn(() => dialog().removeAttribute('open'));
  });

  it('prefills local date and preserves unchanged timestamp precision and members on save', () => {
    component.open(); fixture.detectChanges();
    const values = component.form.getRawValue();
    const original = new Date(data.dueDate);
    const local = new Date(values.dueDate);
    expect(local.getHours()).toBe(original.getHours());
    expect(local.getDate()).toBe(original.getDate());
    expect(values).toMatchObject({title: data.title, description: data.description, categoryId: 'work', priority: 3});
    component.form.controls.title.setValue('  Новый отчёт  ');
    component.save(); component.save();
    expect(api.apiV1RemindersReminderIdPatch).toHaveBeenCalledExactlyOnceWith({reminderId: 'first', body: {
      title: 'Новый отчёт', description: data.description, categoryId: 'work', priority: 3,
      dueDate: data.dueDate, usersEmails: data.memberEmails,
    }});
    const saved = vi.fn(); component.saved.subscribe(saved);
    response.next(); response.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith('first');
    expect(dialog().open).toBe(false);
  });

  it('can change category and priority and clear optional fields', () => {
    component.open();
    component.form.patchValue({categoryId: 'home', priority: 1, description: '  ', dueDate: ''});
    component.save();
    expect(api.apiV1RemindersReminderIdPatch).toHaveBeenCalledWith({reminderId: 'first', body: {
      title: data.title, description: null, categoryId: 'home', priority: 1, dueDate: null, usersEmails: data.memberEmails,
    }});
  });

  it('converts an edited local date to UTC', () => {
    component.open();
    component.form.controls.dueDate.setValue('2026-12-01T18:30');
    component.save();
    expect(api.apiV1RemindersReminderIdPatch.mock.calls[0][0].body.dueDate).toBe(new Date('2026-12-01T18:30').toISOString());
  });

  it.each([
    ['title', '   '], ['categoryId', ''], ['categoryId', 'unknown'], ['priority', 99], ['dueDate', 'invalid'],
  ] as const)('validates invalid %s before sending', (field, value) => {
    component.open();
    component.form.patchValue({[field]: value}); component.save();
    expect(component.form.invalid).toBe(true);
    expect(api.apiV1RemindersReminderIdPatch).not.toHaveBeenCalled();
  });

  it('cancels without a request and restores original values on reopen', () => {
    component.open(); component.form.controls.title.setValue('Черновик'); component.close();
    expect(api.apiV1RemindersReminderIdPatch).not.toHaveBeenCalled();
    component.open(); expect(component.form.controls.title.value).toBe(data.title);
  });

  it('blocks closing and Escape while saving', () => {
    component.open(); component.save(); component.close();
    const event = new Event('cancel', {cancelable: true}); component.onCancel(event);
    expect(event.defaultPrevented).toBe(true); expect(dialog().open).toBe(true);
    response.next(); response.complete();
    expect(dialog().open).toBe(false);
  });

  it.each([0, 400, 403, 404, 500])('preserves the draft and enables retry after error %s', status => {
    component.open(); component.form.controls.title.setValue('Черновик'); component.save(); response.error({status});
    fixture.detectChanges();
    expect(component.errorMessage()).toBeTruthy(); expect(component.isSaving()).toBe(false);
    expect(component.form.controls.title.value).toBe('Черновик'); expect(dialog().open).toBe(true);
    api.apiV1RemindersReminderIdPatch.mockReturnValue(of(undefined)); component.save();
    expect(dialog().open).toBe(false);
  });

  it('blocks saving while categories load, retries a load error and keeps the original category available', () => {
    const loading = new Subject<CategoryListViewDto[]>();
    categories.apiV1CategoriesGet$Json.mockReturnValue(loading);
    component.open(); component.save();
    expect(api.apiV1RemindersReminderIdPatch).not.toHaveBeenCalled();
    loading.error({status: 500}); component.save();
    expect(component.categoriesError()).toBe(true);
    categories.apiV1CategoriesGet$Json.mockReturnValue(of([])); component.loadCategories();
    expect(component.categories()).toEqual([{id: 'work', title: 'Работа'}]);
    component.save(); expect(api.apiV1RemindersReminderIdPatch).toHaveBeenCalledTimes(1);
  });

  it.each([null, 'another'])('blocks another user %s', value => {
    userId.set(value); fixture.detectChanges(); component.open(); component.save();
    expect(dialog().open).toBe(false); expect(api.apiV1RemindersReminderIdPatch).not.toHaveBeenCalled();
  });

  it('invalidates a dialog after navigating to another reminder', () => {
    component.open();
    fixture.componentRef.setInput('reminderId', 'second'); fixture.componentRef.setInput('reminder', {...data, id: 'second'});
    fixture.detectChanges(); TestBed.tick(); component.save();
    expect(dialog().open).toBe(false); expect(api.apiV1RemindersReminderIdPatch).not.toHaveBeenCalled();
  });

  it('emits only the original reminder ID for a late save', () => {
    component.open(); component.save();
    const saved = vi.fn(); component.saved.subscribe(saved);
    fixture.componentRef.setInput('reminderId', 'second'); fixture.componentRef.setInput('reminder', {...data, id: 'second'});
    fixture.detectChanges(); TestBed.tick(); response.next(); response.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith('first');
  });
});
