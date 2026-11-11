import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly key = 'X-Access-Token';
  private readonly storedToken = signal(localStorage.getItem(this.key));
  readonly token = this.storedToken.asReadonly();

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
