import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../api/services';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['../login/login.css', './register.css'],
})
export class Register {
  private readonly api = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly registerForm = viewChild<ElementRef<HTMLFormElement>>('registerForm');
  readonly isSubmitting = signal(false);
  readonly registered = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly passwordVisible = signal(false);
  readonly confirmationVisible = signal(false);
  readonly form = new FormGroup({
    username: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)]}),
    email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email, Validators.pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)]}),
    password: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)]}),
    passwordVerify: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
  }, {validators: (group: AbstractControl) => group.get('password')?.value === group.get('passwordVerify')?.value ? null : {passwordMismatch: true}});

  submit(): void {
    if (this.isSubmitting() || this.registered()) return;
    this.form.controls.username.setValue(this.form.controls.username.value.trim());
    this.form.controls.email.setValue(this.form.controls.email.value.trim());
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage.set(this.form.hasError('passwordMismatch') && this.form.controls.password.valid && this.form.controls.passwordVerify.valid
        ? 'Пароли не совпадают.' : 'Проверьте заполнение полей формы.');
      const field = (['username', 'email', 'password', 'passwordVerify'] as const).find(key => this.form.controls[key].invalid) ?? 'passwordVerify';
      this.registerForm()?.nativeElement.querySelector<HTMLInputElement>(`[formControlName="${field}"]`)?.focus();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.api.apiV1AuthRegisterPost$Json({body: this.form.getRawValue()}).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: () => {
        this.form.reset();
        this.passwordVisible.set(false);
        this.confirmationVisible.set(false);
        this.registered.set(true);
      },
      error: (error: {status?: number; error?: {title?: unknown}}) => {
        const title = typeof error.error?.title === 'string' ? error.error.title : '';
        this.errorMessage.set(error.status === 409
          ? /^Email:/i.test(title) ? 'Этот email уже зарегистрирован.'
            : /^Username:/i.test(title) ? 'Этот логин уже занят.' : 'Логин или email уже заняты.'
          : error.status === 422 ? 'Укажите корректный email.'
          : error.status === 401 ? 'Пароли не совпадают.'
          : error.status === 400 ? 'Проверьте данные регистрации.'
          : error.status === 0 ? 'Нет соединения с сервером. Попробуйте ещё раз.'
          : 'Не удалось зарегистрироваться. Попробуйте ещё раз.');
      },
    });
  }
}
