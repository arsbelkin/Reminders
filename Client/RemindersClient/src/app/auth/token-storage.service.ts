import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly key = 'X-Access-Token';
  private readonly storedToken = signal(localStorage.getItem(this.key));
  readonly token = this.storedToken.asReadonly();
  // Used only to adjust the UI; the API still checks token validity and ownership.
  private readonly claims = computed<Record<string, unknown> | null>(() => {
    const token = this.storedToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), char => char.charCodeAt(0));
      const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
    } catch { return null; }
  });
  readonly userId = computed(() => {
    const claims = this.claims();
    const id = claims?.['nameid'] ?? claims?.['sub'] ?? claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
    return typeof id === 'string' && id.trim() ? id.trim().toLowerCase() : null;
  });
  readonly isAdmin = computed(() => {
    const claims = this.claims();
    const role = claims?.['role'] ?? claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    return role === 'Admin' || Array.isArray(role) && role.includes('Admin');
  });

  constructor() {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === this.key || event.key === null)) {
        this.storedToken.set(this.getToken());
      }
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  saveToken(token: string): void {
    localStorage.setItem(this.key, token);
    this.storedToken.set(token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.key);
  }

  clearToken(): void {
    localStorage.removeItem(this.key);
    this.storedToken.set(null);
  }
}
