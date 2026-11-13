import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiConfiguration } from '../api/api-configuration';
import { ProfileApiService } from './profile-api.service';
import { TokenStorageService } from './token-storage.service';

describe('ProfileApiService', () => {
  let api: ProfileApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApiConfiguration, useValue: { rootUrl: 'https://example.test/' } },
        { provide: TokenStorageService, useValue: { userId: () => 'self' } },
      ],
    });
    api = TestBed.inject(ProfileApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses the existing email search and ignores own and partial matches', () => {
    const result = vi.fn();
    api.checkAvailability('email', 'anna+new@example.test').subscribe(result);
    const request = http.expectOne((req) => req.url === 'https://example.test/api/v1/Users');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('Email')).toBe('anna+new@example.test');
    request.flush({ ids: ['self', 'other'] });
    http
      .expectOne('https://example.test/api/v1/Users/self')
      .flush({ id: 'self', email: 'anna+new@example.test' });
    http
      .expectOne('https://example.test/api/v1/Users/other')
      .flush({ id: 'other', email: 'prefix-anna+new@example.test' });
    expect(result).toHaveBeenCalledWith({ emailAvailable: true });
  });

  it.each(['username', 'email'] as const)(
    'rejects an exact occupied %s using the existing search',
    (field) => {
      const result = vi.fn();
      const value = field === 'username' ? 'anna' : 'anna@example.test';
      api.checkAvailability(field, value).subscribe(result);
      const request = http.expectOne((req) => req.url === 'https://example.test/api/v1/Users');
      expect(request.request.params.get(field === 'username' ? 'Username' : 'Email')).toBe(value);
      request.flush({ ids: ['other'] });
      http
        .expectOne('https://example.test/api/v1/Users/other')
        .flush({ id: 'other', [field]: value });
      expect(result).toHaveBeenCalledWith(
        field === 'username' ? { usernameAvailable: false } : { emailAvailable: false },
      );
    },
  );

  it('propagates search failures so they are not treated as available', () => {
    const failed = vi.fn();
    api.checkAvailability('username', 'anna').subscribe({ error: failed });
    http
      .expectOne((req) => req.url === 'https://example.test/api/v1/Users')
      .flush({}, { status: 500, statusText: 'Error' });
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('updates only the current profile without accepting a caller-supplied ID', () => {
    const body = { username: 'anna', email: 'anna@example.test' };
    api.updateProfile(body).subscribe();
    const request = http.expectOne('https://example.test/api/v1/Users/me');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ id: 'one', ...body });
  });
});
