import { Component, input } from '@angular/core';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { PRIORITY_LABELS } from '../../shared/reminder-labels';

@Component({
  imports: [],
  selector: 'app-reminder-card',
  styleUrl: './reminder-card.css',
  templateUrl: './reminder-card.html',
})
export class ReminderCard {
  readonly reminder = input.required<ReminderListViewDto>();

  readonly priorityLabels = PRIORITY_LABELS;
}
