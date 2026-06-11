import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>💰 dsfr-finance</h1>
        <h2>Criar conta</h2>
        <form (ngSubmit)="register()" class="form">
          <div class="form-group">
            <label>Nome</label>
            <input [(ngModel)]="name" name="name" required class="input" />
          </div>
          <div class="form-group">
            <label>E-mail</label>
            <input [(ngModel)]="email" name="email" type="email" required class="input" />
          </div>
          <div class="form-group">
            <label>Senha (mín. 8 caracteres)</label>
            <input [(ngModel)]="password" name="password" type="password" minlength="8" required class="input" />
          </div>
          @if (error()) { <div class="error">{{ error() }}</div> }
          <button type="submit" class="btn btn--primary" [disabled]="loading()">
            {{ loading() ? 'Cadastrando...' : 'Criar conta' }}
          </button>
        </form>
        <a routerLink="/auth/login" class="auth-link">Já tem conta? Entre</a>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
    .auth-card { background: #fff; border-radius: .75rem; padding: 2rem; width: 100%; max-width: 380px;
                 box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    h1 { font-size: 1.5rem; text-align: center; margin: 0 0 .25rem; }
    h2 { font-size: 1.1rem; text-align: center; color: #6b7280; margin: 0 0 1.5rem; font-weight: 400; }
    .form { display: flex; flex-direction: column; gap: .875rem; }
    .form-group { display: flex; flex-direction: column; gap: .25rem; }
    .input { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .9rem; }
    .btn { padding: .6rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .9rem; background: #6366f1; color: #fff; }
    .error { color: #ef4444; font-size: .85rem; }
    .auth-link { display: block; text-align: center; margin-top: 1rem; font-size: .85rem; color: #6366f1; text-decoration: none; }
  `]
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  name = ''; email = ''; password = '';
  loading = signal(false); error = signal('');

  register(): void {
    this.loading.set(true); this.error.set('');
    this.auth.register(this.name, this.email, this.password).subscribe({
      next: () => this.router.navigate(['/transactions']),
      error: err => { this.error.set(err.error?.error ?? 'Erro ao cadastrar'); this.loading.set(false); }
    });
  }
}
