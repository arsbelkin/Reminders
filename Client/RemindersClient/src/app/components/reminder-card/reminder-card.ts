import { Component, input } from '@angular/core';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';

@Component({
  imports: [],
  selector: 'app-reminder-card',
  styleUrl: './reminder-card.css',
  templateUrl: './reminder-card.html',
})
export class ReminderCard {
  readonly reminder = input.required<ReminderListViewDto>();

  readonly priorityLabels: Record<number, string> = {
    0: 'Без приоритета',
    1: 'Низкий',
    2: 'Средний',
    3: 'Высокий',
    4: 'Критический',
  };
}