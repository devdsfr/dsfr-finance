import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="login-brand">
          <svg width="48" height="48" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#2e7736"/>
            <polyline points="5,22 11,14 17,18 27,8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="27" cy="8" r="2.5" fill="#7dd87f"/>
          </svg>
          <span class="login-brand__name"><strong>DSFR</strong> finance</span>
        </div>

        @if (!token) {
          <h2>Link inválido</h2>
          <p class="msg">O link de redefinição está incompleto ou inválido. Solicite um novo na tela de login.</p>
          <a routerLink="/auth/login" class="btn btn--primary btn--link">Voltar ao login</a>
        } @else if (done()) {
          <div class="sent-box">
            <div class="sent-icon">✅</div>
            <h2>Senha redefinida!</h2>
            <p class="msg">Sua senha foi alterada com sucesso. Agora você já pode entrar com a nova senha.</p>
            <a routerLink="/auth/login" class="btn btn--primary btn--link">Ir para o login</a>
          </div>
        } @else {
          <h2>Criar nova senha</h2>
          <form (ngSubmit)="submit()" class="form">
            <div class="form-group">
              <label>Nova senha</label>
              <input [(ngModel)]="password" name="password" type="password" required minlength="8" class="input"
                     placeholder="Mínimo 8 caracteres" />
            </div>
            <div class="form-group">
              <label>Confirmar nova senha</label>
              <input [(ngModel)]="confirm" name="confirm" type="password" required class="input" />
            </div>
            @if (error()) { <div class="error">{{ error() }}</div> }
            <button type="submit" class="btn btn--primary" [disabled]="loading()">
              {{ loading() ? 'Salvando...' : 'Redefinir senha' }}
            </button>
            <a routerLink="/auth/login" class="link-btn">← Voltar ao login</a>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; gap: 1rem; }
    .auth-card { background: #fff; border-radius: .75rem; padding: 2rem; width: 100%; max-width: 380px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .login-brand { display: flex; align-items: center; justify-content: center; gap: .6rem; margin-bottom: 1.25rem; }
    .login-brand__name { font-size: 1.4rem; color: #1a3d22; }
    .login-brand__name strong { font-weight: 700; letter-spacing: .03em; }
    h2 { font-size: 1.15rem; text-align: center; color: #1a2035; margin: 0 0 1rem; font-weight: 600; }
    .msg { font-size: .88rem; color: #6b7280; text-align: center; line-height: 1.6; margin: 0 0 1.25rem; }
    .form { display: flex; flex-direction: column; gap: .875rem; }
    .form-group { display: flex; flex-direction: column; gap: .25rem; }
    label { font-size: .82rem; color: #374151; font-weight: 500; }
    .input { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .9rem; }
    .btn { padding: .6rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--link { display: block; text-align: center; text-decoration: none; }
    .link-btn { display: block; text-align: center; color: #6366f1; font-size: .82rem; text-decoration: none; padding: .2rem; }
    .link-btn:hover { text-decoration: underline; }
    .error { color: #ef4444; font-size: .85rem; }
    .sent-box { text-align: center; display: flex; flex-direction: column; gap: 1rem; align-items: center; }
    .sent-icon { font-size: 2.5rem; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = '';
  password = ''; confirm = '';
  loading = signal(false);
  error = signal('');
  done = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  submit(): void {
    if (this.password.length < 8) { this.error.set('A senha deve ter no mínimo 8 caracteres.'); return; }
    if (this.password !== this.confirm) { this.error.set('As senhas não coincidem.'); return; }
    this.loading.set(true); this.error.set('');
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => { this.done.set(true); this.loading.set(false); },
      error: err => { this.error.set(err.error?.error ?? 'Não foi possível redefinir a senha.'); this.loading.set(false); }
    });
  }
}
