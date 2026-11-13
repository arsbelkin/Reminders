import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiConfiguration } from '../api/api-configuration';
import { UsersService } from '../api/services/users.service';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class UserAvatarService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfiguration);
  private readonly session = inject(TokenStorageService);
  private readonly changed = signal(0);
  readonly revision = this.changed.asReadonly();

  getAvatar() {
    // The generated method currently discards the binary response as void.
    const root = this.config.rootUrl.replace(/\/+$/, '');
    return this.http.get(root + UsersService.ApiV1UsersAvatarGetPath, {
      responseType: 'blob',
      params: this.revision() ? { v: this.revision() } : undefined,
    });
  }

  uploadAvatar(file: File) {
    const token = this.session.token();
    const body = new FormData();
    body.append('file', file, file.name);
    // The generated upload currently uses urlencoded data instead of multipart/form-data.
    const root = this.config.rootUrl.replace(/\/+$/, '');
    return this.http.put<void>(root + UsersService.ApiV1UsersAvatarPutPath, body).pipe(
      tap(() => {
        if (token === this.session.token()) this.changed.update((value) => value + 1);
      }),
    );
  }

  deleteAvatar() {
    const token = this.session.token();
    const root = this.config.rootUrl.replace(/\/+$/, '');
    return this.http.delete<void>(root + UsersService.ApiV1UsersAvatarGetPath).pipe(
      tap(() => {
        if (token === this.session.token()) this.changed.update((value) => value + 1);
      }),
    );
  }
}
