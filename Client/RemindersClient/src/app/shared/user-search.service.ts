import { Injectable, inject } from '@angular/core';
import { from, mergeMap, of, switchMap, toArray } from 'rxjs';
import { UsersService } from '../api/services';
import { UserInfoDto } from '../api/models/user-info-dto';

@Injectable({ providedIn: 'root' })
export class UserSearchService {
  private readonly api = inject(UsersService);

  constructor() {
    // Generated methods concatenate the root and path without trimming a trailing slash.
    if (this.api.rootUrl) this.api.rootUrl = this.api.rootUrl.replace(/\/+$/, '');
  }

  find(field: 'username' | 'email', text: string) {
    const value = text.trim();
    if (!value) return of<UserInfoDto[]>([]);
    return this.api
      .apiV1UsersGet$Json(field === 'email' ? { Email: value } : { Username: value })
      .pipe(
        switchMap((result) =>
          from([...new Set(result.ids ?? [])]).pipe(
            mergeMap((id) => this.api.apiV1UsersIdGet$Json({ id }), 4),
            toArray(),
          ),
        ),
      );
  }
}
