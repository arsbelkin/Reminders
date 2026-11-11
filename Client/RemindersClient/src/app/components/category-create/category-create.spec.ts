import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryCreate } from './category-create';
import { CategoriesService } from '../../api/services';

describe('CategoryCreate', () => {
  let component: CategoryCreate;
  let fixture: ComponentFixture<CategoryCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCreate],
      providers: [{ provide: CategoriesService, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([false, true])('prevents native Escape dismissal only while saving (saving=%s)', (saving) => {
    component.isSaving.set(saving);
    fixture.detectChanges();
    const cancel = new Event('cancel', { cancelable: true });
    fixture.nativeElement.querySelector('dialog').dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(saving);
  });
});
