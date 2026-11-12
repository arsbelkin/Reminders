import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { TokenStorageService } from './auth/token-storage.service';
import { authInterceptor } from './auth/auth.interceptor';
import { provideApiConfiguration } from './api/api-configuration';
import { UserAvatarService } from './auth/user-avatar.service';

describe('App account menu', () => {
  const avatarEndpoint = 'http://localhost:5041/api/v1/Users/avatar';
  const createUrl = vi.fn(() => 'blob:test-avatar');
  const revokeUrl = vi.fn();
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;

  function mount(): HTMLElement {
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function signIn(token = 'access-token'): void {
    TestBed.inject(TokenStorageService).saveToken(token);
  }

  function flushAvatar(): void {
    http.expectOne(avatarEndpoint).flush(new Blob(['image'], { type: 'image/png' }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    createUrl.mockReset().mockReturnValue('blob:test-avatar');
    revokeUrl.mockReset();
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = createUrl;
      static override revokeObjectURL = revokeUrl;
    });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration('http://localhost:5041/'),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows the brand without an account button or avatar request for a guest', () => {
    const root = mount();
    expect(root.querySelector('.header__name')?.textContent).toBe('Reminders');
    expect(root.querySelector('app-account-menu')).toBeNull();
    expect(root.querySelector('.header__notifications')).toBeNull();
    expect(root.querySelector('.header__reports')).toBeNull();
    http.expectNone(avatarEndpoint);
  });

  it('shows reports only for an administrator and reacts to account changes', () => {
    const jwt = (role: string) => 'header.' + btoa(JSON.stringify({role})).replace(/=/g, '') + '.signature';
    const root = mount();
    signIn(jwt('User')); fixture.detectChanges(); flushAvatar();
    expect(root.querySelector('.header__reports')).toBeNull();
    signIn(jwt('Admin')); fixture.detectChanges(); flushAvatar();
    expect(root.querySelector('.header__reports')?.getAttribute('href')).toBe('/reports');
    TestBed.inject(TokenStorageService).clearToken(); fixture.detectChanges();
    expect(root.querySelector('.header__reports')).toBeNull();
  });

  it('restores a saved session and requests the avatar as a blob with the Bearer token', () => {
    localStorage.setItem('X-Access-Token', 'saved-token');
    const root = mount();
    const request = http.expectOne(avatarEndpoint);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBe('Bearer saved-token');
    expect(root.querySelector('.default-avatar')).not.toBeNull();
    request.flush(new Blob(['image'], {type: 'image/png'}));
    fixture.detectChanges();
    expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:test-avatar');
  });

  it('shows the account button immediately after login without reloading the page', () => {
    const root = mount();
    signIn();
    fixture.detectChanges();
    flushAvatar();
    expect(root.querySelector('.account-button')).not.toBeNull();
    expect(root.querySelector('img')).not.toBeNull();
  });

  it('refreshes the header avatar immediately after uploading a new image', () => {
    signIn(); const root = mount(); flushAvatar();
    createUrl.mockReturnValue('blob:new-avatar');
    TestBed.inject(UserAvatarService).uploadAvatar(new File(['new'], 'avatar.png', {type: 'image/png'})).subscribe();
    http.expectOne(avatarEndpoint).flush(null); fixture.detectChanges();
    http.expectOne(avatarEndpoint + '?v=1').flush(new Blob(['new'], {type: 'image/png'})); fixture.detectChanges();
    expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:new-avatar');
    expect(revokeUrl).toHaveBeenCalledWith('blob:test-avatar');
  });

  it('replaces a deleted header avatar with the default icon', () => {
    signIn(); const root = mount(); flushAvatar();
    TestBed.inject(UserAvatarService).deleteAvatar().subscribe();
    const deletion = http.expectOne(avatarEndpoint); expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null); fixture.detectChanges();
    http.expectOne(avatarEndpoint + '?v=1').flush(null, {status: 404, statusText: 'No avatar'}); fixture.detectChanges();
    expect(root.querySelector('img')).toBeNull(); expect(root.querySelector('.default-avatar')).not.toBeNull();
    expect(revokeUrl).toHaveBeenCalledWith('blob:test-avatar');
  });

  it.each([404, 500])('keeps the default avatar and session on HTTP %s', status => {
    signIn();
    const root = mount();
    http.expectOne(avatarEndpoint).flush(null, {status, statusText: 'No avatar'});
    fixture.detectChanges();
    expect(root.querySelector('.default-avatar')).not.toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(TestBed.inject(TokenStorageService).getToken()).toBe('access-token');
  });

  it('falls back to the standard icon if the image cannot be decoded', () => {
    signIn();
    const root = mount();
    flushAvatar();
    root.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.default-avatar')).not.toBeNull();
  });

  it('opens account choices, closes on outside click and returns focus on Escape', () => {
    signIn();
    const root = mount();
    flushAvatar();
    const trigger = root.querySelector<HTMLButtonElement>('.account-button')!;
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = root.querySelectorAll<HTMLElement>('.account-option');
    expect([...items].map(item => item.querySelector('span')?.textContent))
      .toEqual(['Профиль', 'Выйти']);
    expect(items[0].getAttribute('href')).toBe('/profile');
    expect((items[1] as HTMLButtonElement).disabled).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(root.querySelector('.account-options')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    fixture.detectChanges();
    root.querySelector<HTMLElement>('.footer__brand')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.account-options')).toBeNull();
    expect(TestBed.inject(TokenStorageService).getToken()).toBe('access-token');
  });

  it('opens the profile from the account menu and closes the choices', () => {
    signIn(); const root = mount(); flushAvatar();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('.account-button')!.click(); fixture.detectChanges();
    root.querySelector<HTMLAnchorElement>('a.account-option')!.click(); fixture.detectChanges();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.account-options')).toBeNull();
  });

  it('removes the avatar and menu and releases the object URL when the session is cleared', () => {
    signIn();
    const root = mount();
    flushAvatar();
    root.querySelector<HTMLButtonElement>('.account-button')!.click();
    fixture.detectChanges();
    TestBed.inject(TokenStorageService).clearToken();
    fixture.detectChanges();
    expect(root.querySelector('app-account-menu')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:test-avatar');
  });

  it('cancels an earlier session request when the token changes', () => {
    signIn('first-token');
    mount();
    const earlier = http.expectOne(avatarEndpoint);
    signIn('second-token');
    fixture.detectChanges();
    expect(earlier.cancelled).toBe(true);
    const current = http.expectOne(avatarEndpoint);
    expect(current.request.headers.get('Authorization')).toBe('Bearer second-token');
    current.flush(new Blob(['new image'], {type: 'image/png'}));
    fixture.detectChanges();
    expect(createUrl).toHaveBeenCalledTimes(1);
  });

  it('releases an existing avatar before loading another account', () => {
    signIn();
    const root = mount();
    flushAvatar();
    signIn('another-token');
    fixture.detectChanges();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:test-avatar');
    expect(root.querySelector('img')).toBeNull();
    flushAvatar();
  });

  it('reacts to token removal in another tab', () => {
    signIn();
    const root = mount();
    flushAvatar();
    expect(root.querySelector<HTMLAnchorElement>('.header__notifications')?.getAttribute('href')).toBe('/notifications');
    localStorage.removeItem('X-Access-Token');
    window.dispatchEvent(new StorageEvent('storage', {key: 'X-Access-Token', storageArea: localStorage}));
    fixture.detectChanges();
    expect(root.querySelector('app-account-menu')).toBeNull();
    expect(root.querySelector('.header__notifications')).toBeNull();
    expect(TestBed.inject(TokenStorageService).token()).toBeNull();
  });
});
