import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideApiConfiguration } from '../api/api-configuration';
import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from './token-storage.service';
import { UserAvatarService } from './user-avatar.service';

describe('UserAvatarService', () => {
  let api: UserAvatarService;
  let http: HttpTestingController;
  const url = 'http://localhost:5041/api/v1/Users/avatar';
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration('http://localhost:5041/'),
      ],
    });
    TestBed.inject(TokenStorageService).saveToken('token');
    api = TestBed.inject(UserAvatarService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('uploads multipart data with the file field and Bearer token, then bypasses the old cached image', () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    api.uploadAvatar(file).subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('file')).toBeInstanceOf(File);
    expect(request.request.body.get('file').name).toBe('avatar.png');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(api.revision()).toBe(0);
    request.flush(null);
    expect(api.revision()).toBe(1);
    api.getAvatar().subscribe();
    const refreshed = http.expectOne(url + '?v=1');
    expect(refreshed.request.responseType).toBe('blob');
    refreshed.flush(new Blob(['new']));
  });

  it('does not broadcast a refresh when uploading fails', () => {
    api.uploadAvatar(new File(['image'], 'avatar.png')).subscribe({ error: () => {} });
    http.expectOne(url).flush(null, { status: 500, statusText: 'Error' });
    expect(api.revision()).toBe(0);
  });

  it('does not refresh another account after a late response', () => {
    api.uploadAvatar(new File(['image'], 'avatar.png')).subscribe();
    const request = http.expectOne(url);
    TestBed.inject(TokenStorageService).saveToken('other');
    request.flush(null);
    expect(api.revision()).toBe(0);
  });

  it('deletes only the current avatar with Bearer authentication and refreshes consumers', () => {
    api.deleteAvatar().subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush(null);
    expect(api.revision()).toBe(1);
  });

  it('does not broadcast failed or obsolete deletions', () => {
    api.deleteAvatar().subscribe({ error: () => {} });
    http.expectOne(url).flush(null, { status: 500, statusText: 'Error' });
    expect(api.revision()).toBe(0);
    api.deleteAvatar().subscribe();
    const request = http.expectOne(url);
    TestBed.inject(TokenStorageService).saveToken('other');
    request.flush(null);
    expect(api.revision()).toBe(0);
  });
});
