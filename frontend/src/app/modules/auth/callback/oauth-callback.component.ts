import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Landing route for OAuth redirects. The backend sends the browser here with a
 * signed JWT in the query string; we store the session and go to the dashboard.
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <div class="card">
        <svg class="spin" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2e7736" stroke-width="2.5" stroke-linecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <p>Entrando…</p>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
    .card { display: flex; flex-direction: column; align-items: center; gap: .75rem; }
    .card p { color: #6b7280; font-size: .9rem; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class OAuthCallbackComponent implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.router.navigate(['/auth/login'], { queryParams: { oauth_error: 'Falha ao autenticar.' } });
      return;
    }
    this.auth.setSessionFromToken(token).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => this.router.navigate(['/auth/login'], { queryParams: { oauth_error: 'Não foi possível carregar seu perfil.' } }),
    });
  }
}
