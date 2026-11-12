import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { TokenStorageService } from './auth/token-storage.service';
import { authInterceptor } from './auth/auth.interceptor';
import { provideApiConfiguration } from './api/api-configuration';

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
    http.expectNone(avatarEndpoint);
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
    const items = root.querySelectorAll<HTMLButtonElement>('.account-option');
    expect([...items].map(item => item.querySelector('span')?.textContent))
      .toEqual(['Профиль', 'Выйти']);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(false);
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
