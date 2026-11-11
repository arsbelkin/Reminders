import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CategoryListViewDto } from '../../api/models/category-list-view-dto';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';

export interface ReminderFiltersValue {
  categoryIds: string[];
  priorityTypes: number[];
  completedStatus: number | null;
}

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-reminder-filters',
  styleUrl: './reminder-filters.css',
  templateUrl: './reminder-filters.html',
})
export class ReminderFilters {
  readonly categories = input<CategoryListViewDto[]>([]);

  readonly filtersApplied = output<ReminderFiltersValue>();

  readonly priorityOptions = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
    value: Number(value),
    label,
  }));

  readonly form = new FormGroup({
    categoryIds: new FormControl<string[]>([], {
      nonNullable: true,
    }),
    priorityTypes: new FormControl<number[]>([], {
      nonNullable: true,
    }),
    completedStatus: new FormControl<number | null>(0),
  });

  readonly selectedCategories = toSignal(this.form.controls.categoryIds.valueChanges, {
    initialValue: this.form.controls.categoryIds.value,
  });
  readonly selectedPriorities = toSignal(this.form.controls.priorityTypes.valueChanges, {
    initialValue: this.form.controls.priorityTypes.value,
  });

  toggleCategory(id: string, checked: boolean): void {
    this.updateSelection(this.form.controls.categoryIds, id, checked);
  }

  togglePriority(value: number, checked: boolean): void {
    this.updateSelection(this.form.controls.priorityTypes, value, checked);
  }

  private updateSelection<T>(control: FormControl<T[]>, value: T, checked: boolean): void {
    const selection = new Set(control.value);
    checked ? selection.add(value) : selection.delete(value);
    control.setValue([...selection]);
    control.markAsDirty();
  }

  setValues(values: ReminderFiltersValue): void {
    this.form.reset({
      categoryIds: [...values.categoryIds],
      priorityTypes: [...values.priorityTypes],
      completedStatus: values.completedStatus,
    });
  }

  apply(): void {
    this.filtersApplied.emit(this.form.getRawValue());
    this.close();
  }

  reset(): void {
    this.form.reset({
      categoryIds: [],
      priorityTypes: [],
      completedStatus: 0,
    });
  }

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('filtersDialog');

  open(values: ReminderFiltersValue): void {
    this.setValues(values);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }
}
