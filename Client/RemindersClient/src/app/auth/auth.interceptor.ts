import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiConfiguration } from '../api/api-configuration';
import { TokenStorageService } from './token-storage.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokenStorage = inject(TokenStorageService);
  const config = inject(ApiConfiguration);
  const router = inject(Router);

  const apiRoot = config.rootUrl.replace(/\/+$/, '');
  const isApiRequest = request.url.startsWith(`${apiRoot}/`);
  if (!isApiRequest) {
    return next(request);
  }

  const token = tokenStorage.getToken();
  const apiRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  const requestPath = request.url.slice(apiRoot.length).split(/[?#]/)[0].replace(/\/+$/, '');
  const isPublicAuthRequest = /^\/api\/v1\/auth\/(login|register)$/i.test(requestPath);

  return next(apiRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isPublicAuthRequest &&
        // A late response from an old session must not clear a newly saved token.
        tokenStorage.getToken() === token
      ) {
        tokenStorage.clearToken();

        if (router.url.split(/[?#]/)[0] !== '/login') {
          void router.navigate(['/login'], { replaceUrl: true });
        }
      }

      return throwError(() => error);
    }),
  );
};
