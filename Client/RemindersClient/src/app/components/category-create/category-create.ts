import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CategoriesService } from '../../api/services';
import { MembersEditor } from '../members-editor/members-editor';

@Component({
  selector: 'app-category-create',
  imports: [ReactiveFormsModule, MembersEditor],
  templateUrl: './category-create.html',
  styleUrl: './category-create.css',
})
export class CategoryCreate {
  private readonly categoriesApi = inject(CategoriesService);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('categoryDialog');

  readonly created = output<void>();

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    usersEmails: new FormControl<string[]>([], {nonNullable: true}),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    description: new FormControl('', {
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

    const { title, description, usersEmails } = this.form.getRawValue();

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.categoriesApi
      .apiV1CategoriesPost$Json({
        body: {
          title: title.trim(),
          description: description.trim() || null,
          usersEmails,
        },
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.dialog().nativeElement.close();
          this.created.emit();
        },
        error: (error: {status?: number}) => {
          this.errorMessage.set(error.status === 422
            ? 'Проверьте email участников: все пользователи должны быть зарегистрированы.'
            : 'Не удалось создать категорию. Попробуйте ещё раз.');
        },
      });
  }
}
