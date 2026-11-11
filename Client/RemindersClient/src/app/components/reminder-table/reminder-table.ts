import { Component, input } from '@angular/core';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';

@Component({
  selector: 'app-reminder-table',
  templateUrl: './reminder-table.html',
  styleUrl: './reminder-table.css',
})
export class ReminderTable {
  readonly reminders = input.required<ReminderListViewDto[]>();
  readonly priorityLabels = PRIORITY_LABELS;
}
