import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { RemindersService } from '../../api/services';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { ReminderCard } from '../../components/reminder-card/reminder-card';

@Component({
  imports: [ReminderCard],
  selector: 'app-reminders',
  styleUrl: './reminders.css',
  templateUrl: './reminders.html',
})
export class Reminders implements OnInit {
  private readonly remindersApi = inject(RemindersService);

  readonly reminders = signal<ReminderListViewDto[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadReminders();
  }

  loadReminders(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.remindersApi
      .apiV1RemindersGet$Json()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (reminders) => {
          this.reminders.set(reminders);
        },
        error: (error) => {
          this.errorMessage.set(
            error.status === 401
              ? 'Войдите снова, чтобы загрузить напоминания.'
              : 'Не удалось загрузить напоминания.',
          );
        },
      });
  }
}