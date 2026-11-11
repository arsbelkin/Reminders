import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService identity', () => {
  const key = 'X-Access-Token';
  function token(payload: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'header.' + encoded + '.signature';
  }
  beforeEach(() => { localStorage.removeItem(key); });
  afterEach(() => { TestBed.resetTestingModule(); localStorage.removeItem(key); });

  it.each(['nameid', 'sub', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'])('reads %s without treating decoded claims as server authorization', claim => {
    const storage = TestBed.inject(TokenStorageService);
    storage.saveToken(token({[claim]: ' OWNER ', email: 'имя@example.test'}));
    expect(storage.userId()).toBe('owner');
    storage.clearToken();
    expect(storage.userId()).toBeNull();
  });

  it.each(['invalid', 'header.%%%%.signature', 'header..signature', null])('handles a missing or malformed JWT: %s', value => {
    if (value) localStorage.setItem(key, value);
    expect(TestBed.inject(TokenStorageService).userId()).toBeNull();
  });

  it.each([null, {}, {nameid: 123}, {nameid: '   '}, ['owner']])('rejects unusable identity claims: %j', payload => {
    localStorage.setItem(key, token(payload));
    expect(TestBed.inject(TokenStorageService).userId()).toBeNull();
  });

  it('updates identity after saving another account or receiving a storage event', () => {
    const storage = TestBed.inject(TokenStorageService);
    storage.saveToken(token({nameid: 'first'}));
    expect(storage.userId()).toBe('first');
    storage.saveToken(token({nameid: 'second'}));
    expect(storage.userId()).toBe('second');
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage', {key, storageArea: localStorage}));
    expect(storage.userId()).toBeNull();
  });
});
