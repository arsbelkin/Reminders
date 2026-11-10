import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReminderCard } from './reminder-card';

describe('ReminderCard', () => {
  let component: ReminderCard;
  let fixture: ComponentFixture<ReminderCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderCard],
    }).compileComponents();

    fixture = TestBed.createComponent(ReminderCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
