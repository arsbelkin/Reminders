import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { UserAvatarService } from '../../auth/user-avatar.service';
import { TokenStorageService } from '../../auth/token-storage.service';
import { AvatarEditor } from './avatar-editor';

describe('AvatarEditor', () => {
  let fixture: ComponentFixture<AvatarEditor>;
  let component: AvatarEditor;
  let token = signal<string | null>('token');
  let response: Subject<void>;
  const api = {uploadAvatar: vi.fn(), deleteAvatar: vi.fn()};
  const createUrl = vi.fn();
  const revokeUrl = vi.fn();
  const preview = vi.fn();
  const image = () => new File(['picture'], 'avatar.PNG', {type: 'image/png'});
  const select = (file: File | null) => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    Object.defineProperty(input, 'files', {configurable: true, value: file ? [file] : []});
    input.dispatchEvent(new Event('change')); fixture.detectChanges();
  };
  beforeEach(async () => {
    token = signal('token'); response = new Subject();
    api.uploadAvatar.mockReset().mockReturnValue(response);
    api.deleteAvatar.mockReset().mockReturnValue(response);
    preview.mockReset(); revokeUrl.mockReset(); createUrl.mockReset().mockReturnValue('blob:preview');
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = createUrl;
      static override revokeObjectURL = revokeUrl;
    });
    TestBed.configureTestingModule({providers: [
      {provide: UserAvatarService, useValue: api}, {provide: TokenStorageService, useValue: {token}},
    ]});
    fixture = TestBed.createComponent(AvatarEditor); component = fixture.componentInstance;
    component.previewChange.subscribe(preview); await fixture.whenStable(); preview.mockClear();
  });
  afterEach(() => { fixture.destroy(); vi.unstubAllGlobals(); });

  it('previews a selected image, sends it once, blocks changes and confirms success', () => {
    const file = image(); select(file);
    expect(preview).toHaveBeenLastCalledWith('blob:preview'); expect(api.uploadAvatar).not.toHaveBeenCalled();
    component.save(); component.save(); component.cancel(); select(new File(['new'], 'new.jpg', {type: 'image/jpeg'}));
    expect(api.uploadAvatar).toHaveBeenCalledExactlyOnceWith(file); expect(component.file()).toBe(file);
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.save-avatar').disabled).toBe(true);
    response.next(); response.complete(); fixture.detectChanges();
    expect(component.file()).toBeNull(); expect(component.busy()).toBe(false);
    expect(preview).toHaveBeenLastCalledWith(null); expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:preview');
    expect(fixture.nativeElement.textContent).toContain('Фото профиля обновлено');
  });

  it.each([
    new File(['x'], 'avatar.svg', {type: 'image/svg+xml'}),
    new File(['x'], 'avatar.png', {type: 'text/plain'}),
    new File([], 'avatar.png', {type: 'image/png'}),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'avatar.jpg', {type: 'image/jpeg'}),
  ])('rejects an invalid image before any upload ($name)', file => {
    select(file); component.save();
    expect(component.error()).toBeTruthy(); expect(component.file()).toBeNull();
    expect(createUrl).not.toHaveBeenCalled(); expect(api.uploadAvatar).not.toHaveBeenCalled();
  });

  it('accepts the exact server size limit and releases a preview on cancellation', () => {
    select(new File([new Uint8Array(2 * 1024 * 1024)], 'avatar.jpeg', {type: 'image/jpeg'}));
    expect(component.error()).toBeNull(); expect(component.file()).not.toBeNull();
    component.cancel(); expect(component.file()).toBeNull(); expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(api.uploadAvatar).not.toHaveBeenCalled();
  });

  it('keeps the current selection when the file picker is cancelled and releases replaced previews', () => {
    const file = image(); select(file); select(null); expect(component.file()).toBe(file);
    createUrl.mockReturnValue('blob:replacement'); select(image());
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
    fixture.destroy(); expect(revokeUrl).toHaveBeenCalledWith('blob:replacement');
  });

  it('rejects a preview that cannot be decoded', () => {
    select(image()); component.rejectPreview();
    expect(component.file()).toBeNull(); expect(component.error()).toContain('открыть изображение');
    expect(preview).toHaveBeenLastCalledWith(null);
  });

  it.each([0, 400, 413, 415, 500])('keeps the draft and permits retry on HTTP %s', status => {
    const file = image(); select(file); component.save(); response.error({status});
    expect(component.error()).toBeTruthy(); expect(component.file()).toBe(file); expect(component.busy()).toBe(false);
    api.uploadAvatar.mockReturnValue(new Subject<void>()); component.save();
    expect(api.uploadAvatar).toHaveBeenCalledTimes(2);
  });

  it('cancels an upload and discards the preview if the account changes', () => {
    select(image()); component.save(); token.set('new-account'); fixture.detectChanges(); TestBed.tick();
    expect(response.observed).toBe(false); expect(component.file()).toBeNull(); expect(component.busy()).toBe(false);
    response.next(); expect(component.saved()).toBe(false); expect(preview).toHaveBeenLastCalledWith(null);
  });

  it('cancels an upload on destruction and prevents selecting for a guest', () => {
    token.set(null); fixture.detectChanges(); select(image()); expect(component.file()).toBeNull();
    token.set('token'); fixture.detectChanges(); select(image()); component.save(); fixture.destroy();
    expect(response.observed).toBe(false); expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
  });

  it('shows deletion only for a saved avatar and blocks repeat requests while deleting', () => {
    expect(fixture.nativeElement.querySelector('.delete-avatar')).toBeNull();
    component.remove(); expect(api.deleteAvatar).not.toHaveBeenCalled();
    fixture.componentRef.setInput('hasAvatar', true); fixture.detectChanges();
    fixture.nativeElement.querySelector('.delete-avatar').click(); component.remove(); select(image());
    expect(api.deleteAvatar).toHaveBeenCalledTimes(1); expect(component.file()).toBeNull();
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.delete-avatar').disabled).toBe(true);
    response.next(); response.complete(); fixture.detectChanges();
    expect(component.busy()).toBe(false); expect(component.deleting()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Фото удалено');
  });

  it('keeps the delete action available after an error and permits retry', () => {
    fixture.componentRef.setInput('hasAvatar', true); fixture.detectChanges();
    component.remove(); response.error({status: 500}); fixture.detectChanges();
    expect(component.error()).toContain('Не удалось удалить'); expect(component.deleted()).toBe(false);
    api.deleteAvatar.mockReturnValue(new Subject<void>()); component.remove();
    expect(api.deleteAvatar).toHaveBeenCalledTimes(2);
  });

  it('cancels deletion on account changes and ignores the obsolete result', () => {
    fixture.componentRef.setInput('hasAvatar', true); fixture.detectChanges(); component.remove();
    token.set('other-account'); fixture.detectChanges(); TestBed.tick();
    expect(response.observed).toBe(false); expect(component.deleting()).toBe(false);
    response.next(); expect(component.deleted()).toBe(false);
  });

  it('does not delete a saved avatar while a new photo is being previewed', () => {
    fixture.componentRef.setInput('hasAvatar', true); fixture.detectChanges(); select(image());
    component.remove(); expect(api.deleteAvatar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.delete-avatar')).toBeNull();
  });
});
