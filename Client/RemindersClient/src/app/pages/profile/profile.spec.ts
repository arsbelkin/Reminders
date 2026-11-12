import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import { UsersService } from '../../api/services';
import { UserInfoDto } from '../../api/models/user-info-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { UserAvatarService } from '../../auth/user-avatar.service';
import { routes } from '../../app.routes';
import { Profile } from './profile';
import { ProfileApiService } from '../../auth/profile-api.service';

@Component({selector: 'app-profile-login-stub', template: 'Вход'}) class LoginStub {}

describe('Profile', () => {
  let harness: RouterTestingHarness;
  let component: Profile;
  let response: Subject<UserInfoDto>;
  let avatar: Subject<Blob>;
  let token = signal<string | null>('token');
  const api = {apiV1UsersIdGet$Json: vi.fn()};
  const profileApi = {checkAvailability: vi.fn(), updateProfile: vi.fn()};
  const avatars = {getAvatar: vi.fn(), uploadAvatar: vi.fn(), deleteAvatar: vi.fn(), revision: signal(0)};
  const createUrl = vi.fn(() => 'blob:profile-test');
  const revokeUrl = vi.fn();
  const data = {id: 'one', username: 'anna', email: 'anna@example.test'};
  const root = () => harness.routeNativeElement!;
  const requests = () => {
    response = new Subject<UserInfoDto>(); avatar = new Subject<Blob>();
    api.apiV1UsersIdGet$Json.mockReturnValue(response); avatars.getAvatar.mockReturnValue(avatar);
  };
  const resolve = (user: UserInfoDto = data) => { response.next(user); response.complete(); harness.detectChanges(); };

  beforeEach(async () => {
    avatars.revision.set(0); avatars.uploadAvatar.mockReset(); avatars.deleteAvatar.mockReset();
    token = signal('token'); api.apiV1UsersIdGet$Json.mockReset(); avatars.getAvatar.mockReset();
    profileApi.checkAvailability.mockReset().mockReturnValue(of({usernameAvailable: true, emailAvailable: true}));
    profileApi.updateProfile.mockReset();
    createUrl.mockReset().mockReturnValue('blob:profile-test'); revokeUrl.mockReset(); requests();
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = createUrl;
      static override revokeObjectURL = revokeUrl;
    });
    TestBed.configureTestingModule({providers: [
      {provide: UsersService, useValue: api}, {provide: UserAvatarService, useValue: avatars},
      {provide: ProfileApiService, useValue: profileApi},
      {provide: TokenStorageService, useValue: {token, getToken: () => token(), userId: () => token() ? 'one' : null}},
      provideRouter([routes.find(route => route.path === 'profile')!, {path: 'login', component: LoginStub}]),
    ]});
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/profile', Profile);
  });
  afterEach(() => { harness.fixture.destroy(); vi.unstubAllGlobals(); });

  it('loads the current user and renders login and email without a role or technical ID', () => {
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Загружаем профиль');
    component.reload(); expect(api.apiV1UsersIdGet$Json).toHaveBeenCalledExactlyOnceWith({id: 'one'});
    resolve();
    expect(root().querySelector('h1')?.textContent).toBe('Мой профиль');
    expect(root().querySelector('.profile-identity h2')?.textContent).toBe(data.username);
    expect([...root().querySelectorAll('dt')].map(item => item.textContent)).toEqual(['Логин', 'Email']);
    expect(root().querySelector('.profile-fields')?.textContent).toContain(data.email);
    expect(root().querySelector('.profile-role')).toBeNull();
    expect(root().querySelector('.profile-default-avatar')).not.toBeNull();
  });

  it('renders an avatar and releases its object URL on leaving', () => {
    resolve(); avatar.next(new Blob(['avatar'], {type: 'image/png'})); avatar.complete(); harness.detectChanges();
    expect(root().querySelector('img')?.getAttribute('src')).toBe('blob:profile-test');
    expect(createUrl).toHaveBeenCalledTimes(1); harness.fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:profile-test');
  });

  it.each([404, 500])('keeps profile data when the avatar returns %s', status => {
    avatar.error({status}); resolve();
    expect(root().querySelector('.profile-default-avatar')).not.toBeNull();
    expect(root().textContent).toContain(data.email); expect(root().querySelector('[role="alert"]')).toBeNull();
  });

  it('uses the default avatar if the image cannot be decoded', () => {
    resolve(); avatar.next(new Blob(['bad-image'])); harness.detectChanges();
    root().querySelector('img')!.dispatchEvent(new Event('error')); harness.detectChanges();
    expect(root().querySelector('.profile-default-avatar')).not.toBeNull();
    expect(root().querySelector('.delete-avatar')).not.toBeNull();
  });

  it('deletes the saved photo and falls back to the default icon without reloading profile data', () => {
    resolve(); expect(root().querySelector('.delete-avatar')).toBeNull();
    avatar.next(new Blob(['old'])); avatar.complete(); harness.detectChanges();
    const deletion = new Subject<void>(); avatars.deleteAvatar.mockReturnValue(deletion);
    root().querySelector<HTMLButtonElement>('.delete-avatar')!.click(); harness.detectChanges();
    const removed = new Subject<Blob>(); avatars.getAvatar.mockReturnValue(removed);
    avatars.revision.update(value => value + 1); deletion.next(); deletion.complete();
    harness.detectChanges(); TestBed.tick(); removed.error({status: 404}); harness.detectChanges();
    expect(root().querySelector('.profile-default-avatar')).not.toBeNull();
    expect(root().querySelector('.delete-avatar')).toBeNull();
    expect(root().textContent).toContain('Фото удалено');
    expect(api.apiV1UsersIdGet$Json).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:profile-test');
  });

  it('previews a selected photo, restores the saved avatar on cancel, and refreshes after saving', () => {
    resolve(); avatar.next(new Blob(['old'])); avatar.complete(); harness.detectChanges();
    createUrl.mockReturnValue('blob:chosen-photo');
    const file = new File(['image'], 'avatar.png', {type: 'image/png'});
    const select = () => {
      const input = root().querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, 'files', {configurable: true, value: [file]});
      input.dispatchEvent(new Event('change')); harness.detectChanges();
    };
    select(); expect(root().querySelector('img')?.getAttribute('src')).toBe('blob:chosen-photo');
    root().querySelector<HTMLButtonElement>('.cancel-avatar')!.click(); harness.detectChanges();
    expect(root().querySelector('img')?.getAttribute('src')).toBe('blob:profile-test');
    select(); const upload = new Subject<void>(); avatars.uploadAvatar.mockReturnValue(upload);
    root().querySelector<HTMLButtonElement>('.save-avatar')!.click(); harness.detectChanges();
    component.reload(); expect(api.apiV1UsersIdGet$Json).toHaveBeenCalledTimes(1);
    const nextAvatar = new Subject<Blob>(); avatars.getAvatar.mockReturnValue(nextAvatar);
    avatars.revision.update(value => value + 1); upload.next(); upload.complete();
    harness.detectChanges(); TestBed.tick(); createUrl.mockReturnValue('blob:stored-photo');
    nextAvatar.next(new Blob(['new'])); nextAvatar.complete(); harness.detectChanges();
    expect(root().querySelector('img')?.getAttribute('src')).toBe('blob:stored-photo');
    expect(root().textContent).toContain('Фото профиля обновлено');
  });

  it('retries loading errors and refreshes profile data', () => {
    response.error({status: 500}); harness.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Не удалось загрузить профиль');
    requests(); root().querySelector<HTMLButtonElement>('.retry-button')!.click(); harness.detectChanges(); TestBed.tick();
    resolve(); expect(root().textContent).toContain(data.email);
    requests(); component.reload(); harness.detectChanges(); TestBed.tick();
    resolve({...data, username: 'updated'});
    expect(root().querySelector('.profile-identity h2')?.textContent).toBe('updated');
  });

  it('cancels an old account request and clears profile data on logout', () => {
    const oldResponse = response; const oldAvatar = avatar; requests();
    token.set('new-session'); harness.detectChanges(); TestBed.tick();
    expect(oldResponse.observed).toBe(false); expect(oldAvatar.observed).toBe(false);
    oldResponse.next(data); resolve({...data, username: 'new-user'});
    token.set(null); harness.detectChanges(); TestBed.tick();
    expect(root().querySelector('.profile-card')).toBeNull(); expect(root().textContent).not.toContain(data.email);
    expect(root().textContent).toContain('Войдите в аккаунт');
  });

  it('handles missing optional fields', () => {
    resolve({}); expect(root().querySelector('.profile-identity h2')?.textContent).toBe('Пользователь');
    expect(root().querySelector('.profile-fields')?.textContent).toContain('Не указан');
  });

  it('protects a direct profile URL without loading personal data for a guest', async () => {
    token.set(null); api.apiV1UsersIdGet$Json.mockClear(); avatars.getAvatar.mockClear();
    await harness.navigateByUrl('/login', LoginStub);
    await harness.navigateByUrl('/profile', LoginStub);
    expect(api.apiV1UsersIdGet$Json).not.toHaveBeenCalled(); expect(avatars.getAvatar).not.toHaveBeenCalled();
  });

  const edit = () => { resolve(); component.openEditor(); harness.detectChanges(); };
  const input = (field: 'username' | 'email', value: string) => {
    const element = root().querySelector<HTMLInputElement>('#profile-' + field)!;
    element.value = value; element.dispatchEvent(new Event('input')); harness.detectChanges();
  };
  const settleChecks = async () => { await new Promise(resolve => setTimeout(resolve, 400)); harness.detectChanges(); };

  it('permits unchanged own values without availability calls or saving', () => {
    edit(); expect(component.form.valid).toBe(true); expect(component.changed()).toBe(false);
    component.submit(); expect(profileApi.checkAvailability).not.toHaveBeenCalled();
    expect(profileApi.updateProfile).not.toHaveBeenCalled();
  });

  it('validates empty login and malformed email without calling the server', () => {
    edit(); input('username', '   '); input('email', 'bad-email'); component.submit();
    expect(component.form.invalid).toBe(true); expect(profileApi.checkAvailability).not.toHaveBeenCalled();
    expect(profileApi.updateProfile).not.toHaveBeenCalled();
  });

  it.each(['username', 'email'] as const)('blocks an occupied %s and allows a corrected value', async field => {
    edit(); profileApi.checkAvailability.mockReturnValueOnce(of({usernameAvailable: false, emailAvailable: false}));
    input(field, field === 'username' ? 'taken' : 'taken@example.test');
    expect(root().querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
    await settleChecks();
    expect(component.form.controls[field].hasError('taken')).toBe(true);
    expect(root().querySelector('.field-error')?.textContent).toContain('уже занят');
    component.submit(); expect(profileApi.updateProfile).not.toHaveBeenCalled();
    input(field, field === 'username' ? 'available' : 'available@example.test'); await settleChecks();
    expect(component.form.valid).toBe(true);
    expect(root().querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
  });

  it('ignores obsolete availability responses when typing a newer value', async () => {
    edit(); const old = new Subject<{usernameAvailable: boolean}>();
    profileApi.checkAvailability.mockReturnValueOnce(old);
    input('username', 'old'); await settleChecks(); expect(old.observed).toBe(true);
    input('username', 'new'); expect(old.observed).toBe(false);
    old.next({usernameAvailable: false}); await settleChecks(); expect(component.form.valid).toBe(true);
  });

  it('blocks save on availability network errors and offers a retry', async () => {
    edit(); profileApi.checkAvailability.mockReturnValueOnce(throwError(() => ({status: 500})));
    input('email', 'new@example.test'); await settleChecks();
    expect(component.form.controls.email.hasError('checkFailed')).toBe(true);
    expect(root().querySelector('.check-retry')).not.toBeNull();
    component.submit(); expect(profileApi.updateProfile).not.toHaveBeenCalled();
    root().querySelector<HTMLButtonElement>('.check-retry')!.click(); await settleChecks();
    expect(component.form.valid).toBe(true);
  });

  it('saves trimmed data once, blocks repeated clicks, and reloads the profile', async () => {
    edit(); input('username', ' updated '); input('email', 'updated@example.test'); await settleChecks();
    const save = new Subject<UserInfoDto>(); profileApi.updateProfile.mockReturnValue(save);
    component.submit(); component.submit(); harness.detectChanges();
    expect(profileApi.updateProfile).toHaveBeenCalledExactlyOnceWith({username: 'updated', email: 'updated@example.test'});
    expect(root().querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
    component.cancelEdit(); expect(component.editing()).not.toBeNull();
    requests(); save.next({...data, username: 'updated'}); save.complete(); harness.detectChanges(); TestBed.tick();
    resolve({...data, username: 'updated', email: 'updated@example.test'});
    expect(component.editing()).toBeNull(); expect(root().textContent).toContain('Изменения сохранены');
    expect(root().querySelector('.profile-identity h2')?.textContent).toBe('updated');
  });

  it('retains the draft and marks a field when a value is taken during saving', async () => {
    edit(); input('username', 'new-user'); await settleChecks();
    profileApi.updateProfile.mockReturnValue(throwError(() => ({status: 409, error: {field: 'username'}})));
    component.submit(); harness.detectChanges();
    expect(component.form.controls.username.hasError('taken')).toBe(true);
    expect(component.form.controls.username.value).toBe('new-user'); expect(component.busy()).toBe(false);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Данные уже заняты');
  });

  it('keeps the draft on a failed save and allows retrying', async () => {
    edit(); input('username', 'new-user'); await settleChecks();
    profileApi.updateProfile.mockReturnValueOnce(throwError(() => ({status: 500}))).mockReturnValueOnce(new Subject());
    component.submit(); harness.detectChanges();
    expect(root().textContent).toContain('Не удалось сохранить профиль');
    component.submit(); expect(profileApi.updateProfile).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending save and clears the draft when the account changes', async () => {
    edit(); input('username', 'new-user'); await settleChecks();
    const save = new Subject<UserInfoDto>(); profileApi.updateProfile.mockReturnValue(save);
    component.submit(); token.set('new-token'); harness.detectChanges(); TestBed.tick();
    expect(save.observed).toBe(false); expect(component.editing()).toBeNull(); expect(component.busy()).toBe(false);
    save.next(data); expect(component.saved()).toBe(false);
  });

  it('discards a cancelled draft without saving', () => {
    edit(); input('username', 'draft'); component.cancelEdit(); harness.detectChanges();
    expect(root().querySelector('form')).toBeNull();
    expect(root().querySelector('.profile-fields')?.textContent).toContain('anna');
    expect(profileApi.updateProfile).not.toHaveBeenCalled();
  });

  it('cancels availability requests on leaving the profile', async () => {
    edit(); const check = new Subject<{usernameAvailable: boolean}>();
    profileApi.checkAvailability.mockReturnValue(check);
    input('username', 'new-user'); await settleChecks(); expect(check.observed).toBe(true);
    harness.fixture.destroy(); expect(check.observed).toBe(false);
  });
});
