import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { NotificationsService } from '../../api/services';
import { TokenStorageService } from '../../auth/token-storage.service';
import { NotificationActions } from './notification-actions';

describe('NotificationActions', () => {
  let fixture: ComponentFixture<NotificationActions>;
  let component: NotificationActions;
  let response: Subject<void>;
  let token = signal<string | null>('token');
  const api = {apiV1NotificationsNotificationIdPatch: vi.fn(), apiV1NotificationsNotificationIdDelete: vi.fn()};
  const data = {id: 'first', reminderTitle: 'Отчёт', notificationTime: '2026-11-18T10:00:24.123Z', recurrency: 7};
  const root = () => fixture.nativeElement as HTMLElement;
  const dialog = () => root().querySelector<HTMLDialogElement>('dialog')!;

  beforeEach(async () => {
    token = signal('token'); response = new Subject<void>();
    api.apiV1NotificationsNotificationIdPatch.mockReset().mockReturnValue(response);
    api.apiV1NotificationsNotificationIdDelete.mockReset().mockReturnValue(response);
    TestBed.configureTestingModule({providers: [
      {provide: NotificationsService, useValue: api}, {provide: TokenStorageService, useValue: {token}},
    ]});
    fixture = TestBed.createComponent(NotificationActions); component = fixture.componentInstance;
    fixture.componentRef.setInput('notification', data); fixture.componentRef.setInput('notificationId', 'first');
    await fixture.whenStable();
    dialog().showModal = vi.fn(() => dialog().setAttribute('open', ''));
    dialog().close = vi.fn(() => dialog().removeAttribute('open'));
  });

  it('prefills local time and preserves the original timestamp when only recurrence changes', () => {
    component.open('edit');
    const local = new Date(component.form.controls.notificationTime.value);
    expect(local.getHours()).toBe(new Date(data.notificationTime).getHours());
    component.form.controls.recurrency.setValue(1); component.submit(); component.submit();
    expect(api.apiV1NotificationsNotificationIdPatch).toHaveBeenCalledExactlyOnceWith({notificationId: 'first', body: {notificationTime: data.notificationTime, recurrency: 1}});
    const saved = vi.fn(); component.saved.subscribe(saved); response.next(); response.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith('first'); expect(dialog().open).toBe(false);
  });

  it('converts an edited local datetime to UTC', () => {
    component.open('edit'); component.form.controls.notificationTime.setValue('2026-12-01T18:30'); component.submit();
    expect(api.apiV1NotificationsNotificationIdPatch.mock.calls[0][0].body.notificationTime).toBe(new Date('2026-12-01T18:30').toISOString());
  });

  it.each([['notificationTime', ''], ['notificationTime', 'invalid'], ['recurrency', 999]] as const)('validates %s before sending', (field, value) => {
    component.open('edit'); component.form.patchValue({[field]: value}); component.submit();
    expect(component.form.invalid).toBe(true); expect(api.apiV1NotificationsNotificationIdPatch).not.toHaveBeenCalled();
  });

  it('permits cancellation without requests and restores the original values', () => {
    component.open('edit'); component.form.controls.recurrency.setValue(31); component.close();
    expect(api.apiV1NotificationsNotificationIdPatch).not.toHaveBeenCalled();
    component.open('edit'); expect(component.form.controls.recurrency.value).toBe(7);
  });

  it('confirms deletion independently of invalid edit fields and blocks closing while pending', () => {
    component.open('delete'); component.form.controls.notificationTime.setValue(''); component.submit(); component.submit();
    component.close(); const event = new Event('cancel', {cancelable: true}); component.onCancel(event);
    expect(event.defaultPrevented).toBe(true); expect(dialog().open).toBe(true);
    expect(api.apiV1NotificationsNotificationIdDelete).toHaveBeenCalledExactlyOnceWith({notificationId: 'first'});
    expect(api.apiV1NotificationsNotificationIdPatch).not.toHaveBeenCalled();
    const deleted = vi.fn(); component.deleted.subscribe(deleted); response.next(); response.complete();
    expect(deleted).toHaveBeenCalledExactlyOnceWith('first'); expect(dialog().open).toBe(false);
  });

  it.each(['edit', 'delete'] as const)('keeps the %s dialog open on error and enables retry', mode => {
    component.open(mode); component.submit(); response.error({status: 500}); fixture.detectChanges();
    expect(component.error()).toContain('Попробуйте ещё раз'); expect(component.busy()).toBe(false); expect(dialog().open).toBe(true);
    api.apiV1NotificationsNotificationIdPatch.mockReturnValue(of(undefined));
    api.apiV1NotificationsNotificationIdDelete.mockReturnValue(of(undefined));
    component.submit(); expect(dialog().open).toBe(false);
  });

  it('closes an obsolete dialog when the route changes and blocks stale submission', () => {
    component.open('delete'); fixture.componentRef.setInput('notificationId', 'second');
    fixture.componentRef.setInput('notification', {...data, id: 'second'}); fixture.detectChanges(); TestBed.tick();
    expect(dialog().open).toBe(false); component.submit(); expect(api.apiV1NotificationsNotificationIdDelete).not.toHaveBeenCalled();
  });

  it('keeps an in-flight operation tied to its original ID', () => {
    component.open('edit'); component.submit();
    const saved = vi.fn(); component.saved.subscribe(saved);
    fixture.componentRef.setInput('notificationId', 'second'); fixture.componentRef.setInput('notification', {...data, id: 'second'});
    fixture.detectChanges(); TestBed.tick(); response.next(); response.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith('first');
  });

  it('ignores late responses after the account changes', () => {
    component.open('edit'); component.submit(); const saved = vi.fn(); component.saved.subscribe(saved);
    token.set('another-session'); fixture.detectChanges(); TestBed.tick(); response.next(); response.complete();
    expect(saved).not.toHaveBeenCalled(); expect(dialog().open).toBe(false);
  });

  it('hides operations without a session', () => {
    token.set(null); fixture.detectChanges(); component.open('edit'); component.open('delete');
    expect(root().querySelector('.category-actions')).toBeNull(); expect(dialog().open).toBe(false);
  });
});
