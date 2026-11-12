import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiConfiguration } from '../api/api-configuration';
import { UserSearchService } from './user-search.service';

describe('UserSearchService', () => {
  let search: UserSearchService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: ApiConfiguration, useValue: {rootUrl: 'https://example.test/'}},
    ]});
    search = TestBed.inject(UserSearchService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('returns no users for whitespace without fetching every account', () => {
    const result = vi.fn(); search.find('email', '   ').subscribe(result);
    expect(result).toHaveBeenCalledExactlyOnceWith([]); http.expectNone(() => true);
  });

  it('loads one user record per unique ID from the email search', () => {
    const result = vi.fn(); search.find('email', ' anna ').subscribe(result);
    const request = http.expectOne('https://example.test/api/v1/Users?Email=anna');
    expect(request.request.params.has('Username')).toBe(false); request.flush({ids: ['one', 'two', 'one']});
    http.expectOne('https://example.test/api/v1/Users/one').flush({id: 'one', username: 'anna', email: 'anna@example.test'});
    http.expectOne('https://example.test/api/v1/Users/two').flush({id: 'two', username: 'anna2', email: 'anna2@example.test'});
    expect(result.mock.calls[0][0]).toHaveLength(2);
  });

  it('returns an empty list if the search has no matches', () => {
    const result = vi.fn(); search.find('email', 'nobody').subscribe(result);
    http.expectOne('https://example.test/api/v1/Users?Email=nobody').flush({ids: []});
    expect(result).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('cancels both the search and outstanding user detail requests', () => {
    const first = search.find('email', 'anna').subscribe();
    const firstRequest = http.expectOne('https://example.test/api/v1/Users?Email=anna');
    first.unsubscribe(); expect(firstRequest.cancelled).toBe(true);
    const second = search.find('email', 'ivan').subscribe();
    http.expectOne('https://example.test/api/v1/Users?Email=ivan').flush({ids: ['one', 'two']});
    const details = http.match(req => req.url.startsWith('https://example.test/api/v1/Users/'));
    second.unsubscribe(); expect(details.every(request => request.cancelled)).toBe(true);
  });
});
