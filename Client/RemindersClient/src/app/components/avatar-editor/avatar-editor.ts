import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { TokenStorageService } from '../../auth/token-storage.service';
import { UserAvatarService } from '../../auth/user-avatar.service';

@Component({
  selector: 'app-avatar-editor',
  templateUrl: './avatar-editor.html',
  styleUrl: './avatar-editor.css',
})
export class AvatarEditor {
  private readonly avatars = inject(UserAvatarService);
  private readonly session = inject(TokenStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private previewUrl: string | null = null;
  readonly previewChange = output<string | null>();
  readonly disabled = input(false);
  readonly hasAvatar = input(false);
  readonly file = signal<File | null>(null);
  readonly busy = signal(false);
  readonly blocked = computed(() => this.busy() || this.disabled());
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);
  readonly deleted = signal(false);
  readonly deleting = signal(false);

  constructor() {
    effect(() => {
      this.session.token();
      untracked(() => {
        this.request?.unsubscribe();
        this.clearSelection();
        this.error.set(null);
        this.saved.set(false);
        this.deleted.set(false);
      });
    });
    this.destroyRef.onDestroy(() => this.releasePreview());
  }

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.blocked() || !this.session.token()) return;
    this.error.set(null);
    this.saved.set(false);
    this.deleted.set(false);
    this.clearSelection();
    if (!/\.(png|jpe?g)$/i.test(file.name) || (file.type && !['image/jpeg', 'image/png'].includes(file.type))) {
      this.error.set('Выберите изображение в формате JPG или PNG.'); return;
    }
    if (!file.size) { this.error.set('Файл пуст. Выберите другое изображение.'); return; }
    if (file.size > 2 * 1024 * 1024) { this.error.set('Размер изображения должен быть не больше 2 МБ.'); return; }
    this.previewUrl = URL.createObjectURL(file);
    this.file.set(file);
    this.previewChange.emit(this.previewUrl);
  }

  cancel(): void {
    if (this.blocked()) return;
    this.clearSelection();
    this.error.set(null);
  }

  rejectPreview(): void {
    if (!this.file() || this.busy()) return;
    this.clearSelection();
    this.error.set('Не удалось открыть изображение. Выберите другой JPG или PNG.');
  }

  save(): void {
    const file = this.file();
    const token = this.session.token();
    if (!file || !token || this.blocked()) return;
    this.busy.set(true);
    this.error.set(null);
    this.request = this.avatars.uploadAvatar(file).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => {
        if (token !== this.session.token()) return;
        this.clearSelection();
        this.saved.set(true);
      },
      error: (error: {status?: number}) => {
        if (token !== this.session.token()) return;
        this.error.set(error.status === 413 ? 'Размер изображения должен быть не больше 2 МБ.'
          : error.status === 400 || error.status === 415 ? 'Сервер отклонил изображение. Выберите другой JPG или PNG.'
          : error.status === 0 ? 'Нет соединения с сервером. Попробуйте ещё раз.'
          : 'Не удалось сохранить фото. Попробуйте ещё раз.');
      },
    });
  }

  remove(): void {
    const token = this.session.token();
    if (!token || !this.hasAvatar() || this.file() || this.blocked()) return;
    this.busy.set(true);
    this.deleting.set(true);
    this.error.set(null);
    this.saved.set(false);
    this.deleted.set(false);
    this.request = this.avatars.deleteAvatar().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.busy.set(false); this.deleting.set(false); }),
    ).subscribe({
      next: () => {
        if (token !== this.session.token()) return;
        this.clearSelection();
        this.deleted.set(true);
      },
      error: () => {
        if (token !== this.session.token()) return;
        this.error.set('Не удалось удалить фото. Попробуйте ещё раз.');
      },
    });
  }

  private clearSelection(): void {
    this.file.set(null);
    this.previewChange.emit(null);
    this.releasePreview();
  }
  private releasePreview(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }
}
