import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { catchError, of } from 'rxjs';

/**
 * Landing do link mágico enviado pelo WhatsApp (/wa/:token).
 *
 * O token amarra o telefone à conta. Se a pessoa não estiver logada,
 * guardamos o token e mandamos para o login/cadastro; ao voltar
 * autenticada, fechamos o vínculo.
 */
@Component({
  selector: 'app-wa-connect',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="wa">
  <div class="wa__card">
    <div class="wa__logo">💬</div>

    @if (state() === 'loading') {
      <h1>Conectando…</h1>
      <p>Só um instante.</p>
    }

    @if (state() === 'need-auth') {
      <h1>Falta entrar na sua conta</h1>
      <p>
        Para o agente reconhecer seu WhatsApp, entre na sua conta DSFR Finance
        ou crie uma agora. Depois disso o vínculo é automático.
      </p>
      <div class="wa__actions">
        <button class="btn btn--primary" (click)="goLogin()">Entrar</button>
        <button class="btn btn--outline" (click)="goRegister()">Criar conta</button>
      </div>
    }

    @if (state() === 'done') {
      <h1>Tudo certo! ✅</h1>
      <p>
        Seu WhatsApp <strong>{{ phone() }}</strong> está conectado.
        Volte para a conversa e mande <strong>ajuda</strong> para começar.
      </p>
      <div class="wa__actions">
        <button class="btn btn--primary" (click)="goDashboard()">Ir para o app</button>
      </div>
    }

    @if (state() === 'error') {
      <h1>Link expirado</h1>
      <p>
        Esse link já foi usado ou passou dos 30 minutos. Volte ao WhatsApp e
        mande qualquer mensagem para o agente — ele envia um novo.
      </p>
      <div class="wa__actions">
        <button class="btn btn--outline" (click)="goDashboard()">Ir para o app</button>
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    .wa { min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 1.5rem; background: #f6f7f9; }
    .wa__card { background: #fff; border-radius: .9rem; box-shadow: 0 8px 32px rgba(0,0,0,.1);
      padding: 2.5rem 2rem; max-width: 420px; width: 100%; text-align: center; }
    .wa__logo { font-size: 2.5rem; margin-bottom: .75rem; }
    h1 { font-size: 1.25rem; color: #111; margin: 0 0 .6rem; }
    p { font-size: .9rem; color: #6b7280; line-height: 1.55; margin: 0; }
    .wa__actions { display: flex; gap: .6rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }
    .btn { border-radius: .4rem; padding: .6rem 1.4rem; font-size: .875rem; font-weight: 600; cursor: pointer; }
    .btn--primary { background: #2e7736; color: #fff; border: none; }
    .btn--outline { background: none; border: 1px solid #d1d5db; color: #374151; }
    .btn--outline:hover { border-color: #2e7736; color: #2e7736; }
  `]
})
export class WaConnectComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** Onde o token fica guardado enquanto a pessoa passa pelo login. */
  static readonly STORAGE_KEY = 'wa_pending_token';

  state = signal<'loading' | 'need-auth' | 'done' | 'error'>('loading');
  phone = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!token) { this.state.set('error'); return; }

    if (!this.auth.isLoggedIn()) {
      sessionStorage.setItem(WaConnectComponent.STORAGE_KEY, token);
      this.state.set('need-auth');
      return;
    }
    this.claim(token);
  }

  private claim(token: string): void {
    this.api.post<any>('/whatsapp/claim', { token })
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        sessionStorage.removeItem(WaConnectComponent.STORAGE_KEY);
        if (!res?.ok) { this.state.set('error'); return; }
        this.phone.set(res.phone ?? '');
        this.state.set('done');
      });
  }

  // O token fica em sessionStorage; quem finaliza o vínculo depois do login
  // é o shell — assim funciona também para quem entra por Google/Facebook.
  goLogin()     { this.router.navigate(['/auth/login']); }
  goRegister()  { this.router.navigate(['/auth/register']); }
  goDashboard() { this.router.navigate(['/dashboard']); }
}
