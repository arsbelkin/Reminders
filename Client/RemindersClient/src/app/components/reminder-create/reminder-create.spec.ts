import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReminderCreate } from './reminder-create';

describe('ReminderCreate', () => {
  let component: ReminderCreate;
  let fixture: ComponentFixture<ReminderCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(ReminderCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
