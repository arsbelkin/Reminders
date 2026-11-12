import { Component, DestroyRef, computed, effect, forwardRef, inject, input, signal, untracked } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CategoriesService } from '../../api/services';
import { UserInfoDto } from '../../api/models/user-info-dto';
import { UserSearchService } from '../../shared/user-search.service';
import { switchMap, timer } from 'rxjs';

@Component({
  selector: 'app-members-editor',
  templateUrl: './members-editor.html',
  styleUrl: './members-editor.css',
  providers: [
    {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MembersEditor), multi: true},
    {provide: NG_VALIDATORS, useExisting: forwardRef(() => MembersEditor), multi: true},
  ],
})
export class MembersEditor implements ControlValueAccessor, Validator {
  private readonly api = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search = inject(UserSearchService);
  readonly inputId = input.required<string>();
  // null: any registered user; string: participants of this category only.
  readonly categoryId = input<string | null>(null);
  readonly protectedEmail = input<string | null>(null);
  readonly disabled = input(false);
  readonly emails = signal<string[]>([]);
  readonly draft = signal('');
  readonly searchState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private readonly results = signal<UserInfoDto[]>([]);
  readonly focused = signal(false);
  readonly activeIndex = signal(0);
  private readonly searchVersion = signal(0);
  readonly available = signal<string[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  private readonly controlDisabled = signal(false);
  private readonly reload = signal(0);
  readonly isDisabled = computed(() => this.disabled() || this.controlDisabled());
  readonly searchDisabled = computed(() => this.isDisabled() || this.categoryId() === '' || this.loading() || this.loadError());
  readonly suggestions = computed(() => this.results()
    .filter(user => user.id && user.email && !this.emails().includes(user.email)
      && (this.categoryId() === null || this.available().includes(user.email)))
    .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))
    .slice(0, 10));
  readonly expanded = computed(() => this.focused() && !!this.draft().trim() && !this.searchDisabled());
  readonly outsideCategory = computed(() => this.categoryId() && !this.loading() && !this.loadError()
    ? this.emails().filter(email => !this.available().includes(email)) : []);
  private onChange: (emails: string[]) => void = () => {};
  private onTouched: () => void = () => {};
  private validatorChanged: () => void = () => {};

  constructor() {
    effect(onCleanup => {
      const text = this.draft().trim();
      const disabled = this.searchDisabled();
      const focused = this.focused();
      this.searchVersion();
      this.results.set([]);
      this.activeIndex.set(0);
      if (!text || disabled || !focused) { this.searchState.set('idle'); return; }
      this.searchState.set('loading');
      const request = timer(300).pipe(
        switchMap(() => this.search.find('email', text)), takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: users => { this.results.set(users); this.searchState.set('ready'); },
        error: () => this.searchState.set('error'),
      });
      onCleanup(() => request.unsubscribe());
    });
    effect(onCleanup => {
      const categoryId = this.categoryId();
      this.reload();
      this.available.set([]);
      this.loading.set(!!categoryId);
      this.loadError.set(false);
      this.notifyValidation();
      if (!categoryId) return;
      const request = this.api.apiV1CategoriesCategoryIdGet$Json({categoryId})
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: category => {
            this.available.set([...new Set(category.usersEmails ?? [])]);
            this.loading.set(false);
            this.notifyValidation();
          },
          error: () => { this.loading.set(false); this.loadError.set(true); this.notifyValidation(); },
        });
      onCleanup(() => request.unsubscribe());
    });
  }

  writeValue(value: string[] | null): void {
    this.emails.set([...new Set(value ?? [])]);
    this.draft.set('');
    this.results.set([]);
  }
  registerOnChange(fn: (emails: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.controlDisabled.set(disabled); }
  registerOnValidatorChange(fn: () => void): void { this.validatorChanged = fn; }
  validate(_control: AbstractControl): ValidationErrors | null {
    if (this.draft().trim()) return {memberDraft: true};
    if (this.emails().some(email => !this.validEmail(email))) return {invalidMemberEmail: true};
    if (this.categoryId() !== null && (this.loading() || this.loadError() || this.outsideCategory().length))
      return {categoryMembers: true};
    return null;
  }

  setDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.focused.set(true);
    this.notifyValidation();
  }
  choose(user: UserInfoDto): void {
    const email = user.email;
    if (this.searchDisabled() || !email || !this.suggestions().some(item => item.id === user.id) || !this.validEmail(email)) return;
    this.draft.set('');
    this.update([...this.emails(), email]);
  }
  clearSearch(): void { this.draft.set(''); this.notifyValidation(); }
  onKeydown(event: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { this.focused.set(false); return; }
    this.focused.set(true);
    const length = this.suggestions().length;
    if (event.key === 'Enter') {
      const user = this.suggestions()[this.activeIndex()];
      if (user && this.searchState() === 'ready') this.choose(user);
    } else if (length) this.activeIndex.update(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + length) % length);
  }
  onFocusOut(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) this.focused.set(false);
    this.onTouched();
  }
  remove(email: string): void {
    if (this.isDisabled() || email === this.protectedEmail()) return;
    this.update(this.emails().filter(item => item !== email));
  }
  retrySearch(): void { this.searchVersion.update(value => value + 1); }
  retry(): void { if (!this.isDisabled()) this.reload.update(value => value + 1); }
  private update(emails: string[]): void {
    this.emails.set(emails);
    this.onChange([...emails]);
    this.onTouched();
    this.notifyValidation();
  }
  private validEmail(email: string): boolean { return !!email && Validators.email(new FormControl(email)) === null; }
  private notifyValidation(): void { untracked(() => this.validatorChanged()); }
}
