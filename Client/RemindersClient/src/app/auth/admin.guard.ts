import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from './token-storage.service';

export const adminGuard: CanActivateFn = () => {
  const session = inject(TokenStorageService);
  const router = inject(Router);
  if (!session.getToken()) return router.createUrlTree(['/login']);
  return session.isAdmin() || router.createUrlTree(['/reminders']);
};
