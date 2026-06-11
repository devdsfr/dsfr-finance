import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mfa_enabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<AuthUser | null>(null);

  constructor(private api: ApiService, private router: Router) {
    const stored = localStorage.getItem('user');
    if (stored) this.currentUser.set(JSON.parse(stored));
  }

  login(email: string, password: string, totpCode?: string): Observable<any> {
    return this.api.post<any>('/auth/login', { email, password, totp_code: totpCode }).pipe(
      tap(res => {
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        }
      })
    );
  }

  register(name: string, email: string, password: string): Observable<any> {
    return this.api.post<any>('/auth/register', { name, email, password }).pipe(
      tap(res => {
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  enableMFA(): Observable<{ provisioning_url: string }> {
    return this.api.post<any>('/auth/mfa/enable', {});
  }

  confirmMFA(code: string): Observable<any> {
    return this.api.post('/auth/mfa/confirm', { code });
  }

  disableMFA(): Observable<any> {
    return this.api.delete('/auth/mfa');
  }
}
