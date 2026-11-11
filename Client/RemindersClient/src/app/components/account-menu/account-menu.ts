import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { TokenStorageService } from '../../auth/token-storage.service';
import { UserAvatarService } from '../../auth/user-avatar.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-account-menu',
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu(true)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class AccountMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly avatars = inject(UserAvatarService);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('accountButton');
  readonly avatarUrl = signal<string | null>(null);
  readonly menuOpen = signal(false);

  private readonly router = inject(Router);

  logout(): void {
    this.closeMenu();
    this.tokenStorage.clearToken();

    void this.router.navigate(['/login'], {
      replaceUrl: true,
    });
  }

  constructor() {
    effect((onCleanup) => {
      const token = this.tokenStorage.token();
      this.menuOpen.set(false);
      this.avatarUrl.set(null);
      if (!token) return;

      let objectUrl: string | null = null;
      const request = this.avatars.getAvatar().subscribe({
        next: (blob) => {
          objectUrl = URL.createObjectURL(blob);
          this.avatarUrl.set(objectUrl);
        },
        error: () => this.avatarUrl.set(null),
      });
      onCleanup(() => {
        request.unsubscribe();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (restoreFocus) this.trigger().nativeElement.focus();
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.closeMenu();
  }

  onFocusOut(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) this.closeMenu();
  }
}
