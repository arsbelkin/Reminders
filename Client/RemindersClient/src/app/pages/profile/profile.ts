import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AsyncValidatorFn, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, catchError, combineLatest, finalize, map, of, startWith, switchMap, timer } from 'rxjs';
import { UsersService } from '../../api/services';
import { UserInfoDto } from '../../api/models/user-info-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { UserAvatarService } from '../../auth/user-avatar.service';
import { ProfileApiService, ProfileField, ProfileUpdate } from '../../auth/profile-api.service';
import { AvatarEditor } from '../../components/avatar-editor/avatar-editor';

type ProfileState = {kind: 'loading' | 'error' | 'signedOut'} | {kind: 'ready'; user: UserInfoDto};

@Component({
  selector: 'app-profile',
  imports: [RouterLink, ReactiveFormsModule, AvatarEditor],
  templateUrl: './profile.html',
  styleUrls: ['../../shared/details-page.css', './profile.css'],
})
export class Profile {
  private readonly api = inject(UsersService);
  private readonly avatars = inject(UserAvatarService);
  private readonly session = inject(TokenStorageService);
  private readonly profileApi = inject(ProfileApiService);
  private readonly destroyRef = inject(DestroyRef);
  private saveRequest?: Subscription;
  private readonly reloadVersion = signal(0);
  readonly editing = signal<{token: string; original: ProfileUpdate} | null>(null);
  readonly busy = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal(false);
  readonly fields = ['username', 'email'] as const;
  readonly form = new FormGroup({
    username: new FormControl('', {nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
      asyncValidators: [this.availabilityValidator('username')]}),
    email: new FormControl('', {nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
      asyncValidators: [this.availabilityValidator('email')]}),
  });
  readonly formStatus = toSignal(this.form.statusChanges, {initialValue: this.form.status});
  private readonly formValues = toSignal(this.form.valueChanges);
  readonly changed = computed(() => {
    this.formValues();
    const original = this.editing()?.original;
    const values = this.form.getRawValue();
    return !!original && (values.username.trim() !== original.username || values.email.trim() !== original.email);
  });
  readonly avatarUrl = signal<string | null>(null);
  readonly hasAvatar = signal(false);
  readonly avatarPreviewUrl = signal<string | null>(null);
  readonly avatarEditorControl = viewChild(AvatarEditor);
  readonly state = toSignal(combineLatest([
    toObservable(this.session.token), toObservable(this.reloadVersion),
  ]).pipe(switchMap(([token]) => !token ? of<ProfileState>({kind: 'signedOut'})
    : !this.session.userId() ? of<ProfileState>({kind: 'error'})
    : this.api.apiV1UsersIdGet$Json({id: this.session.userId()!}).pipe(
      map(user => ({kind: 'ready', user}) as ProfileState),
      catchError(() => of<ProfileState>({kind: 'error'})),
      startWith<ProfileState>({kind: 'loading'}),
    ),
  )), {initialValue: {kind: 'loading'} as ProfileState});

  constructor() {
    effect(() => {
      const target = this.editing();
      if (target && target.token !== this.session.token()) {
        this.saveRequest?.unsubscribe();
        this.editing.set(null);
        this.form.reset();
        this.saveError.set(null);
        this.saved.set(false);
      }
    });
    effect(onCleanup => {
      const token = this.session.token();
      this.reloadVersion();
      this.avatars.revision();
      this.avatarUrl.set(null);
      this.hasAvatar.set(false);
      if (!token) return;
      let objectUrl: string | null = null;
      const request = this.avatars.getAvatar().subscribe({
        next: blob => { objectUrl = URL.createObjectURL(blob); this.avatarUrl.set(objectUrl); this.hasAvatar.set(true); },
        error: () => this.avatarUrl.set(null),
      });
      onCleanup(() => {
        request.unsubscribe();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    });
  }

  reload(): void {
    if (this.state().kind !== 'loading' && !this.editing() && !this.avatarEditorControl()?.busy()) this.reloadVersion.update(value => value + 1);
  }

  openEditor(): void {
    const current = this.state();
    const token = this.session.token();
    if (current.kind !== 'ready' || !token || this.busy() || this.avatarEditorControl()?.busy()) return;
    const original = {username: current.user.username?.trim() ?? '', email: current.user.email?.trim() ?? ''};
    this.editing.set({token, original});
    this.form.reset(original);
    this.saveError.set(null);
    this.saved.set(false);
  }

  cancelEdit(): void {
    if (this.busy()) return;
    this.editing.set(null);
    this.form.reset();
    this.saveError.set(null);
  }

  retryChecks(): void {
    for (const control of Object.values(this.form.controls)) control.updateValueAndValidity();
  }

  submit(): void {
    const target = this.editing();
    this.form.markAllAsTouched();
    if (!target || target.token !== this.session.token() || this.busy() || this.avatarEditorControl()?.busy() || !this.form.valid || !this.changed()) return;
    const values = this.form.getRawValue();
    this.busy.set(true);
    this.saveError.set(null);
    this.saveRequest = this.profileApi.updateProfile({username: values.username.trim(), email: values.email.trim()}).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => {
        if (target.token !== this.session.token()) return;
        this.editing.set(null);
        this.form.reset();
        this.saved.set(true);
        this.reload();
      },
      error: (error: {status?: number; error?: {field?: string}}) => {
        if (target.token !== this.session.token()) return;
        const field = error.error?.field;
        if (error.status === 409 && (field === 'username' || field === 'email')) {
          this.form.controls[field].setErrors({taken: true});
          this.saveError.set('Данные уже заняты. Укажите другое значение.');
        } else this.saveError.set(error.status === 409 ? 'Логин или email уже заняты. Измените данные и повторите проверку.'
          : 'Не удалось сохранить профиль. Попробуйте ещё раз.');
      },
    });
  }

  private availabilityValidator(field: ProfileField): AsyncValidatorFn {
    return control => {
      const target = this.editing();
      const value = (control.value as string).trim();
      if (!target || !value || value === target.original[field]) return of(null);
      return timer(350).pipe(
        switchMap(() => this.profileApi.checkAvailability(field, value)),
        map(result => result[field === 'username' ? 'usernameAvailable' : 'emailAvailable'] === true ? null : {taken: true}),
        catchError(() => of({checkFailed: true})),
        takeUntilDestroyed(this.destroyRef),
      );
    };
  }
}
