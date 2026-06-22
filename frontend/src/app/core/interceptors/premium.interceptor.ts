import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

// Catches the backend's 403 "premium_required" responses (export, debt
// strategy, AI subscriptions) and shows a friendly upsell toast instead of a
// generic error, regardless of which component made the call.
export const premiumInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError(err => {
      // Export endpoints use responseType: 'blob', so the error body comes
      // back as a Blob instead of parsed JSON — fall back to status-only check.
      const isPremiumBlocked = err?.status === 403 &&
        (err?.error?.code === 'premium_required' || err?.error instanceof Blob);
      if (isPremiumBlocked) {
        toast.show('Esse recurso é exclusivo do plano Premium. Veja o Controle de Acesso.', 'warning');
      }
      return throwError(() => err);
    })
  );
};
