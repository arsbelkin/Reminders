import { Component, ElementRef, output, signal, viewChild, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { UserLoginDto } from '../../api/models/user-login-dto';
import { AuthService } from '../../api/services';
import { TokenStorageService } from '../../auth/token-storage.service';
import { Router } from '@angular/router';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  readonly loginRequested = output<UserLoginDto>();
  readonly passwordVisible = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  private readonly authApi = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    inputString: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  private readonly loginInput = viewChild.required<ElementRef<HTMLInputElement>>('loginInput');
  private readonly passwordInput =
    viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }

  showError(message: string): void {
    this.errorMessage.set(message);
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      const loginInvalid = this.form.controls.inputString.invalid;
      const passwordInvalid = this.form.controls.password.invalid;

      this.showError(
        loginInvalid && passwordInvalid
          ? 'Заполните логин или email и пароль.'
          : loginInvalid
            ? 'Укажите логин или email.'
            : 'Введите пароль.',
      );

      (loginInvalid ? this.loginInput() : this.passwordInput()).nativeElement.focus();
      return;
    }

    this.dismissError();
    const values = this.form.getRawValue();
    this.isSubmitting.set(true);

    this.authApi
      .apiV1AuthLoginPost$Json({
        body: {
          inputString: values.inputString.trim(),
          password: values.password,
        },
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.token) {
            this.showError('Не удалось выполнить вход. Попробуйте ещё раз.');
            return;
          }

          this.tokenStorage.saveToken(response.token);

          this.router.navigate(['/reminders']);
        },

        error: (error) => {
          this.showError(
            error.status === 401
              ? 'Неверный логин или пароль.'
              : 'Не удалось выполнить вход. Попробуйте ещё раз.',
          );
        },
      });
  }
}
