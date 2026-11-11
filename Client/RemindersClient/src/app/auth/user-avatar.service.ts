import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfiguration } from '../api/api-configuration';
import { UsersService } from '../api/services/users.service';

@Injectable({ providedIn: 'root' })
export class UserAvatarService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfiguration);

  getAvatar() {
    // The generated method currently discards the binary response as void.
    const root = this.config.rootUrl.replace(/\/+$/, '');
    return this.http.get(root + UsersService.ApiV1UsersAvatarGetPath, {
      responseType: 'blob',
    });
  }
}
