import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Anexa o token e trata sessão expirada.
 *
 * Sem o tratamento de 401, um token vencido deixava o app em um estado
 * enganoso: as telas continuavam abrindo (o guard só olha se existe token
 * no storage), mas toda chamada à API era recusada — e o usuário via
 * zero em tudo, como se os dados tivessem sumido.
 *
 * Agora um 401 encerra a sessão e leva ao login, deixando claro o que houve.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 nas rotas de autenticação é credencial errada, não sessão expirada.
      const isAuthRoute = req.url.includes('/auth/');

      if (err.status === 401 && !isAuthRoute && auth.isLoggedIn()) {
        auth.logout('expired');
      }
      return throwError(() => err);
    })
  );
};
