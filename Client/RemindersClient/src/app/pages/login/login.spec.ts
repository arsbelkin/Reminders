import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { LoginResponseDto } from '../../api/models/login-response-dto';
import { AuthService } from '../../api/services';
import { TokenStorageService } from '../../auth/token-storage.service';
import { Login } from './login';
import { Router, provideRouter } from '@angular/router';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let loginResponse: Subject<LoginResponseDto>;
  const authApi = { apiV1AuthLoginPost$Json: vi.fn() };
  const tokenStorage = { saveToken: vi.fn() };

  beforeEach(async () => {
    loginResponse = new Subject<LoginResponseDto>();
    authApi.apiV1AuthLoginPost$Json.mockReset();
    authApi.apiV1AuthLoginPost$Json.mockReturnValue(loginResponse.asObservable());
    tokenStorage.saveToken.mockReset();

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authApi },
        { provide: TokenStorageService, useValue: tokenStorage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the registration page', () => {
    expect(fixture.nativeElement.querySelector('.register-button')?.getAttribute('href')).toBe('/register');
    expect(fixture.nativeElement.textContent).not.toContain('Регистрация скоро появится');
  });

  it('cancels pending login when leaving for registration', () => {
    component.form.setValue({inputString: 'user', password: 'password'});
    component.submit(); expect(loginResponse.observed).toBe(true);
    fixture.destroy(); expect(loginResponse.observed).toBe(false);
    loginResponse.next({token: 'late-token'});
    expect(tokenStorage.saveToken).not.toHaveBeenCalled();
  });

  it('toggles password visibility without changing or submitting it', () => {
    component.form.setValue({ inputString: 'user', password: 'My password' });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const password = root.querySelector<HTMLInputElement>('#password-input')!;

    expect(password.type).toBe('password');
    root.querySelector<HTMLButtonElement>('[aria-label="Показать пароль"]')!.click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(password.value).toBe('My password');
    expect(authApi.apiV1AuthLoginPost$Json).not.toHaveBeenCalled();

    root.querySelector<HTMLButtonElement>('[aria-label="Скрыть пароль"]')!.click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
  });

  it('shows a dismissible error instead of submitting an empty form', () => {
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector('form')!.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true,
    }));
    fixture.detectChanges();

    expect(authApi.apiV1AuthLoginPost$Json).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
    expect(root.querySelector('[role="alert"]')?.textContent)
      .toContain('Заполните логин или email и пароль.');

    root.querySelector<HTMLButtonElement>('[aria-label="Закрыть уведомление"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('rejects a login that only contains whitespace', () => {
    component.form.setValue({ inputString: '   ', password: 'password' });

    component.submit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Укажите логин или email.');
    expect(authApi.apiV1AuthLoginPost$Json).not.toHaveBeenCalled();
  });

  it('blocks duplicate submissions until the request completes', () => {
    component.showError('Предыдущая ошибка входа');
    component.form.setValue({
      inputString: '  user@example.com  ',
      password: ' password with spaces ',
    });

    component.submit();

    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.login-button')!;

    expect(authApi.apiV1AuthLoginPost$Json).toHaveBeenCalledExactlyOnceWith({
      body: {
        inputString: 'user@example.com',
        password: ' password with spaces ',
      },
    });
    expect(component.errorMessage()).toBeNull();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Входим…');

    button.click();
    root.querySelector('form')!.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true,
    }));
    component.submit();
    expect(authApi.apiV1AuthLoginPost$Json).toHaveBeenCalledTimes(1);

    loginResponse.next({ token: 'test-token' });
    loginResponse.complete();
    fixture.detectChanges();

    expect(tokenStorage.saveToken).toHaveBeenCalledExactlyOnceWith('test-token');
    expect(component.isSubmitting()).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(button.textContent).toContain('Войти');
  });

  it('allows retrying after an unsuccessful request', () => {
    component.form.setValue({ inputString: 'user', password: 'password' });
    component.submit();

    loginResponse.error({ status: 401 });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(component.isSubmitting()).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('.login-button')!.disabled).toBe(false);
    expect(root.querySelector('[role="alert"]')?.textContent)
      .toContain('Неверный логин или пароль.');
    expect(tokenStorage.saveToken).not.toHaveBeenCalled();

    const retryResponse = new Subject<LoginResponseDto>();
    authApi.apiV1AuthLoginPost$Json.mockReturnValue(retryResponse.asObservable());
    component.submit();

    expect(authApi.apiV1AuthLoginPost$Json).toHaveBeenCalledTimes(2);
    expect(component.isSubmitting()).toBe(true);
    expect(component.errorMessage()).toBeNull();
    retryResponse.complete();
  });

  it('unlocks the form when a completed response has no token', () => {
    component.form.setValue({ inputString: 'user', password: 'password' });
    component.submit();

    loginResponse.next({});
    loginResponse.complete();

    expect(component.isSubmitting()).toBe(false);
    expect(component.errorMessage()).toBe('Не удалось выполнить вход. Попробуйте ещё раз.');
    expect(tokenStorage.saveToken).not.toHaveBeenCalled();
  });
});
