import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { Lang } from '../../../core/i18n/translations';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  template: `
    <div class="auth-page">
      <div class="lang-bar">
        @for (l of i18n.langs; track l.value) {
          <button [class.active]="i18n.lang() === l.value" (click)="setLang(l.value)">{{ l.flag }}</button>
        }
      </div>
      <div class="auth-card">
        <div class="login-brand">
          <svg width="48" height="48" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#2e7736"/>
            <polyline points="5,22 11,14 17,18 27,8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="27" cy="8" r="2.5" fill="#7dd87f"/>
          </svg>
          <span class="login-brand__name"><strong>DSFR</strong> finance</span>
        </div>
        <h2>{{ 'auth.register_title' | translate }}</h2>

        <form (ngSubmit)="register()" class="form" novalidate>
          <div class="form-group">
            <label>{{ 'auth.name' | translate }}</label>
            <input [(ngModel)]="name" name="name" class="input"
                   [class.input--error]="tried() && nameError()" (blur)="nameTouched.set(true)" />
            @if ((tried() || nameTouched()) && nameError()) { <span class="field-error">{{ nameError() }}</span> }
          </div>
          <div class="form-group">
            <label>{{ 'auth.email' | translate }}</label>
            <input [(ngModel)]="email" name="email" type="email" autocomplete="email" class="input"
                   [class.input--error]="tried() && emailError()" (blur)="emailTouched.set(true)" />
            @if ((tried() || emailTouched()) && emailError()) { <span class="field-error">{{ emailError() }}</span> }
          </div>
          <div class="form-group">
            <label>{{ 'auth.password_hint' | translate }}</label>
            <div class="pass-wrap">
              <input [(ngModel)]="password" name="password" [type]="showPass() ? 'text' : 'password'"
                     autocomplete="new-password" class="input input--pass"
                     [class.input--error]="tried() && passError()" (blur)="passTouched.set(true)" />
              <button type="button" class="pass-eye" (click)="showPass.set(!showPass())"
                      [attr.aria-label]="showPass() ? 'Ocultar senha' : 'Mostrar senha'">
                @if (showPass()) {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <!-- Medidor de força -->
            @if (password) {
              <div class="pw-meter">
                <div class="pw-bar"><div class="pw-fill" [style.width.%]="pwStrength().pct" [style.background]="pwStrength().color"></div></div>
                <span class="pw-label" [style.color]="pwStrength().color">{{ pwStrength().label }}</span>
              </div>
            }
            @if ((tried() || passTouched()) && passError()) { <span class="field-error">{{ passError() }}</span> }
          </div>
          @if (error()) { <div class="error">{{ error() }}</div> }
          @if (coldStart() && loading()) {
            <div class="cold-start">⏳ Acordando o servidor… isso pode levar alguns segundos na primeira vez.</div>
          }
          <button type="submit" class="btn btn--primary" [disabled]="loading()">
            @if (loading()) { <span class="spin"></span> {{ 'auth.registering' | translate }} }
            @else { {{ 'auth.register_button' | translate }} }
          </button>
        </form>
        <a routerLink="/auth/login" class="auth-link">{{ 'auth.have_account' | translate }}</a>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(1200px 600px at 50% -10%, #eef7f0 0%, #f4f6fb 55%); gap: 1rem; padding: 1.5rem; }
    .lang-bar { display: flex; gap: .4rem; }
    .lang-bar button { background: #fff; border: 2px solid transparent; border-radius: .5rem; padding: .3rem .55rem; font-size: 1.05rem; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.08); transition: border-color .15s; }
    .lang-bar button.active { border-color: #2e7736; }
    .auth-card { background: #fff; border-radius: 1rem; padding: 2.25rem 2rem; width: 100%; max-width: 388px;
                 box-shadow: 0 12px 40px rgba(26,61,34,.10), 0 2px 8px rgba(0,0,0,.04); }
    .login-brand { display: flex; align-items: center; justify-content: center; gap: .6rem; margin-bottom: 1.35rem; }
    .login-brand__name { font-size: 1.4rem; color: #1a3d22; }
    .login-brand__name strong { font-weight: 700; letter-spacing: .03em; }
    h2 { font-size: 1.05rem; text-align: center; color: #6b7280; margin: 0 0 1.5rem; font-weight: 400; }
    .form { display: flex; flex-direction: column; gap: .9rem; }
    .form-group { display: flex; flex-direction: column; gap: .3rem; }
    .form-group label { font-size: .8rem; font-weight: 600; color: #374151; }
    .input { padding: .6rem .8rem; border: 1.5px solid #dfe3ea; border-radius: .55rem; font-size: .92rem; color: #1a2035;
      background: #fff; transition: border-color .15s, box-shadow .15s; box-sizing: border-box; width: 100%; }
    .input:focus { outline: none; border-color: #2e7736; box-shadow: 0 0 0 3px rgba(46,119,54,.12); }
    .input--error { border-color: #dc2626; }
    .input--error:focus { box-shadow: 0 0 0 3px rgba(220,38,38,.12); }
    .field-error { font-size: .74rem; color: #dc2626; }
    .pass-wrap { position: relative; }
    .input--pass { padding-right: 2.5rem; }
    .pass-eye { position: absolute; right: .5rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9ca3af; padding: .25rem; display: flex; align-items: center; }
    .pass-eye:hover { color: #4b5563; }
    .pw-meter { display: flex; align-items: center; gap: .5rem; margin-top: .15rem; }
    .pw-bar { flex: 1; height: 5px; background: #eef1f5; border-radius: 9999px; overflow: hidden; }
    .pw-fill { height: 100%; border-radius: 9999px; transition: width .25s, background .25s; }
    .pw-label { font-size: .7rem; font-weight: 600; min-width: 52px; text-align: right; }
    .btn { display: flex; align-items: center; justify-content: center; gap: .5rem; padding: .68rem; border-radius: .55rem; border: none; cursor: pointer; font-size: .92rem; font-weight: 600; transition: background .15s, opacity .15s; }
    .btn--primary { background: #2e7736; color: #fff; box-shadow: 0 2px 8px rgba(46,119,54,.25); }
    .btn--primary:hover:not(:disabled) { background: #276a2e; }
    .btn--primary:disabled { opacity: .7; cursor: not-allowed; }
    .error { color: #b91c1c; font-size: .82rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: .5rem; padding: .5rem .65rem; }
    .cold-start { font-size: .78rem; color: #92700d; background: #fffbeb; border: 1px solid #fde68a; border-radius: .5rem; padding: .5rem .65rem; line-height: 1.45; }
    .spin { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-link { display: block; text-align: center; margin-top: 1.15rem; font-size: .85rem; color: #2e7736; text-decoration: none; font-weight: 500; }
    .auth-link:hover { text-decoration: underline; }
  
    /* ══ DARK THEME (auto) ══ */
    :host-context([data-theme="dark"]) .lang-bar button { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .auth-card { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .form-group label { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .input { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .pass-eye { color: #8393ad !important; }
  `]
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  i18n = inject(TranslationService);

  name = ''; email = ''; password = '';
  loading = signal(false); error = signal('');
  showPass = signal(false);
  tried = signal(false);
  nameTouched = signal(false);
  emailTouched = signal(false);
  passTouched = signal(false);
  coldStart = signal(false);
  private coldTimer: any = null;

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  nameError(): string {
    const v = this.name.trim();
    if (!v) return 'Informe seu nome.';
    if (v.length < 2) return 'Nome muito curto.';
    return '';
  }
  emailError(): string {
    const v = this.email.trim();
    if (!v) return 'Informe seu e-mail.';
    if (!this.EMAIL_RE.test(v)) return 'E-mail inválido.';
    return '';
  }
  passError(): string {
    if (!this.password) return 'Crie uma senha.';
    if (this.password.length < 8) return 'A senha precisa de pelo menos 8 caracteres.';
    return '';
  }

  /** Medidor simples de força da senha. */
  pwStrength(): { pct: number; label: string; color: string } {
    const p = this.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { pct: 30, label: 'Fraca', color: '#dc2626' };
    if (score <= 3) return { pct: 65, label: 'Média', color: '#f59e0b' };
    return { pct: 100, label: 'Forte', color: '#16a34a' };
  }

  setLang(lang: Lang): void { this.i18n.setLang(lang); }

  register(): void {
    this.tried.set(true);
    this.error.set('');
    if (this.nameError() || this.emailError() || this.passError()) return;

    this.loading.set(true);
    this.coldStart.set(false);
    clearTimeout(this.coldTimer);
    this.coldTimer = setTimeout(() => { if (this.loading()) this.coldStart.set(true); }, 4000);

    this.auth.register(this.name.trim(), this.email.trim(), this.password).subscribe({
      next: () => this.router.navigate(['/transactions']),
      error: err => {
        this.loading.set(false); this.coldStart.set(false); clearTimeout(this.coldTimer);
        this.error.set(this.friendlyError(err));
      }
    });
  }

  private friendlyError(err: any): string {
    if (err?.status === 0) return 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
    if (err?.status === 409) return 'Este e-mail já está cadastrado. Tente fazer login.';
    if (err?.status >= 500) return 'O servidor está com problemas no momento. Tente novamente em instantes.';
    return err?.error?.error ?? this.i18n.t('auth.register_error_default');
  }
}
