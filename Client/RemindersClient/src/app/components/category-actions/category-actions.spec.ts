import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CategoriesService } from '../../api/services';
import { TokenStorageService } from '../../auth/token-storage.service';
import { CategoryActions } from './category-actions';
import { UserSearchService } from '../../shared/user-search.service';

describe('CategoryActions', () => {
  let fixture: ComponentFixture<CategoryActions>;
  let component: CategoryActions;
  let request: Subject<void>;
  let userId = signal<string | null>('owner');
  const api = {apiV1CategoriesCategoryIdPatch: vi.fn(), apiV1CategoriesCategoryIdDelete: vi.fn()};
  const category = {id: 'work', creatorId: 'owner', title: 'Работа', description: 'Общие задачи', usersEmails: ['owner@example.test', 'member@example.test']};
  const root = () => fixture.nativeElement as HTMLElement;
  const dialog = () => root().querySelector<HTMLDialogElement>('dialog')!;

  beforeEach(async () => {
    userId = signal('owner');
    request = new Subject<void>();
    api.apiV1CategoriesCategoryIdPatch.mockReset().mockReturnValue(request.asObservable());
    api.apiV1CategoriesCategoryIdDelete.mockReset().mockReturnValue(request.asObservable());
    TestBed.configureTestingModule({providers: [
      {provide: CategoriesService, useValue: api},
      {provide: UserSearchService, useValue: {find: vi.fn()}},
      {provide: TokenStorageService, useValue: {userId}},
    ]});
    fixture = TestBed.createComponent(CategoryActions);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('categoryId', 'work');
    fixture.componentRef.setInput('category', category);
    await fixture.whenStable();
    dialog().showModal = vi.fn(() => dialog().setAttribute('open', ''));
    dialog().close = vi.fn(() => dialog().removeAttribute('open'));
  });

  it('prefills editing, validates whitespace and preserves members in the request', () => {
    root().querySelector<HTMLButtonElement>('.edit-category')!.click();
    expect(component.form.getRawValue()).toEqual({title: category.title, description: category.description, usersEmails: category.usersEmails});
    component.form.controls.title.setValue('   ');
    component.submit();
    fixture.detectChanges();
    expect(root().querySelector('.field-error')).not.toBeNull();
    expect(api.apiV1CategoriesCategoryIdPatch).not.toHaveBeenCalled();
    component.form.patchValue({title: '  Планы  ', description: '  Новое описание  '});
    component.submit();
    component.submit();
    expect(api.apiV1CategoriesCategoryIdPatch).toHaveBeenCalledExactlyOnceWith({categoryId: 'work', body: {
      title: 'Планы', description: 'Новое описание', usersEmails: category.usersEmails,
    }});
    expect(api.apiV1CategoriesCategoryIdDelete).not.toHaveBeenCalled();
    const saved = vi.fn();
    component.saved.subscribe(saved);
    request.next(); request.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith('work');
    expect(dialog().open).toBe(false);
  });

  it('allows clearing the description and cancelling without saving', () => {
    component.open('edit');
    component.form.controls.title.setValue('Изменено');
    component.close();
    expect(api.apiV1CategoriesCategoryIdPatch).not.toHaveBeenCalled();
    component.open('edit');
    expect(component.form.controls.title.value).toBe(category.title);
    component.form.controls.description.setValue('  ');
    component.submit();
    expect(api.apiV1CategoriesCategoryIdPatch).toHaveBeenCalledWith({categoryId: 'work', body: {
      title: category.title, description: null, usersEmails: category.usersEmails,
    }});
  });

  it('sends edited participants and restores the original list when cancelling', () => {
    component.open('edit');
    component.form.controls.usersEmails.setValue(['owner@example.test', 'new@example.test']);
    component.close(); component.open('edit');
    expect(component.form.controls.usersEmails.value).toEqual(category.usersEmails);
    component.form.controls.usersEmails.setValue(['owner@example.test', 'new@example.test']);
    component.submit();
    expect(api.apiV1CategoriesCategoryIdPatch.mock.calls[0][0].body.usersEmails).toEqual(['owner@example.test', 'new@example.test']);
    expect(category.usersEmails).toEqual(['owner@example.test', 'member@example.test']);
  });

  it('confirms cascading deletion, blocks duplicates and closing while pending', () => {
    const deleted = vi.fn();
    component.deleted.subscribe(deleted);
    root().querySelector<HTMLButtonElement>('.delete-category')!.click();
    fixture.detectChanges();
    expect(root().querySelector('.record-name')?.textContent).toBe(category.title);
    expect(root().querySelector('.delete-warning')?.textContent).toContain('все напоминания');
    expect(api.apiV1CategoriesCategoryIdDelete).not.toHaveBeenCalled();
    component.close();
    expect(dialog().open).toBe(false);
    component.open('delete');
    component.submit(); component.submit(); component.close();
    const cancel = new Event('cancel', {cancelable: true});
    component.onCancel(cancel);
    fixture.detectChanges();
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);
    expect(root().querySelector<HTMLButtonElement>('.submit-button')!.disabled).toBe(true);
    expect(api.apiV1CategoriesCategoryIdDelete).toHaveBeenCalledExactlyOnceWith({categoryId: 'work'});
    request.next(); request.complete();
    expect(deleted).toHaveBeenCalledExactlyOnceWith('work');
    expect(dialog().open).toBe(false);
  });

  it.each(['edit', 'delete'] as const)('keeps the %s dialog and draft after an error and permits retry', mode => {
    component.open(mode);
    component.form.controls.title.setValue('Черновик');
    component.submit();
    request.error({status: 500});
    fixture.detectChanges();
    expect(dialog().open).toBe(true);
    expect(root().querySelector('.action-error')?.textContent).toContain('Попробуйте ещё раз');
    expect(component.form.controls.title.value).toBe('Черновик');
    expect(component.busy()).toBe(false);
    const retry = new Subject<void>();
    api.apiV1CategoriesCategoryIdPatch.mockReturnValue(retry.asObservable());
    api.apiV1CategoriesCategoryIdDelete.mockReturnValue(retry.asObservable());
    component.submit();
    expect(component.busy()).toBe(true);
  });

  it.each([null, 'other'])('hides and blocks both operations for user %s', id => {
    userId.set(id);
    fixture.detectChanges();
    expect(root().querySelector('.category-actions')).toBeNull();
    component.open('edit'); component.open('delete'); component.submit();
    expect(api.apiV1CategoriesCategoryIdPatch).not.toHaveBeenCalled();
    expect(api.apiV1CategoriesCategoryIdDelete).not.toHaveBeenCalled();
  });

  it('closes an obsolete dialog on route change and never submits for the new category', () => {
    component.open('delete');
    fixture.componentRef.setInput('categoryId', 'home');
    fixture.componentRef.setInput('category', {...category, id: 'home'});
    fixture.detectChanges(); TestBed.tick();
    expect(dialog().open).toBe(false);
    component.submit();
    expect(api.apiV1CategoriesCategoryIdDelete).not.toHaveBeenCalled();
  });

  it('keeps an in-flight operation bound to its original category', () => {
    component.open('edit'); component.submit();
    const saved = vi.fn();
    component.saved.subscribe(saved);
    fixture.componentRef.setInput('categoryId', 'home');
    fixture.componentRef.setInput('category', {...category, id: 'home'});
    fixture.detectChanges(); TestBed.tick();
    request.next(); request.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith('work');
  });
});
