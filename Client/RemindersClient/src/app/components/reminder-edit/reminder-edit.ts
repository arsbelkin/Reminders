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
import { CategoriesService, RemindersService } from '../../api/services';
import { ReminderInfoViewDto } from '../../api/models/reminder-info-view-dto';
import { CategoryListViewDto } from '../../api/models/category-list-view-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';
import { MembersEditor } from '../members-editor/members-editor';

@Component({
  selector: 'app-reminder-edit',
  imports: [ReactiveFormsModule, MembersEditor],
  templateUrl: './reminder-edit.html',
  styleUrls: [
    '../reminder-create/reminder-create.css',
    '../reminder-create/reminder-create-fields.css',
  ],
})
export class ReminderEdit {
  private readonly api = inject(RemindersService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly session = inject(TokenStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('reminderDialog');
  readonly reminder = input<ReminderInfoViewDto | null>(null);
  readonly reminderId = input.required<string>();
  readonly disabled = input(false);
  readonly saved = output<string>();
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly categories = signal<CategoryListViewDto[]>([]);
  readonly categoriesLoading = signal(false);
  readonly categoriesError = signal(false);
  private readonly target = signal<{
    id: string;
    ownerId: string;
    reminder: ReminderInfoViewDto;
    localDate: string;
  } | null>(null);
  readonly canEdit = computed(() => {
    const ownerId = this.session.userId();
    return !!ownerId && this.reminder()?.creatorId?.trim().toLowerCase() === ownerId;
  });
  readonly priorityOptions = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
    value: Number(value),
    label,
  }));
  readonly form = new FormGroup({
    usersEmails: new FormControl<string[]>([], { nonNullable: true }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    categoryId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    priority: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(4)],
    }),
    dueDate: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const target = this.target();
      if (
        target &&
        (target.id !== this.reminderId() ||
          target.ownerId !== this.session.userId() ||
          !this.canEdit())
      ) {
        this.dialog().nativeElement.close();
        this.target.set(null);
        this.errorMessage.set(null);
      }
    });
  }

  open(): void {
    const reminder = this.reminder();
    const ownerId = this.session.userId();
    if (!reminder || !ownerId || !this.canEdit() || this.isSaving() || this.disabled()) return;
    const localDate = this.toLocalDate(reminder.dueDate);
    this.target.set({
      id: this.reminderId(),
      ownerId,
      reminder: { ...reminder, memberEmails: [...(reminder.memberEmails ?? [])] },
      localDate,
    });
    this.form.reset({
      title: reminder.title ?? '',
      categoryId: reminder.categoryId ?? '',
      description: reminder.description ?? '',
      priority: reminder.priority ?? 0,
      dueDate: localDate,
      usersEmails: [...(reminder.memberEmails ?? [])],
    });
    this.categories.set([]);
    this.errorMessage.set(null);
    this.dialog().nativeElement.showModal();
    this.loadCategories();
  }

  loadCategories(): void {
    const target = this.target();
    if (!target) return;
    this.categoriesLoading.set(true);
    this.categoriesError.set(false);
    this.categoriesApi
      .apiV1CategoriesGet$Json()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          if (this.target() !== target) return;
          const current = target.reminder;
          this.categories.set(
            current.categoryId && !categories.some((item) => item.id === current.categoryId)
              ? [
                  { id: current.categoryId, title: current.categoryName || 'Текущая категория' },
                  ...categories,
                ]
              : categories,
          );
          this.categoriesLoading.set(false);
        },
        error: () => {
          if (this.target() !== target) return;
          this.categoriesError.set(true);
          this.categoriesLoading.set(false);
        },
      });
  }

  close(): void {
    if (this.isSaving()) return;
    this.dialog().nativeElement.close();
    this.target.set(null);
  }

  onCancel(event: Event): void {
    if (this.isSaving()) event.preventDefault();
    else this.target.set(null);
  }

  save(): void {
    const target = this.target();
    if (
      !target ||
      this.isSaving() ||
      this.disabled() ||
      !this.canEdit() ||
      this.categoriesLoading() ||
      this.categoriesError() ||
      target.id !== this.reminderId() ||
      target.ownerId !== this.session.userId()
    )
      return;
    this.form.markAllAsTouched();
    const values = this.form.getRawValue();
    if (!this.categories().some((item) => item.id === values.categoryId))
      this.form.controls.categoryId.setErrors({ invalidCategory: true });
    const date = values.dueDate ? new Date(values.dueDate) : null;
    if (date && Number.isNaN(date.getTime()))
      this.form.controls.dueDate.setErrors({ invalidDate: true });
    if (this.form.invalid) return;
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.api
      .apiV1RemindersReminderIdPatch({
        reminderId: target.id,
        body: {
          title: values.title.trim(),
          description: values.description.trim() || null,
          categoryId: values.categoryId,
          priority: values.priority,
          dueDate:
            values.dueDate === target.localDate
              ? (target.reminder.dueDate ?? null)
              : (date?.toISOString() ?? null),
          usersEmails: values.usersEmails,
        },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: () => {
          if (target.ownerId !== this.session.userId()) return;
          if (this.target() === target) {
            this.dialog().nativeElement.close();
            this.target.set(null);
          }
          this.saved.emit(target.id);
        },
        error: (error: { status?: number }) => {
          if (this.target() !== target) return;
          this.errorMessage.set(
            error.status === 403
              ? 'Напоминание удалено или у вас нет прав на его изменение.'
              : error.status === 400 || error.status === 404
                ? 'Проверьте данные и доступ к напоминанию. Все участники должны входить в выбранную категорию.'
                : error.status === 422
                  ? 'Проверьте email участников.'
                  : 'Не удалось сохранить напоминание. Попробуйте ещё раз.',
          );
        },
      });
  }

  private toLocalDate(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
