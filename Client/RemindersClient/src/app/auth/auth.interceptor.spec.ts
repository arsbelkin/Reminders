import { Component } from '@angular/core';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApiConfiguration } from '../api/api-configuration';
import { authGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from './token-storage.service';

@Component({ template: 'Страница входа' })
class LoginPage {}

@Component({ template: 'Напоминания' })
class RemindersPage {}

describe('authInterceptor', () => {
  const apiRoot = 'http://localhost:5041';
  const remindersUrl = `${apiRoot}/api/v1/Reminders`;
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let storedToken: string | null;
  const tokenStorage = {
    getToken: vi.fn(() => storedToken),
    clearToken: vi.fn(() => { storedToken = null; }),
  };

  function failRequest(url = remindersUrl, status = 401) {
    const onError = vi.fn();
    http.get(url).subscribe({ error: onError });
    httpTesting.expectOne(url).flush(null, { status, statusText: 'Request failed' });
    return onError;
  }

  async function expectLoginRedirect(): Promise<void> {
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/login'], { replaceUrl: true });
    await vi.mocked(router.navigate).mock.results[0].value;
    harness.detectChanges();
    expect(router.url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Страница входа');
  }

  beforeEach(async () => {
    storedToken = 'access-token';
    tokenStorage.getToken.mockClear();
    tokenStorage.clearToken.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(`${apiRoot}/`),
        { provide: TokenStorageService, useValue: tokenStorage },
        provideRouter([
          { path: 'login', component: LoginPage },
          { path: 'reminders', component: RemindersPage, canActivate: [authGuard] },
        ]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create('/reminders');
    vi.spyOn(router, 'navigate');
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('adds the token to API requests and leaves successful responses unchanged', () => {
    const onResponse = vi.fn();
    http.get(remindersUrl).subscribe(onResponse);
    const request = httpTesting.expectOne(remindersUrl);

    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush([{ id: '1' }]);

    expect(onResponse).toHaveBeenCalledExactlyOnceWith([{ id: '1' }]);
    expect(storedToken).toBe('access-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears a rejected token and opens the login page while preserving the HTTP error', async () => {
    const onError = failRequest();

    expect(tokenStorage.clearToken).toHaveBeenCalledTimes(1);
    expect(storedToken).toBeNull();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
    expect(onError.mock.calls[0][0].status).toBe(401);
    await expectLoginRedirect();
  });

  it('redirects on API 401 even when no token was sent', async () => {
    storedToken = null;
    http.get(remindersUrl).subscribe({ error: vi.fn() });
    const request = httpTesting.expectOne(remindersUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expectLoginRedirect();
  });

  it.each(['login', 'register'])('keeps public auth errors local to the %s form', (endpoint) => {
    const onError = failRequest(`${apiRoot}/api/v1/Auth/${endpoint}/?source=form`);

    expect(onError.mock.calls[0][0].status).toBe(401);
    expect(tokenStorage.clearToken).not.toHaveBeenCalled();
    expect(storedToken).toBe('access-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not attach the token or redirect for errors from another server', () => {
    const url = 'http://localhost:50410/api/v1/Reminders';
    http.get(url).subscribe({ error: vi.fn() });
    const request = httpTesting.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(tokenStorage.clearToken).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each([403, 500])('keeps the session after HTTP %s', (status) => {
    const onError = failRequest(remindersUrl, status);

    expect(onError.mock.calls[0][0].status).toBe(status);
    expect(storedToken).toBe('access-token');
    expect(tokenStorage.clearToken).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not redirect after a network error', () => {
    http.get(remindersUrl).subscribe({ error: vi.fn() });
    httpTesting.expectOne(remindersUrl).error(new ProgressEvent('error'));

    expect(storedToken).toBe('access-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate again when the login page is already open', async () => {
    await harness.navigateByUrl('/login?returnUrl=%2Freminders');
    failRequest();

    expect(storedToken).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.url).toBe('/login?returnUrl=%2Freminders');
  });

  it('redirects once when concurrent requests reject the same token', async () => {
    http.get(remindersUrl).subscribe({ error: vi.fn() });
    http.get(`${remindersUrl}/1`).subscribe({ error: vi.fn() });
    const first = httpTesting.expectOne(remindersUrl);
    const second = httpTesting.expectOne(`${remindersUrl}/1`);

    first.flush(null, { status: 401, statusText: 'Unauthorized' });
    second.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(tokenStorage.clearToken).toHaveBeenCalledTimes(1);
    await expectLoginRedirect();
  });

  it('does not clear a new token because an older request failed', () => {
    http.get(remindersUrl).subscribe({ error: vi.fn() });
    const request = httpTesting.expectOne(remindersUrl);
    storedToken = 'new-access-token';
    request.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(storedToken).toBe('new-access-token');
    expect(tokenStorage.clearToken).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
