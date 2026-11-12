import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CategoriesService } from '../../api/services';
import { CategoryInfoViewDto } from '../../api/models/category-info-view-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { MembersEditor } from '../members-editor/members-editor';

@Component({
  selector: 'app-category-actions',
  imports: [ReactiveFormsModule, MembersEditor],
  templateUrl: './category-actions.html',
  styleUrl: './category-actions.css',
})
export class CategoryActions {
  private readonly api = inject(CategoriesService);
  private readonly session = inject(TokenStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('actionDialog');
  readonly category = input<CategoryInfoViewDto | null>(null);
  readonly categoryId = input.required<string>();
  readonly saved = output<string>();
  readonly deleted = output<string>();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<'edit' | 'delete'>('edit');
  readonly target = signal<{
    id: string;
    title: string;
    ownerId: string;
  } | null>(null);
  readonly canManage = computed(() => {
    const userId = this.session.userId();
    return !!userId && this.category()?.creatorId?.trim().toLowerCase() === userId;
  });
  readonly form = new FormGroup({
    usersEmails: new FormControl<string[]>([], {nonNullable: true}),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    description: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const target = this.target();
      if (
        target &&
        (target.id !== this.categoryId() ||
          target.ownerId !== this.session.userId() ||
          !this.canManage())
      ) {
        this.dialog().nativeElement.close();
        this.target.set(null);
        this.error.set(null);
      }
    });
  }

  open(mode: 'edit' | 'delete'): void {
    const category = this.category();
    const ownerId = this.session.userId();
    if (!category || !ownerId || !this.canManage() || this.busy()) return;
    this.mode.set(mode);
    this.target.set({
      id: this.categoryId(),
      title: category.title || 'Без названия',
      ownerId,
    });
    this.form.reset({ title: category.title ?? '', description: category.description ?? '', usersEmails: [...(category.usersEmails ?? [])] });
    this.error.set(null);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.target.set(null);
    this.error.set(null);
  }

  onCancel(event: Event): void {
    if (this.busy()) event.preventDefault();
    else {
      this.target.set(null);
      this.error.set(null);
    }
  }

  submit(): void {
    const target = this.target();
    if (
      !target ||
      this.busy() ||
      !this.canManage() ||
      target.id !== this.categoryId() ||
      target.ownerId !== this.session.userId()
    )
      return;
    const deleting = this.mode() === 'delete';
    this.form.markAllAsTouched();
    if (!deleting && this.form.invalid) return;
    const { title, description, usersEmails } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    const request = deleting
      ? this.api.apiV1CategoriesCategoryIdDelete({ categoryId: target.id })
      : this.api.apiV1CategoriesCategoryIdPatch({
          categoryId: target.id,
          body: {
            title: title.trim(),
            description: description.trim() || null,
            usersEmails,
          },
        });
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          if (target.ownerId !== this.session.userId()) return;
          if (this.target() === target) {
            this.dialog().nativeElement.close();
            this.target.set(null);
          }
          if (deleting) this.deleted.emit(target.id);
          else this.saved.emit(target.id);
        },
        error: (error: { status?: number }) => {
          if (this.target() !== target) return;
          const action = deleting ? 'удалить' : 'сохранить';
          this.error.set(
            error.status === 403 || error.status === 404
              ? 'Категория удалена или у вас нет прав на её изменение.'
              : error.status === 422
                ? 'Проверьте email участников: все пользователи должны быть зарегистрированы.'
                : `Не удалось ${action} категорию. Попробуйте ещё раз.`,
          );
        },
      });
  }
}
