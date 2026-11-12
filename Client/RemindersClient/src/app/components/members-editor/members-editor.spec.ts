import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { CategoriesService } from '../../api/services';
import { CategoryInfoViewDto } from '../../api/models/category-info-view-dto';
import { UserInfoDto } from '../../api/models/user-info-dto';
import { UserSearchService } from '../../shared/user-search.service';
import { MembersEditor } from './members-editor';

@Component({imports: [ReactiveFormsModule, MembersEditor], template: `
  <form [formGroup]="form" (ngSubmit)="submits = submits + 1">
    <app-members-editor formControlName="members" inputId="members" [categoryId]="categoryId()" [protectedEmail]="protectedEmail()" [disabled]="disabled()" />
    <button type="submit">Сохранить</button>
  </form>`})
class Host {
  readonly categoryId = signal<string | null>(null);
  readonly protectedEmail = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly form = new FormGroup({members: new FormControl<string[]>([], {nonNullable: true})});
  submits = 0;
}

describe('MembersEditor', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const api = {apiV1CategoriesCategoryIdGet$Json: vi.fn()};
  const search = {find: vi.fn()};
  const anna = {id: 'anna', username: 'Anna', email: 'anna@example.test'};
  const ivan = {id: 'ivan', username: 'Ivan', email: 'ivan@example.test'};
  const root = () => fixture.nativeElement as HTMLElement;
  const input = () => root().querySelector<HTMLInputElement>('[role="combobox"]')!;
  const draft = (value: string) => { input().value = value; input().dispatchEvent(new Event('input')); fixture.detectChanges(); };
  const settle = async () => { await new Promise(resolve => setTimeout(resolve, 350)); fixture.detectChanges(); };
  const choose = () => { root().querySelector<HTMLButtonElement>('.user-option')!.click(); fixture.detectChanges(); };
  const values = () => host.form.controls.members.value;
  beforeEach(async () => {
    api.apiV1CategoriesCategoryIdGet$Json.mockReset().mockReturnValue(of({usersEmails: [anna.email, ivan.email]}));
    search.find.mockReset().mockImplementation((_field, text) => of([anna, ivan].filter(user => user.email.includes(text))));
    TestBed.configureTestingModule({providers: [
      {provide: CategoriesService, useValue: api}, {provide: UserSearchService, useValue: search},
    ]});
    fixture = TestBed.createComponent(Host); host = fixture.componentInstance; await fixture.whenStable();
  });

  it('does not fetch all users for an empty input and searches email after a debounce', async () => {
    expect(search.find).not.toHaveBeenCalled(); draft('an'); draft(' anna ');
    expect(search.find).not.toHaveBeenCalled(); await settle();
    expect(search.find).toHaveBeenCalledExactlyOnceWith('email', 'anna');
    expect(root().querySelector('.user-option')?.textContent).toContain(anna.username);
    expect(root().querySelector('.user-option')?.textContent).toContain(anna.email);
  });

  it('selects a returned user on Enter without submitting the outer form', async () => {
    draft('anna'); await settle();
    const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
    input().dispatchEvent(event); fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true); expect(host.submits).toBe(0);
    expect(values()).toEqual([anna.email]); expect(input().value).toBe('');
    expect(host.form.valid).toBe(true); expect(host.form.controls.members.touched).toBe(true);
  });

  it('does not accept arbitrary text or duplicate selections', async () => {
    draft('unregistered@example.test'); await settle();
    input().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    expect(values()).toEqual([]); expect(host.form.invalid).toBe(true);
    draft('anna'); await settle(); choose(); draft('anna'); await settle();
    expect(root().querySelector('.user-option')).toBeNull(); expect(values()).toEqual([anna.email]);
  });

  it('blocks an unfinished search and supports clearing it and removing participants', async () => {
    draft('anna'); expect(host.form.invalid).toBe(true); await settle(); choose();
    root().querySelector<HTMLButtonElement>('.remove-member')!.click(); fixture.detectChanges();
    expect(values()).toEqual([]); expect(host.form.valid).toBe(true);
    draft('draft'); root().querySelector<HTMLButtonElement>('.clear-search')!.click(); fixture.detectChanges();
    expect(host.form.valid).toBe(true);
  });

  it('protects the author and disables searching while saving', () => {
    host.form.controls.members.setValue([anna.email, ivan.email]);
    host.protectedEmail.set(anna.email); host.disabled.set(true); fixture.detectChanges();
    expect(root().querySelectorAll('.remove-member').length).toBe(1);
    expect(root().querySelector<HTMLButtonElement>('.remove-member')!.disabled).toBe(true);
    expect(input().disabled).toBe(true); expect(root().textContent).toContain('Автор');
  });

  it('filters reminder suggestions to category participants', async () => {
    host.categoryId.set('work'); fixture.detectChanges(); await fixture.whenStable();
    search.find.mockReturnValue(of([anna, {id: 'out', username: 'Other', email: 'outsider@example.test'}]));
    draft('example'); await settle();
    expect(root().querySelectorAll('.user-option').length).toBe(1); choose();
    expect(values()).toEqual([anna.email]);
    expect(api.apiV1CategoriesCategoryIdGet$Json).toHaveBeenCalledExactlyOnceWith({categoryId: 'work'});
  });

  it('keeps incompatible members visible and blocks saving until removed', async () => {
    host.form.controls.members.setValue(['outsider@example.test']); host.categoryId.set('work');
    fixture.detectChanges(); await fixture.whenStable();
    expect(root().querySelector('.unavailable')).not.toBeNull(); expect(host.form.invalid).toBe(true);
    root().querySelector<HTMLButtonElement>('.remove-member')!.click(); fixture.detectChanges();
    expect(host.form.valid).toBe(true);
  });

  it('blocks saving during category loading and on errors, then allows retry', async () => {
    const response = new Subject<CategoryInfoViewDto>(); api.apiV1CategoriesCategoryIdGet$Json.mockReturnValue(response);
    host.categoryId.set('work'); fixture.detectChanges(); expect(host.form.invalid).toBe(true); expect(input().disabled).toBe(true);
    response.error({status: 500}); fixture.detectChanges(); expect(host.form.invalid).toBe(true);
    api.apiV1CategoriesCategoryIdGet$Json.mockReturnValue(of({usersEmails: []}));
    root().querySelector<HTMLButtonElement>('.retry-members')!.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(host.form.valid).toBe(true);
  });

  it('cancels obsolete search responses when typing and allows retrying search errors', async () => {
    const old = new Subject<UserInfoDto[]>(); search.find.mockReturnValueOnce(old);
    draft('old'); await settle(); expect(old.observed).toBe(true);
    search.find.mockReturnValueOnce(throwError(() => ({status: 500})));
    draft('anna'); expect(old.observed).toBe(false); await settle();
    expect(root().textContent).toContain('Не удалось найти пользователей');
    root().querySelector<HTMLButtonElement>('.retry-members')!.click(); fixture.detectChanges(); await settle();
    expect(root().querySelector('.user-option')?.textContent).toContain(anna.email);
  });

  it('supports keyboard selection and Escape without dismissing the parent dialog', async () => {
    draft('example'); await settle();
    input().dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
    input().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    fixture.detectChanges(); expect(values()).toEqual([ivan.email]);
    draft('anna'); await settle();
    const escape = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    input().dispatchEvent(escape); fixture.detectChanges();
    expect(escape.defaultPrevented).toBe(true); expect(root().querySelector('.search-results')).toBeNull();
  });

  it('cancels obsolete category requests and preserves selected members', async () => {
    const old = new Subject<CategoryInfoViewDto>(); api.apiV1CategoriesCategoryIdGet$Json.mockReturnValueOnce(old);
    host.categoryId.set('work'); fixture.detectChanges(); expect(old.observed).toBe(true);
    host.form.controls.members.setValue(['outside@example.test']); host.categoryId.set('home');
    fixture.detectChanges(); await fixture.whenStable(); expect(old.observed).toBe(false);
    expect(values()).toEqual(['outside@example.test']); expect(host.form.invalid).toBe(true);
  });

  it('clears the draft on reset and cancels pending searches on destruction', async () => {
    draft('draft'); host.form.reset(); fixture.detectChanges(); expect(input().value).toBe('');
    const response = new Subject<UserInfoDto[]>(); search.find.mockReturnValue(response);
    draft('anna'); await settle(); fixture.destroy(); expect(response.observed).toBe(false);
  });
});
