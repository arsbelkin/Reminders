import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { AuthService } from '../../api/services';
import { IdResponseDto } from '../../api/models/id-response-dto';
import { routes } from '../../app.routes';
import { Register } from './register';

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let component: Register;
  let response: Subject<IdResponseDto>;
  const api = {apiV1AuthRegisterPost$Json: vi.fn()};
  const values = {username: '  test-user  ', email: '  user@example.test  ', password: ' password with spaces ', passwordVerify: ' password with spaces '};
  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    response = new Subject<IdResponseDto>(); api.apiV1AuthRegisterPost$Json.mockReset().mockReturnValue(response);
    TestBed.configureTestingModule({providers: [provideRouter([]), {provide: AuthService, useValue: api}]});
    fixture = TestBed.createComponent(Register); component = fixture.componentInstance; fixture.detectChanges();
  });

  it('validates empty fields and focuses the first invalid input without sending a request', () => {
    component.submit(); fixture.detectChanges();
    expect(component.form.invalid).toBe(true); expect(api.apiV1AuthRegisterPost$Json).not.toHaveBeenCalled();
    expect(root().querySelectorAll('.field-error')).toHaveLength(4);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Проверьте заполнение');
    expect(document.activeElement?.id).toBe('register-username');
  });

  it.each([
    ['username', '   '], ['email', 'bad-address'], ['email', 'user@domain'], ['password', '   '], ['passwordVerify', 'different'],
  ] as const)('rejects invalid %s', (field, value) => {
    component.form.setValue({...values, [field]: value}); component.submit();
    expect(api.apiV1AuthRegisterPost$Json).not.toHaveBeenCalled();
  });

  it('updates password matching when either password changes', () => {
    component.form.setValue({...values, email: 'user@example.test', username: 'test-user'});
    component.form.controls.password.setValue('changed');
    expect(component.form.hasError('passwordMismatch')).toBe(true);
    component.form.controls.passwordVerify.setValue('changed');
    expect(component.form.valid).toBe(true);
  });

  it('toggles both password fields independently without changing their values or submitting', () => {
    component.form.setValue(values); fixture.detectChanges();
    const password = root().querySelector<HTMLInputElement>('#register-password')!;
    const confirmation = root().querySelector<HTMLInputElement>('#register-password-verify')!;
    expect(password.type).toBe('password'); expect(confirmation.type).toBe('password');
    root().querySelector<HTMLButtonElement>('[aria-label="Показать пароль"]')!.click(); fixture.detectChanges();
    expect(password.type).toBe('text'); expect(confirmation.type).toBe('password');
    root().querySelector<HTMLButtonElement>('[aria-label="Показать подтверждение пароля"]')!.click(); fixture.detectChanges();
    expect(confirmation.type).toBe('text'); expect(password.value).toBe(values.password);
    expect(confirmation.value).toBe(values.passwordVerify); expect(api.apiV1AuthRegisterPost$Json).not.toHaveBeenCalled();
  });

  it('trims login and email, preserves passwords, blocks duplicate requests and shows success with a login link', () => {
    component.form.setValue(values); component.submit(); component.submit(); fixture.detectChanges();
    expect(api.apiV1AuthRegisterPost$Json).toHaveBeenCalledExactlyOnceWith({body: {...values, username: 'test-user', email: 'user@example.test'}});
    expect(root().querySelector<HTMLButtonElement>('.login-button')!.disabled).toBe(true);
    expect(root().querySelector('fieldset')?.disabled).toBe(true);
    response.next({id: 'new-user'}); response.complete(); fixture.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Аккаунт создан!');
    expect(root().querySelector('a[href="/login"]')).not.toBeNull(); expect(root().querySelector('form')).toBeNull();
    expect(component.form.controls.password.value).toBe(''); expect(component.form.controls.passwordVerify.value).toBe('');
    component.submit(); expect(api.apiV1AuthRegisterPost$Json).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, 'Email: user@example.test already exists', 'Этот email уже зарегистрирован.'],
    [409, 'Username: test-user already exists', 'Этот логин уже занят.'],
    [409, undefined, 'Логин или email уже заняты.'],
    [422, undefined, 'Укажите корректный email.'],
    [401, undefined, 'Пароли не совпадают.'],
    [400, undefined, 'Проверьте данные регистрации.'],
    [0, undefined, 'Нет соединения с сервером. Попробуйте ещё раз.'],
    [500, 'Sensitive server details', 'Не удалось зарегистрироваться. Попробуйте ещё раз.'],
  ])('handles error %s and permits retry', (status, title, message) => {
    component.form.setValue(values); component.submit(); response.error({status, error: {title}}); fixture.detectChanges();
    expect(component.isSubmitting()).toBe(false); expect(component.errorMessage()).toBe(message);
    expect(component.form.controls.password.value).toBe(values.password);
    expect(root().querySelector<HTMLButtonElement>('.login-button')!.disabled).toBe(false);
    root().querySelector<HTMLButtonElement>('[aria-label="Закрыть уведомление"]')!.click(); fixture.detectChanges();
    expect(root().querySelector('[role="alert"]')).toBeNull();
    const retry = new Subject<IdResponseDto>(); api.apiV1AuthRegisterPost$Json.mockReturnValue(retry);
    component.submit(); expect(api.apiV1AuthRegisterPost$Json).toHaveBeenCalledTimes(2);
  });

  it('cancels the pending request when navigating away', () => {
    component.form.setValue(values); component.submit(); expect(response.observed).toBe(true);
    fixture.destroy(); expect(response.observed).toBe(false);
  });

  it('opens registration by its public route', async () => {
    const route = routes.find(item => item.path === 'register')!;
    expect(route.canActivate).toBeUndefined(); fixture.destroy(); TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [provideRouter([route]), {provide: AuthService, useValue: api}]});
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/register', Register);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Создать аккаунт');
    expect(api.apiV1AuthRegisterPost$Json).not.toHaveBeenCalled();
  });
});
