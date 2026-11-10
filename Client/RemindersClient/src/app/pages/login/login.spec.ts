import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles password visibility without changing or submitting it', () => {
    const onLogin = vi.fn();
    component.loginRequested.subscribe(onLogin);
    component.form.setValue({ inputString: 'user', password: 'My password' });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const password = root.querySelector<HTMLInputElement>('#password-input')!;

    expect(password.type).toBe('password');
    root.querySelector<HTMLButtonElement>('[aria-label="Показать пароль"]')!.click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(password.value).toBe('My password');
    expect(onLogin).not.toHaveBeenCalled();

    root.querySelector<HTMLButtonElement>('[aria-label="Скрыть пароль"]')!.click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
  });

  it('shows a dismissible error instead of submitting an empty form', () => {
    const onLogin = vi.fn();
    component.loginRequested.subscribe(onLogin);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector('form')!.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true,
    }));
    fixture.detectChanges();

    expect(onLogin).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent)
      .toContain('Заполните логин или email и пароль.');

    root.querySelector<HTMLButtonElement>('[aria-label="Закрыть уведомление"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('rejects a login that only contains whitespace', () => {
    const onLogin = vi.fn();
    component.loginRequested.subscribe(onLogin);
    component.form.setValue({ inputString: '   ', password: 'password' });

    component.submit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Укажите логин или email.');
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('emits valid login data while preserving the password exactly', () => {
    const onLogin = vi.fn();
    component.loginRequested.subscribe(onLogin);
    component.showError('Предыдущая ошибка входа');
    component.form.setValue({
      inputString: '  user@example.com  ',
      password: ' password with spaces ',
    });

    component.submit();

    expect(onLogin).toHaveBeenCalledExactlyOnceWith({
      inputString: 'user@example.com',
      password: ' password with spaces ',
    });
    expect(component.errorMessage()).toBeNull();
  });
});
