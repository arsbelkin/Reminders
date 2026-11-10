import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { ApiConfiguration } from '../api/api-configuration';
import { TokenStorageService } from './token-storage.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokenStorage = inject(TokenStorageService);
  const config = inject(ApiConfiguration);

  const apiRoot = config.rootUrl.replace(/\/+$/, '');
  const isApiRequest = request.url.startsWith(`${apiRoot}/`);
  const token = tokenStorage.getToken();

  if (!isApiRequest || !token) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  }));
};