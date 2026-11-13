import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { RemindersService } from '../../api/services';
import { CategoryListViewDto } from '../../api/models/category-list-view-dto';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';
import { MembersEditor } from '../members-editor/members-editor';

@Component({
  selector: 'app-reminder-create',
  imports: [ReactiveFormsModule, MembersEditor],
  templateUrl: './reminder-create.html',
  styleUrls: ['./reminder-create.css', './reminder-create-fields.css'],
})
export class ReminderCreate {
  private readonly remindersApi = inject(RemindersService);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('reminderDialog');

  readonly categories = input<CategoryListViewDto[]>([]);
  readonly created = output<void>();

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

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
    categoryId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', {
      nonNullable: true,
    }),
    priority: new FormControl(0, {
      nonNullable: true,
    }),
    dueDate: new FormControl('', {
      nonNullable: true,
    }),
  });

  open(): void {
    if (this.isSaving()) {
      return;
    }

    this.form.reset();
    this.errorMessage.set(null);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    if (this.isSaving()) {
      return;
    }

    this.dialog().nativeElement.close();
  }

  onCancel(event: Event): void {
    if (this.isSaving()) {
      event.preventDefault();
    }
  }

  save(): void {
    if (this.isSaving()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const values = this.form.getRawValue();
    const dueDate = values.dueDate ? new Date(values.dueDate) : null;

    if (dueDate && Number.isNaN(dueDate.getTime())) {
      this.form.controls.dueDate.setErrors({ invalidDate: true });
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.remindersApi
      .apiV1RemindersPost$Json({
        body: {
          title: values.title.trim(),
          categoryId: values.categoryId,
          description: values.description.trim() || null,
          priority: values.priority,
          dueDate: dueDate?.toISOString() ?? null,
          usersEmails: values.usersEmails,
        },
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.dialog().nativeElement.close();
          this.created.emit();
        },
        error: (error: { status?: number }) => {
          this.errorMessage.set(
            error.status === 422
              ? 'Проверьте email участников.'
              : error.status === 400 || error.status === 404
                ? 'Категория или её участники изменились. Проверьте выбранную категорию и список участников.'
                : 'Не удалось создать напоминание. Попробуйте ещё раз.',
          );
        },
      });
  }
}
