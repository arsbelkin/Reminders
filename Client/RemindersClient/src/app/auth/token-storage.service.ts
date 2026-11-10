import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly key = 'X-Access-Token';

  saveToken(token: string): void {
    localStorage.setItem(this.key, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.key);
  }

  clearToken(): void {
    localStorage.removeItem(this.key);
  }
}
