import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserLoginDto } from '../../api/models/user-login-dto';

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
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  togglePassword(): void {
    this.passwordVisible.update(visible => !visible);
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }

  showError(message: string): void {
    this.errorMessage.set(message);
  }

  submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      const loginInvalid = this.form.controls.inputString.invalid;
      const passwordInvalid = this.form.controls.password.invalid;

      this.showError(loginInvalid && passwordInvalid
        ? 'Заполните логин или email и пароль.'
        : loginInvalid ? 'Укажите логин или email.' : 'Введите пароль.');

      (loginInvalid ? this.loginInput() : this.passwordInput()).nativeElement.focus();
      return;
    }

    this.dismissError();
    const values = this.form.getRawValue();

    this.loginRequested.emit({
      inputString: values.inputString.trim(),
      password: values.password,
    });
  }
}
