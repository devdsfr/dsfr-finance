import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Opposite of authGuard: keeps logged-in users from seeing the public
// landing page — they get sent straight to the app instead.
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) {
    inject(Router).navigate(['/dashboard']);
    return false;
  }
  return true;
};
