import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { NotificationsService } from '../../api/services';
import { IdResponseDto } from '../../api/models/id-response-dto';
import { TokenStorageService } from '../../auth/token-storage.service';
import { NotificationCreate } from './notification-create';

describe('NotificationCreate', () => {
  let fixture: ComponentFixture<NotificationCreate>;
  let component: NotificationCreate;
  let response: Subject<IdResponseDto>;
  let token = signal<string | null>('token');
  const api = {apiV1NotificationsPost$Json: vi.fn()};
  const data = {id: 'first', creatorId: 'another-owner', title: 'Отчёт', dueDate: '2026-12-18T10:00:24.123Z'};
  const root = () => fixture.nativeElement as HTMLElement;
  const dialog = () => root().querySelector<HTMLDialogElement>('dialog')!;

  beforeEach(async () => {
    token = signal('token'); response = new Subject<IdResponseDto>();
    api.apiV1NotificationsPost$Json.mockReset().mockReturnValue(response);
    TestBed.configureTestingModule({providers: [
      {provide: NotificationsService, useValue: api}, {provide: TokenStorageService, useValue: {token}},
    ]});
    fixture = TestBed.createComponent(NotificationCreate); component = fixture.componentInstance;
    fixture.componentRef.setInput('reminder', data); fixture.componentRef.setInput('reminderId', 'first');
    await fixture.whenStable();
    dialog().showModal = vi.fn(() => dialog().setAttribute('open', ''));
    dialog().close = vi.fn(() => dialog().removeAttribute('open'));
  });

  it('allows a participant to create a personal notification, prefilled with the reminder date', () => {
    root().querySelector<HTMLButtonElement>('.create-notification')!.click();
    const local = new Date(component.form.controls.notificationTime.value);
    expect(local.getHours()).toBe(new Date(data.dueDate).getHours());
    expect(component.form.controls.recurrency.value).toBe(0);
    component.submit(); component.submit();
    expect(api.apiV1NotificationsPost$Json).toHaveBeenCalledExactlyOnceWith({body: {
      reminderId: 'first', notificationTime: data.dueDate, recurrency: 0,
    }});
    const created = vi.fn(); component.created.subscribe(created);
    response.next({id: 'new'}); response.complete();
    expect(created).toHaveBeenCalledExactlyOnceWith({reminderId: 'first', id: 'new'});
    expect(dialog().open).toBe(false);
  });

  it('converts an edited local datetime to UTC and sends the chosen recurrence', () => {
    component.open(); component.form.setValue({notificationTime: '2026-12-01T18:30', recurrency: 7}); component.submit();
    expect(api.apiV1NotificationsPost$Json).toHaveBeenCalledWith({body: {
      reminderId: 'first', notificationTime: new Date('2026-12-01T18:30').toISOString(), recurrency: 7,
    }});
  });

  it.each([['notificationTime', ''], ['notificationTime', 'invalid'], ['recurrency', 999]] as const)('validates %s before sending', (field, value) => {
    component.open(); component.form.patchValue({[field]: value}); component.submit();
    expect(component.form.invalid).toBe(true); expect(api.apiV1NotificationsPost$Json).not.toHaveBeenCalled();
  });

  it('requires a date when the reminder has no date', () => {
    fixture.componentRef.setInput('reminder', {...data, dueDate: null}); fixture.detectChanges();
    component.open(); expect(component.form.controls.notificationTime.value).toBe(''); component.submit();
    expect(api.apiV1NotificationsPost$Json).not.toHaveBeenCalled();
  });

  it('resets an unsaved draft and permits cancellation without a request', () => {
    component.open(); component.form.controls.recurrency.setValue(31); component.close();
    component.open(); expect(component.form.controls.recurrency.value).toBe(0);
    expect(api.apiV1NotificationsPost$Json).not.toHaveBeenCalled();
  });

  it('blocks cancel and Escape while pending', () => {
    component.open(); component.submit(); component.close();
    const cancel = new Event('cancel', {cancelable: true}); component.onCancel(cancel);
    expect(cancel.defaultPrevented).toBe(true); expect(dialog().open).toBe(true);
  });

  it.each([0, 403, 404, 500])('keeps the draft after error %s and enables retry', status => {
    component.open(); component.form.controls.recurrency.setValue(7); component.submit(); response.error({status});
    expect(component.busy()).toBe(false); expect(component.error()).toBeTruthy(); expect(dialog().open).toBe(true);
    expect(component.form.controls.recurrency.value).toBe(7);
    api.apiV1NotificationsPost$Json.mockReturnValue(of({id: 'new'})); component.submit();
    expect(dialog().open).toBe(false);
  });

  it('closes an obsolete dialog and blocks submission for another route', () => {
    component.open(); fixture.componentRef.setInput('reminderId', 'second'); fixture.detectChanges(); TestBed.tick();
    expect(dialog().open).toBe(false); component.submit(); expect(api.apiV1NotificationsPost$Json).not.toHaveBeenCalled();
  });

  it('keeps a late response bound to its original reminder', () => {
    component.open(); component.submit(); const created = vi.fn(); component.created.subscribe(created);
    fixture.componentRef.setInput('reminderId', 'second'); fixture.detectChanges(); TestBed.tick();
    response.next({id: 'new'}); response.complete();
    expect(created).toHaveBeenCalledExactlyOnceWith({reminderId: 'first', id: 'new'});
  });

  it('ignores late responses after an account change', () => {
    component.open(); component.submit(); const created = vi.fn(); component.created.subscribe(created);
    token.set('another-session'); fixture.detectChanges(); TestBed.tick(); response.next({id: 'new'}); response.complete();
    expect(created).not.toHaveBeenCalled(); expect(dialog().open).toBe(false);
  });

  it('blocks creation without a session or while another operation is pending', () => {
    fixture.componentRef.setInput('disabled', true); fixture.detectChanges(); component.open();
    expect(dialog().open).toBe(false);
    fixture.componentRef.setInput('disabled', false); token.set(null); fixture.detectChanges(); component.open();
    expect(root().querySelector('.create-notification')).toBeNull(); expect(dialog().open).toBe(false);
  });
});
