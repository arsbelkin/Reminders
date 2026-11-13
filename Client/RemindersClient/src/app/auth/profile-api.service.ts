import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfiguration } from '../api/api-configuration';
import { UserInfoDto } from '../api/models/user-info-dto';
import { map } from 'rxjs';
import { UserSearchService } from '../shared/user-search.service';
import { TokenStorageService } from './token-storage.service';

export type ProfileField = 'username' | 'email';
export interface ProfileUpdate {
  username: string;
  email: string;
}
export interface ProfileAvailability {
  usernameAvailable?: boolean | null;
  emailAvailable?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfiguration);
  private readonly search = inject(UserSearchService);
  private readonly session = inject(TokenStorageService);

  // Availability uses the existing generated search; only profile saving needs a separate call.
  checkAvailability(field: ProfileField, value: string) {
    const userId = this.session.userId();
    return this.search.find(field, value).pipe(
      map((users) => {
        // Search returns substring matches. Only exact matches owned by another user are taken.
        const available = !users.some(
          (user) => user.id?.toLowerCase() !== userId && user[field] === value.trim(),
        );
        return field === 'username'
          ? { usernameAvailable: available }
          : { emailAvailable: available };
      }),
    );
  }

  updateProfile(body: ProfileUpdate) {
    return this.http.put<UserInfoDto>(this.url + '/me', body);
  }

  private get url() {
    return this.config.rootUrl.replace(/\/+$/, '') + '/api/v1/Users';
  }
}
