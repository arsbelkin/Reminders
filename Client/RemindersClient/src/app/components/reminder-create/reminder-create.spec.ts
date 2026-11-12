import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReminderCreate } from './reminder-create';
import { Subject, of } from 'rxjs';
import { CategoriesService, RemindersService } from '../../api/services';
import { UserSearchService } from '../../shared/user-search.service';

describe('ReminderCreate', () => {
  let component: ReminderCreate;
  let fixture: ComponentFixture<ReminderCreate>;
  let response: Subject<{id: string}>;
  const api = {apiV1RemindersPost$Json: vi.fn()};
  const categories = {apiV1CategoriesCategoryIdGet$Json: vi.fn()};

  beforeEach(async () => {
    response = new Subject(); api.apiV1RemindersPost$Json.mockReset().mockReturnValue(response);
    categories.apiV1CategoriesCategoryIdGet$Json.mockReset().mockReturnValue(of({usersEmails: ['anna@example.test', 'ivan@example.test']}));
    await TestBed.configureTestingModule({
      imports: [ReminderCreate],
      providers: [{provide: RemindersService, useValue: api}, {provide: CategoriesService, useValue: categories},
        {provide: UserSearchService, useValue: {find: () => of([{id: 'anna', username: 'anna', email: 'anna@example.test'}])}}],
    }).compileComponents();

    fixture = TestBed.createComponent(ReminderCreate);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('categories', [{id: 'work', title: 'Работа'}]);
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a reminder with participants selected from its category', async () => {
    component.open(); component.form.patchValue({title: ' Задача ', categoryId: 'work'});
    fixture.detectChanges(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('app-members-editor [role="combobox"]') as HTMLInputElement;
    input.value = 'anna'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 350)); fixture.detectChanges();
    fixture.nativeElement.querySelector('.user-option').click(); fixture.detectChanges(); component.save(); component.save();
    expect(api.apiV1RemindersPost$Json).toHaveBeenCalledExactlyOnceWith({body: {
      title: 'Задача', categoryId: 'work', description: null, priority: 0, dueDate: null, usersEmails: ['anna@example.test'],
    }});
  });

  it('blocks participants outside the category and resets them on reopening', async () => {
    component.open(); component.form.patchValue({title: 'Задача', categoryId: 'work', usersEmails: ['outsider@example.test']});
    fixture.detectChanges(); await fixture.whenStable(); component.save();
    expect(component.form.invalid).toBe(true); expect(api.apiV1RemindersPost$Json).not.toHaveBeenCalled();
    component.close(); component.open(); expect(component.form.controls.usersEmails.value).toEqual([]);
  });

  it('preserves the participants draft on a failed creation', async () => {
    component.open(); component.form.patchValue({title: 'Задача', categoryId: 'work', usersEmails: ['anna@example.test']});
    fixture.detectChanges(); await fixture.whenStable(); component.save(); response.error({status: 500});
    expect(component.form.controls.usersEmails.value).toEqual(['anna@example.test']);
    expect(component.isSaving()).toBe(false);
  });
});
