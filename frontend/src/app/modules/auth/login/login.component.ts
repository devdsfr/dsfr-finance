import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { TranslationService } from '../../../core/services/translation.service';
import { Lang } from '../../../core/i18n/translations';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
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
        <h2>{{ 'auth.login_title' | translate }}</h2>

        @if (mode() === 'login' && !needsMFA()) {
          <!-- Login social -->
          <div class="social">
            <a class="social-btn" [href]="oauthUrl('google')">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 15.6 2 8.4 6.8 6.3 14.7z"/><path fill="#4CAF50" d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.7 36.4 27 37.5 24 37.5c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C8.3 41.1 15.6 46 24 46z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C41.9 36.3 46 31 46 24c0-1.5-.2-2.6-.4-3.5z"/></svg>
              Entrar com conta Google
            </a>
            <a class="social-btn" [href]="oauthUrl('facebook')">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/></svg>
              Entrar com conta Facebook
            </a>
          </div>
          <div class="divider"><span>ou</span></div>
        }

        @if (mode() === 'forgot') {
          <!-- Esqueci minha senha -->
          @if (!forgotSent()) {
            <form (ngSubmit)="forgot()" class="form">
              <p class="hint-text">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
              <div class="form-group">
                <label>{{ 'auth.email' | translate }}</label>
                <input [(ngModel)]="email" name="femail" type="email" required class="input" />
              </div>
              @if (error()) { <div class="error">{{ error() }}</div> }
              <button type="submit" class="btn btn--primary" [disabled]="loading()">
                {{ loading() ? 'Enviando...' : 'Enviar link de redefinição' }}
              </button>
              <button type="button" class="btn btn--ghost" (click)="mode.set('login'); error.set('')">← Voltar ao login</button>
            </form>
          } @else {
            <div class="sent-box">
              <div class="sent-icon">✉️</div>
              <p>Se <strong>{{ email }}</strong> estiver cadastrado, um link de redefinição foi enviado. Verifique sua caixa de entrada e o spam.</p>
              <button type="button" class="btn btn--ghost" (click)="mode.set('login'); forgotSent.set(false)">← Voltar ao login</button>
            </div>
          }
        } @else if (!needsMFA()) {
          <form (ngSubmit)="login()" class="form" novalidate>
            <div class="form-group">
              <label>{{ 'auth.email' | translate }}</label>
              <input [(ngModel)]="email" name="email" type="email" autocomplete="email"
                     class="input" [class.input--error]="triedSubmit() && emailError()"
                     (blur)="emailTouched.set(true)" />
              @if ((triedSubmit() || emailTouched()) && emailError()) {
                <span class="field-error">{{ emailError() }}</span>
              }
            </div>
            <div class="form-group">
              <label>{{ 'auth.password' | translate }}</label>
              <div class="pass-wrap">
                <input [(ngModel)]="password" name="password" [type]="showPass() ? 'text' : 'password'"
                       autocomplete="current-password"
                       class="input input--pass" [class.input--error]="triedSubmit() && passError()"
                       (blur)="passTouched.set(true)" />
                <button type="button" class="pass-eye" (click)="showPass.set(!showPass())"
                        [attr.aria-label]="showPass() ? 'Ocultar senha' : 'Mostrar senha'"
                        [title]="showPass() ? 'Ocultar senha' : 'Mostrar senha'">
                  @if (showPass()) {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              @if ((triedSubmit() || passTouched()) && passError()) {
                <span class="field-error">{{ passError() }}</span>
              }
            </div>
            @if (error()) { <div class="error">{{ error() }}</div> }
            @if (coldStart() && loading()) {
              <div class="cold-start">⏳ Acordando o servidor… isso pode levar alguns segundos na primeira vez.</div>
            }
            <button type="submit" class="btn btn--primary" [disabled]="loading()">
              @if (loading()) { <span class="spin"></span> {{ 'auth.logging_in' | translate }} }
              @else { {{ 'auth.login_button' | translate }} }
            </button>
            <button type="button" class="link-btn" (click)="mode.set('forgot'); error.set('')">Esqueci minha senha</button>
          </form>
        } @else {
          <!-- AC-MC-10: MFA step -->
          <form (ngSubmit)="loginMFA()" class="form">
            <p>{{ 'auth.mfa_instructions' | translate }}</p>
            <div class="form-group">
              <label>{{ 'auth.mfa_code' | translate }}</label>
              <input [(ngModel)]="totpCode" name="totp" maxlength="6" required class="input input--center" />
            </div>
            @if (error()) { <div class="error">{{ error() }}</div> }
            <button type="submit" class="btn btn--primary">{{ 'auth.verify' | translate }}</button>
            <button type="button" class="btn btn--ghost" (click)="needsMFA.set(false)">{{ 'common.back' | translate }}</button>
          </form>
        }
        <a routerLink="/auth/register" class="auth-link">{{ 'auth.no_account' | translate }}</a>
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
    h1 { font-size: 1.5rem; text-align: center; margin: 0 0 .25rem; }
    h2 { font-size: 1.05rem; text-align: center; color: #6b7280; margin: 0 0 1.5rem; font-weight: 400; }
    .form { display: flex; flex-direction: column; gap: .9rem; }
    .form-group { display: flex; flex-direction: column; gap: .3rem; }
    .form-group label { font-size: .8rem; font-weight: 600; color: #374151; }
    .input { padding: .6rem .8rem; border: 1.5px solid #dfe3ea; border-radius: .55rem; font-size: .92rem; color: #1a2035;
      background: #fff; transition: border-color .15s, box-shadow .15s; box-sizing: border-box; width: 100%; }
    .input::placeholder { color: #9ca3af; }
    .input:focus { outline: none; border-color: #2e7736; box-shadow: 0 0 0 3px rgba(46,119,54,.12); }
    .input--error { border-color: #dc2626; }
    .input--error:focus { box-shadow: 0 0 0 3px rgba(220,38,38,.12); }
    .input--center { text-align: center; font-size: 1.25rem; letter-spacing: .3em; }
    .field-error { font-size: .74rem; color: #dc2626; }
    .btn { display: flex; align-items: center; justify-content: center; gap: .5rem; padding: .68rem; border-radius: .55rem; border: none; cursor: pointer; font-size: .92rem; font-weight: 600; transition: background .15s, opacity .15s; }
    .btn--primary { background: #2e7736; color: #fff; box-shadow: 0 2px 8px rgba(46,119,54,.25); }
    .btn--primary:hover:not(:disabled) { background: #276a2e; }
    .btn--primary:disabled { opacity: .7; cursor: not-allowed; }
    .btn--ghost { background: none; color: #6b7280; text-align: center; box-shadow: none; }
    .btn--ghost:hover { color: #374151; }
    .error { color: #b91c1c; font-size: .82rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: .5rem; padding: .5rem .65rem; }
    .cold-start { font-size: .78rem; color: #92700d; background: #fffbeb; border: 1px solid #fde68a; border-radius: .5rem; padding: .5rem .65rem; line-height: 1.45; }
    .spin { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-link { display: block; text-align: center; margin-top: 1.15rem; font-size: .85rem; color: #2e7736; text-decoration: none; font-weight: 500; }
    .auth-link:hover { text-decoration: underline; }
    .link-btn { background: none; border: none; color: #2e7736; font-size: .82rem; cursor: pointer; text-align: center; padding: .2rem; font-weight: 500; }
    .link-btn:hover { text-decoration: underline; }
    .hint-text { font-size: .85rem; color: #6b7280; margin: 0 0 .25rem; line-height: 1.5; }
    .sent-box { text-align: center; display: flex; flex-direction: column; gap: 1rem; align-items: center; }
    .sent-icon { font-size: 2.5rem; }
    .sent-box p { font-size: .88rem; color: #4b5563; line-height: 1.6; margin: 0; }

    /* Social login */
    .social { display: flex; flex-direction: column; gap: .6rem; margin-bottom: 1rem; }
    .social-btn {
      display: flex; align-items: center; justify-content: center; gap: .6rem;
      padding: .65rem; border: 1px solid #d1d5db; border-radius: .5rem;
      background: #fff; color: #374151; font-size: .88rem; font-weight: 600;
      text-decoration: none; cursor: pointer; transition: background .15s, border-color .15s;
    }
    .social-btn:hover { background: #f9fafb; border-color: #9ca3af; }
    .divider { display: flex; align-items: center; gap: .75rem; margin: 1rem 0; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
    .divider span { font-size: .8rem; color: #9ca3af; }

    /* Password eye */
    .pass-wrap { position: relative; }
    .input--pass { width: 100%; padding-right: 2.5rem; box-sizing: border-box; }
    .pass-eye {
      position: absolute; right: .5rem; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #9ca3af;
      padding: .25rem; display: flex; align-items: center;
    }
    .pass-eye:hover { color: #4b5563; }
  `]
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  i18n = inject(TranslationService);

  email = ''; password = ''; totpCode = '';
  loading = signal(false);
  error = signal('');
  needsMFA = signal(false);
  mode = signal<'login' | 'forgot'>('login');
  forgotSent = signal(false);
  showPass = signal(false);

  // ── Validação de formulário ──────────────────────────────────────────────
  triedSubmit  = signal(false);
  emailTouched = signal(false);
  passTouched  = signal(false);
  coldStart    = signal(false);
  private coldTimer: any = null;

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Mensagem de erro do e-mail (vazio = válido). */
  emailError(): string {
    const v = this.email.trim();
    if (!v) return 'Informe seu e-mail.';
    if (!this.EMAIL_RE.test(v)) return 'E-mail inválido.';
    return '';
  }
  passError(): string {
    if (!this.password) return 'Informe sua senha.';
    return '';
  }
  private formValid(): boolean { return !this.emailError() && !this.passError(); }

  /** URL do backend que inicia o fluxo OAuth do provedor. */
  oauthUrl(provider: 'google' | 'facebook'): string {
    return `${environment.apiUrl}/auth/oauth/${provider}/login`;
  }

  ngOnInit(): void {
    // Acorda o backend (Render free tier) enquanto o usuário digita as credenciais,
    // para o dashboard não esperar o cold start depois do login.
    this.api.warmUp();

    // Erro devolvido pelo callback OAuth (ex.: provedor não configurado).
    const oauthErr = this.route.snapshot.queryParamMap.get('oauth_error');
    if (oauthErr) this.error.set(oauthErr);
  }

  setLang(lang: Lang): void { this.i18n.setLang(lang); }

  login(): void {
    this.triedSubmit.set(true);
    this.error.set('');
    if (!this.formValid()) return; // erros por campo já são exibidos

    this.startLoading();
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: res => {
        this.stopLoading();
        if (res.mfa_required) { this.needsMFA.set(true); return; }
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.stopLoading();
        this.error.set(this.friendlyError(err));
      }
    });
  }

  /** Inicia o loading e agenda o aviso de cold start (Render) após 4s. */
  private startLoading(): void {
    this.loading.set(true);
    this.coldStart.set(false);
    clearTimeout(this.coldTimer);
    this.coldTimer = setTimeout(() => { if (this.loading()) this.coldStart.set(true); }, 4000);
  }
  private stopLoading(): void {
    this.loading.set(false);
    this.coldStart.set(false);
    clearTimeout(this.coldTimer);
  }

  /** Traduz erros técnicos em mensagens claras para o usuário. */
  private friendlyError(err: any): string {
    if (err?.status === 0) return 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
    if (err?.status === 401 || err?.status === 400) return 'E-mail ou senha incorretos.';
    if (err?.status === 429) return 'Muitas tentativas. Aguarde um momento e tente novamente.';
    if (err?.status >= 500) return 'O servidor está com problemas no momento. Tente novamente em instantes.';
    return err?.error?.error ?? this.i18n.t('auth.login_error_default');
  }

  loginMFA(): void {
    this.auth.login(this.email, this.password, this.totpCode).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: err => this.error.set(err.error?.error ?? this.i18n.t('auth.mfa_error_default'))
    });
  }

  forgot(): void {
    this.error.set('');
    const emailErr = this.emailError();
    if (emailErr) { this.error.set(emailErr); return; }
    this.loading.set(true);
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => { this.forgotSent.set(true); this.loading.set(false); },
      error: err => { this.error.set(this.friendlyError(err)); this.loading.set(false); }
    });
  }
}
