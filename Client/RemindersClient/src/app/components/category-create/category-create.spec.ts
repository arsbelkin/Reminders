import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryCreate } from './category-create';
import { CategoriesService } from '../../api/services';
import { Subject } from 'rxjs';
import { UserSearchService } from '../../shared/user-search.service';

describe('CategoryCreate', () => {
  let component: CategoryCreate;
  let fixture: ComponentFixture<CategoryCreate>;
  let response: Subject<{id: string}>;
  const api = {apiV1CategoriesPost$Json: vi.fn()};

  beforeEach(async () => {
    response = new Subject(); api.apiV1CategoriesPost$Json.mockReset().mockReturnValue(response);
    await TestBed.configureTestingModule({
      imports: [CategoryCreate],
      providers: [{ provide: CategoriesService, useValue: api }, {provide: UserSearchService, useValue: {find: vi.fn()}}],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a category with participants and prevents duplicate requests', () => {
    component.open(); component.form.patchValue({title: ' Работа ', usersEmails: ['anna@example.test', 'ivan@example.test']});
    component.save(); component.save();
    expect(api.apiV1CategoriesPost$Json).toHaveBeenCalledExactlyOnceWith({body: {
      title: 'Работа', description: null, usersEmails: ['anna@example.test', 'ivan@example.test'],
    }});
    const created = vi.fn(); component.created.subscribe(created);
    response.next({id: 'new'}); response.complete(); expect(created).toHaveBeenCalledTimes(1);
  });

  it('keeps participants after an unknown email error and clears them on a new opening', () => {
    component.open(); component.form.patchValue({title: 'Работа', usersEmails: ['unknown@example.test']});
    component.save(); response.error({status: 422});
    expect(component.errorMessage()).toContain('зарегистрированы');
    expect(component.form.controls.usersEmails.value).toEqual(['unknown@example.test']);
    component.close(); component.open(); expect(component.form.controls.usersEmails.value).toEqual([]);
  });

  it.each([false, true])('prevents native Escape dismissal only while saving (saving=%s)', (saving) => {
    component.isSaving.set(saving);
    fixture.detectChanges();
    const cancel = new Event('cancel', { cancelable: true });
    fixture.nativeElement.querySelector('dialog').dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(saving);
  });
});
