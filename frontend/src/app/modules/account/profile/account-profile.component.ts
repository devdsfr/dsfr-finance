import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiService } from '../../../core/services/api.service';
import { SettingsService, CURRENCIES, CurrencyCode } from '../../../core/services/settings.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ConfirmModalComponent],
  template: `
    <!-- AC-MC-08, AC-MC-09, AC-MC-10 -->
    <div class="profile-page">
      <h1>Minha Conta</h1>

      <!-- Preferences: currency -->
      <section class="section">
        <h2>Preferências</h2>
        <div class="form-row">
          <div class="pref-field">
            <label>Moeda de exibição</label>
            <select class="input" [(ngModel)]="selectedCurrency" (ngModelChange)="onCurrencyChange($event)">
              @for (c of currencies; track c.value) {
                <option [value]="c.value">{{ c.label }}</option>
              }
            </select>
          </div>
        </div>
        <p class="section__desc">Todos os valores no app passam a ser exibidos nessa moeda.</p>
      </section>

      <!-- MFA Section — AC-MC-10 -->
      <section class="section">
        <h2>Autenticação em Dois Fatores (2FA/MFA)</h2>
        <p class="section__desc">Adicione uma camada extra de segurança à sua conta financeira.</p>

        @if (!user()?.mfa_enabled) {
          <button class="btn btn--primary" (click)="setupMFA()">Ativar 2FA</button>
          @if (mfaQRUrl()) {
            <div class="mfa-setup">
              <p>Escaneie o QR code no seu app autenticador (Google Authenticator, Authy etc.):</p>
              <div class="mfa-qr">
                <img [src]="'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURI(mfaQRUrl())" alt="QR Code 2FA" width="180" height="180" style="display:block;border-radius:.375rem;" />
              </div>
              <div class="form-row">
                <input [(ngModel)]="mfaCode" placeholder="Código de 6 dígitos" class="input" maxlength="6" />
                <button class="btn btn--primary" (click)="confirmMFA()">Confirmar</button>
              </div>
            </div>
          }
        } @else {
          <div class="mfa-active">
            <span class="badge-green">✓ 2FA Ativo</span>
            <button class="btn btn--danger btn--sm" (click)="disableMFA()">Desativar 2FA</button>
          </div>
        }
      </section>

      <!-- Workspace Section — AC-MC-08, AC-MC-09 -->
      <section class="section">
        <h2>Espaços (Workspaces)</h2>
        <div class="workspace-explainer">
          <div class="explainer-card">
            <span class="explainer-icon">👤</span>
            <strong>Pessoal</strong>
            <p>Use sozinho para gerenciar suas finanças pessoais.</p>
          </div>
          <div class="explainer-card">
            <span class="explainer-icon">🏢</span>
            <strong>Pessoa Jurídica</strong>
            <p>Separe finanças da empresa das finanças pessoais.</p>
          </div>
          <div class="explainer-card">
            <span class="explainer-icon">👫</span>
            <strong>Compartilhado</strong>
            <p>Compartilhe com cônjuge, sócio ou familiar.</p>
          </div>
        </div>

        <!-- AC-MC-09: Invite member -->
        <div class="invite-section">
          <h3>Convidar membro</h3>
          <div class="form-row">
            <input [(ngModel)]="invite.email" placeholder="email@exemplo.com" class="input" type="email" />
            <select [(ngModel)]="invite.role" class="input">
              <option value="viewer">Visualizador</option>
              <option value="editor">Editor</option>
            </select>
            <button class="btn btn--primary" (click)="sendInvite()">Enviar convite</button>
          </div>
        </div>

        <!-- Current members -->
        <div class="members-list">
          <h3>Membros atuais</h3>
          @for (m of members(); track m.user_id) {
            <div class="member-row">
              <span>{{ m.user?.name ?? m.user_id }}</span>
              <span class="badge">{{ m.role }}</span>
            </div>
          }
        </div>
      </section>

      <!-- Privacy & Data — GDPR -->
      <section class="section">
        <h2>Privacidade e Dados</h2>
        <p class="section__desc">
          Veja como tratamos seus dados em nossa
          <a routerLink="/legal/privacy" target="_blank">Política de Privacidade</a> e
          <a routerLink="/legal/terms" target="_blank">Termos de Uso</a>.
        </p>

        <div class="gdpr-row">
          <div>
            <strong>Exportar meus dados</strong>
            <p>Baixe uma cópia de todos os seus dados (contas, lançamentos, categorias etc.) em formato JSON.</p>
          </div>
          <button class="btn btn--outline" (click)="exportData()" [disabled]="exporting()">
            {{ exporting() ? 'Gerando...' : '⬇ Exportar dados' }}
          </button>
        </div>

        <div class="gdpr-row gdpr-row--danger">
          <div>
            <strong>Excluir minha conta</strong>
            <p>Remove permanentemente sua conta e todos os dados associados. Esta ação não pode ser desfeita.</p>
          </div>
          <button class="btn btn--danger" (click)="deleteAccount()">🗑 Excluir conta</button>
        </div>
      </section>
    </div>

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [title]="confirmItem()?.title || 'Confirmar ação'"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      [subMessage]="confirmItem()?.sub || 'Essa ação não pode ser desfeita.'"
      [confirmLabel]="confirmItem()?.label || 'Confirmar'"
      (confirmed)="doConfirm()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
  `,
  styles: [`
    .profile-page { max-width: 720px; }
    .section { background: #fff; border-radius: .5rem; padding: 1.5rem; margin-bottom: 1.5rem;
               box-shadow: 0 1px 3px rgba(0,0,0,.07); }
    .section__desc { color: #6b7280; font-size: .875rem; margin-bottom: 1rem; }
    h2 { font-size: 1.1rem; margin: 0 0 .75rem; }
    h3 { font-size: .95rem; margin: 1rem 0 .5rem; }
    .mfa-setup { margin-top: 1rem; }
    .mfa-qr { background: #f3f4f6; padding: .75rem; border-radius: .375rem; font-size: .75rem;
              word-break: break-all; margin: .5rem 0; }
    .mfa-active { display: flex; align-items: center; gap: 1rem; }
    .badge-green { background: #22c55e; color: #fff; padding: .25rem .75rem; border-radius: 9999px; font-size: .8rem; }
    .workspace-explainer { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .explainer-card { flex: 1; min-width: 160px; border: 1px solid #e5e7eb; border-radius: .5rem;
                      padding: 1rem; text-align: center; }
    .explainer-icon { font-size: 1.75rem; display: block; margin-bottom: .5rem; }
    .explainer-card p { font-size: .8rem; color: #6b7280; margin: .25rem 0 0; }
    .invite-section { margin-top: 1.25rem; }
    .form-row { display: flex; gap: .5rem; flex-wrap: wrap; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; flex: 1; min-width: 120px; }
    .members-list { margin-top: 1rem; }
    .member-row { display: flex; justify-content: space-between; align-items: center;
                  padding: .5rem 0; border-bottom: 1px solid #f3f4f6; font-size: .875rem; }
    .badge { background: #e0e7ff; color: #4338ca; padding: .1rem .45rem; border-radius: 9999px; font-size: .75rem; }
    .btn { padding: .4rem 1rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .875rem; }
    .btn--primary { background: #6366f1; color: #fff; }
    .btn--danger { background: #fee2e2; color: #dc2626; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
    .btn--outline { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .btn--outline:hover { border-color: #6366f1; color: #6366f1; }

    .pref-field { display: flex; flex-direction: column; gap: .3rem; max-width: 280px; }
    .pref-field label { font-size: .82rem; font-weight: 500; color: #374151; }

    .gdpr-row {
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      padding: 1rem 0; border-top: 1px solid #f3f4f6; flex-wrap: wrap;
    }
    .gdpr-row strong { font-size: .9rem; color: #111; }
    .gdpr-row p { margin: .2rem 0 0; font-size: .8rem; color: #6b7280; max-width: 420px; }
    .gdpr-row--danger strong { color: #dc2626; }
    .section__desc a { color: #6366f1; }
  `]
})
export class AccountProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  settings = inject(SettingsService);

  user = this.auth.currentUser;
  members = signal<any[]>([]);
  mfaQRUrl = signal('');
  mfaCode = '';
  invite = { email: '', role: 'viewer' };

  exporting = signal(false);
  readonly currencies = CURRENCIES;
  selectedCurrency: CurrencyCode = 'BRL';

  ngOnInit(): void {
    this.api.get<any>('/workspace/members').subscribe(r => this.members.set(r.data ?? []));
    if (!this.settings.loaded()) this.settings.load();
    this.selectedCurrency = this.settings.currency();
  }

  onCurrencyChange(code: CurrencyCode): void {
    this.settings.setCurrency(code).subscribe({
      next: () => this.toast.success('Moeda atualizada!'),
      error: () => this.toast.error('Erro ao atualizar moeda.'),
    });
  }

  exportData(): void {
    this.exporting.set(true);
    this.api.download('/me/export').subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'dsfr-finance-export.json'; a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => { this.toast.error('Erro ao exportar dados.'); this.exporting.set(false); },
    });
  }

  confirmItem = signal<{ title: string; msg: string; sub?: string; label?: string; action: () => void } | null>(null);

  deleteAccount(): void {
    this.confirmItem.set({
      title: 'Excluir conta',
      msg: 'Tem certeza que deseja excluir sua conta? <strong>Todos os seus dados serão removidos permanentemente.</strong>',
      sub: 'Essa ação não pode ser desfeita.',
      label: 'Excluir conta',
      action: () => {
        this.api.delete('/me').subscribe({
          next: () => { this.toast.success('Conta excluída.'); this.auth.logout(); },
          error: () => this.toast.error('Erro ao excluir conta.'),
        });
      }
    });
  }

  doConfirm() {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }

  setupMFA(): void {
    this.auth.enableMFA().subscribe(res => this.mfaQRUrl.set(res.provisioning_url));
  }

  confirmMFA(): void {
    this.auth.confirmMFA(this.mfaCode).subscribe({
      next: () => {
        this.toast.success('MFA ativado com sucesso!');
        this.mfaQRUrl.set('');
        const u = this.user();
        if (u) this.auth.currentUser.set({ ...u, mfa_enabled: true });
      },
      error: err => this.toast.error(err.error?.error ?? 'Código inválido')
    });
  }

  disableMFA(): void {
    this.confirmItem.set({
      title: 'Desativar 2FA',
      msg: 'Tem certeza que deseja desativar a autenticação de dois fatores?',
      sub: 'Sua conta ficará menos segura sem o 2FA.',
      label: 'Desativar',
      action: () => this.auth.disableMFA().subscribe(() => {
        this.toast.success('2FA desativado.');
        const u = this.user();
        if (u) this.auth.currentUser.set({ ...u, mfa_enabled: false });
      })
    });
  }

  encodeURI = encodeURI;

  sendInvite(): void {
    this.api.post('/workspace/invite', this.invite).subscribe(() => {
      this.toast.success('Convite enviado!');
      this.invite = { email: '', role: 'viewer' };
    });
  }
}
