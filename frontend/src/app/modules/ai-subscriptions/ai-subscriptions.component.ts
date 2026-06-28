import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PlanService } from '../../core/services/plan.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

const AI_PRESETS = [
  { name: 'ChatGPT Plus',   provider: 'openai',     color: '#10a37f', logo: 'https://logo.clearbit.com/openai.com' },
  { name: 'Claude Pro',     provider: 'anthropic',  color: '#d97757', logo: 'https://logo.clearbit.com/anthropic.com' },
  { name: 'Gemini Advanced',provider: 'google',     color: '#4285f4', logo: 'https://logo.clearbit.com/google.com' },
  { name: 'Perplexity Pro', provider: 'other',      color: '#20808d', logo: 'https://logo.clearbit.com/perplexity.ai' },
  { name: 'GitHub Copilot', provider: 'other',      color: '#24292e', logo: 'https://logo.clearbit.com/github.com' },
  { name: 'Midjourney',     provider: 'other',      color: '#000000', logo: 'https://logo.clearbit.com/midjourney.com' },
  { name: 'Cursor',         provider: 'other',      color: '#000000', logo: 'https://logo.clearbit.com/cursor.sh' },
  { name: 'Outro',          provider: 'other',      color: '#6b7280', logo: '' },
];

const PROVIDERS = [
  { value: 'openai',     label: 'OpenAI (ChatGPT)' },
  { value: 'anthropic',  label: 'Anthropic (Claude)' },
  { value: 'google',     label: 'Google (Gemini)' },
  { value: 'other',      label: 'Outro / sem sincronização automática' },
];

@Component({
  selector: 'app-ai-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MoneyMaskDirective, ConfirmModalComponent],
  template: `
    <div class="page-header">
      <h1>Assinaturas de IA</h1>
      @if (plan.isPremium()) {
        <button class="btn btn--primary btn--sm" (click)="openForm()">+ Nova assinatura</button>
      }
    </div>

    @if (plan.loaded() && !plan.isPremium()) {
      <div class="upsell-card">
        <div class="upsell-icon">🔒</div>
        <h2>Recurso Premium</h2>
        <p>Acompanhe o consumo de cada assinatura de IA (ChatGPT, Claude, etc.) e receba recomendações automáticas
           sobre se compensa manter ou cancelar, com base no uso real do mês.</p>
        <a routerLink="/plan" class="btn btn--primary">Ver planos</a>
      </div>
    } @else {

      @if (showForm) {
        <div class="form-card">
          <h3>{{ editing ? 'Editar assinatura' : 'Nova assinatura' }}</h3>
          <form (ngSubmit)="save()" #f="ngForm">

            <div class="form-group" style="margin-bottom:1rem">
              <label>Escolher serviço</label>
              <div class="preset-grid">
                @for (p of presets; track p.name) {
                  <button type="button" class="preset-btn"
                          [class.selected]="item.logo === p.logo && item.name === p.name"
                          (click)="applyPreset(p)" [title]="p.name">
                    @if (p.logo) {
                      <img [src]="p.logo" [alt]="p.name" class="preset-logo" (error)="onLogoError($event, p.color, p.name)" />
                    } @else {
                      <div class="preset-initial" [style.background]="p.color">{{ p.name[0] }}</div>
                    }
                    <span class="preset-label">{{ p.name }}</span>
                  </button>
                }
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nome</label>
                <input [(ngModel)]="item.name" name="name" class="input" required placeholder="Ex: ChatGPT Plus" />
              </div>
              <div class="form-group">
                <label>Provedor (para sincronização)</label>
                <select [(ngModel)]="item.provider" name="provider" class="input">
                  @for (p of providers; track p.value) {
                    <option [value]="p.value">{{ p.label }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Plano</label>
                <input [(ngModel)]="item.plan_name" name="plan_name" class="input" placeholder="Ex: Plus, Pro, Team…" />
              </div>
              <div class="form-group">
                <label>Custo mensal</label>
                <input [(ngModel)]="item.monthly_cost" name="monthly_cost" type="text" inputmode="decimal" appMoneyMask class="input" placeholder="0,00" />
              </div>
              <div class="form-group">
                <label>Dia de cobrança</label>
                <input [(ngModel)]="item.billing_day" name="billing_day" type="number" min="1" max="31" class="input" placeholder="1–31" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom:1rem">
              <label>
                API Key (opcional — apenas OpenAI/Anthropic com chave Admin permitem sincronizar uso real)
                @if (editing && item.has_api_key) { <span class="key-status">chave salva ✓</span> }
              </label>
              <input [(ngModel)]="item.api_key" name="api_key" type="password" class="input"
                     [placeholder]="editing && item.has_api_key ? 'Deixe em branco para manter a chave atual' : 'sk-...'" />
              <span class="hint">A chave é criptografada antes de ser salva. Sem ela, você pode informar o uso manualmente.</span>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn--ghost" (click)="cancelForm()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="!item.name">Salvar</button>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="list-grid">
          @for (i of [1,2,3]; track i) {
            <div class="item-card">
              <div class="skel-block skel-h3 skel-w-40" style="margin-bottom:.5rem"></div>
              <div class="skel-block skel-p skel-w-60"></div>
            </div>
          }
        </div>
      } @else if (items().length === 0) {
        <div class="empty-state">
          Nenhuma assinatura de IA cadastrada.<br/>
          <button class="btn btn--primary btn--sm" style="margin-top:.75rem" (click)="openForm()">+ Cadastrar primeira assinatura</button>
        </div>
      } @else {
        <div class="list-grid">
          @for (it of items(); track it.id) {
            <div class="item-card">
              <div class="item-card__top">
                @if (it.logo) {
                  <div class="item-icon" [style.background]="it.color ?? '#111'">
                    <img [src]="it.logo" [alt]="it.name" class="icon-logo" (error)="onLogoError($event, it.color ?? '#111', it.name)" />
                  </div>
                } @else {
                  <div class="item-icon" [style.background]="it.color ?? '#111'">{{ it.name[0] }}</div>
                }
                <div class="item-info">
                  <span class="item-name">{{ it.name }}</span>
                  <span class="item-sub">{{ it.plan_name || providerLabel(it.provider) }} · R$ {{ it.monthly_cost | number:'1.2-2' }}/mês</span>
                </div>
              </div>

              <!-- Recommendation badge -->
              @if (it.recommendation) {
                <div class="rec-badge" [class]="'rec-badge--' + it.recommendation.score">
                  <span class="rec-label">{{ it.recommendation.label }}</span>
                  <span class="rec-msg">{{ it.recommendation.message }}</span>
                </div>
              }

              <!-- Current usage -->
              <div class="usage-row">
                @if (it.current_usage) {
                  <span class="usage-stat">{{ it.current_usage.requests_count }} uso(s) este mês</span>
                  @if (it.current_usage.cost_usd) {
                    <span class="usage-stat">~US$ {{ it.current_usage.cost_usd | number:'1.2-2' }}</span>
                  }
                  <span class="usage-source">{{ it.current_usage.source === 'api' ? 'via API' : 'manual' }}</span>
                } @else {
                  <span class="usage-stat usage-stat--empty">Sem dados de uso este mês</span>
                }
              </div>

              @if (manualFormId === it.id) {
                <form class="manual-form" (ngSubmit)="saveManualUsage(it)">
                  <input type="number" [(ngModel)]="manualUsage.requests_count" name="rc" class="input input--sm" placeholder="Nº de usos" />
                  <input type="number" step="0.01" [(ngModel)]="manualUsage.cost_usd" name="cu" class="input input--sm" placeholder="Custo US$ (opc.)" />
                  <button type="submit" class="btn btn--primary btn--sm">Salvar</button>
                  <button type="button" class="btn btn--ghost btn--sm" (click)="manualFormId = null">✕</button>
                </form>
              }

              <div class="item-actions">
                @if (it.has_api_key) {
                  <button class="btn btn--ghost btn--sm" (click)="sync(it)" [disabled]="syncingId === it.id">
                    {{ syncingId === it.id ? 'Sincronizando…' : '🔄 Sincronizar' }}
                  </button>
                }
                <button class="btn btn--ghost btn--sm" (click)="toggleManualForm(it)">📝 Informar uso</button>
                <button class="btn btn--ghost btn--sm" (click)="edit(it)">✎ Editar</button>
                <button class="btn btn--danger btn--sm" (click)="remove(it)">✕</button>
              </div>
            </div>
          }
        </div>
      }
    }

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      (confirmed)="doDelete()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
  `,
  styles: [`
    .page-header { display:flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; color: #111; margin: 0; }

    .upsell-card {
      background: #fff; border-radius: .75rem; padding: 3rem 2rem; text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); max-width: 480px; margin: 2rem auto;
    }
    .upsell-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .upsell-card h2 { margin: 0 0 .5rem; font-size: 1.2rem; color: #111; }
    .upsell-card p { color: #6b7280; font-size: .9rem; line-height: 1.5; margin-bottom: 1.5rem; }

    .form-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.5rem; margin-bottom: 1.5rem; }
    .form-card h3 { margin: 0 0 1.25rem; font-size: 1rem; font-weight: 700; color: #111; }
    .form-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
    .form-group { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: .3rem; }
    label { font-size: .8rem; font-weight: 500; color: #374151; }
    .key-status { color: #16a34a; font-weight: 600; margin-left: .4rem; }
    .hint { font-size: .72rem; color: #9ca3af; }
    .input { padding: .45rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; width: 100%; box-sizing: border-box; }
    .input:focus { outline: none; border-color: #2e7736; box-shadow: 0 0 0 3px rgba(46,119,54,.1); }
    .input--sm { width: auto; flex: 1; min-width: 100px; }
    .form-actions { display: flex; gap: .75rem; justify-content: flex-end; padding-top: .5rem; border-top: 1px solid #f3f4f6; margin-top: .5rem; }

    .preset-grid { display: flex; flex-wrap: wrap; gap: .5rem; padding-top: .25rem; }
    .preset-btn {
      display: flex; flex-direction: column; align-items: center; gap: .25rem;
      width: 72px; padding: .5rem .25rem; border-radius: .5rem;
      border: 2px solid transparent; background: #f9fafb; cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .preset-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
    .preset-btn.selected { border-color: #2e7736; background: #f0fdf4; }
    .preset-logo { width: 36px; height: 36px; border-radius: 50%; object-fit: contain; background: #fff; padding: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .preset-initial { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 1rem; }
    .preset-label { font-size: .6rem; color: #6b7280; text-align: center; line-height: 1.2; max-width: 64px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

    .list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .item-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.25rem; display: flex; flex-direction: column; gap: .75rem; }
    .item-card__top { display: flex; align-items: center; gap: .75rem; }
    .item-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 1.2rem; flex-shrink: 0; overflow: hidden; }
    .icon-logo { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
    .item-info { display: flex; flex-direction: column; }
    .item-name { font-size: .95rem; font-weight: 700; color: #111; }
    .item-sub { font-size: .75rem; color: #9ca3af; }

    .rec-badge { border-radius: .375rem; padding: .55rem .75rem; display: flex; flex-direction: column; gap: .15rem; }
    .rec-badge--good    { background: #f0fdf4; border-left: 3px solid #16a34a; }
    .rec-badge--warning { background: #fffbeb; border-left: 3px solid #f59e0b; }
    .rec-badge--bad      { background: #fef2f2; border-left: 3px solid #dc2626; }
    .rec-badge--unknown  { background: #f9fafb; border-left: 3px solid #9ca3af; }
    .rec-label { font-size: .8rem; font-weight: 700; color: #111; }
    .rec-msg { font-size: .75rem; color: #6b7280; }

    .usage-row { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; font-size: .8rem; }
    .usage-stat { color: #374151; font-weight: 600; }
    .usage-stat--empty { color: #9ca3af; font-weight: 400; }
    .usage-source { color: #9ca3af; font-size: .7rem; background: #f3f4f6; padding: .1rem .4rem; border-radius: .25rem; }

    .manual-form { display: flex; gap: .4rem; align-items: center; }

    .item-actions { display: flex; gap: .4rem; padding-top: .5rem; border-top: 1px solid #f3f4f6; flex-wrap: wrap; }

    .btn { padding: .4rem .9rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--primary:hover { background: #235c29; }
    .btn--primary:disabled { opacity: .5; cursor: default; }
    .btn--ghost { background: none; border: 1px solid #d1d5db; color: #374151; }
    .btn--ghost:hover { border-color: #2e7736; color: #2e7736; }
    .btn--danger { background: none; color: #ef4444; border: 1px solid transparent; }
    .btn--danger:hover { background: #fef2f2; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }

    .empty-state { text-align: center; color: #9ca3af; padding: 2.5rem; background: #fff; border-radius: .5rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
  `]
})
export class AiSubscriptionsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  plan = inject(PlanService);

  items = signal<any[]>([]);
  loading = signal(true);
  showForm = false;
  editing: any = null;
  item: any = {};

  syncingId: string | null = null;
  manualFormId: string | null = null;
  manualUsage: any = { requests_count: null, cost_usd: null };

  readonly presets = AI_PRESETS;
  readonly providers = PROVIDERS;

  ngOnInit() {
    if (this.plan.loaded()) {
      if (this.plan.isPremium()) this.load();
      else this.loading.set(false);
    } else {
      this.api.get<any>('/plan').subscribe(r => {
        this.plan.plan.set(r.plan ?? 'free');
        this.plan.features.set(r.features ?? []);
        this.plan.loaded.set(true);
        if (this.plan.isPremium()) this.load();
        else this.loading.set(false);
      });
    }
  }

  load() {
    this.loading.set(true);
    this.api.get<any>('/ai-subscriptions').subscribe({
      next: r => { this.items.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  applyPreset(p: typeof AI_PRESETS[0]) {
    if (p.name !== 'Outro') this.item.name = p.name;
    this.item.provider = p.provider;
    this.item.color = p.color;
    this.item.logo = p.logo;
  }

  onLogoError(event: Event, color: string, name: string) {
    const img = event.target as HTMLImageElement;
    const parent = img.parentElement!;
    img.style.display = 'none';
    parent.style.background = color;
    parent.textContent = name[0];
    parent.style.color = '#fff';
    parent.style.fontWeight = '700';
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.justifyContent = 'center';
  }

  providerLabel(v: string) { return PROVIDERS.find(p => p.value === v)?.label ?? v; }

  openForm() {
    this.editing = null;
    this.item = { name: '', provider: 'openai', plan_name: '', monthly_cost: 0, billing_day: null, api_key: '', color: '#111827', logo: '' };
    this.showForm = true;
  }
  edit(it: any) {
    this.editing = it;
    this.item = { ...it, api_key: '' };
    this.showForm = true;
  }
  cancelForm() { this.showForm = false; }

  save() {
    const body: any = {
      provider: this.item.provider,
      name: this.item.name,
      plan_name: this.item.plan_name,
      monthly_cost: this.item.monthly_cost,
      billing_day: this.item.billing_day,
      color: this.item.color,
      logo: this.item.logo,
    };
    if (this.editing) {
      // only send api_key if user typed something (else keep current key server-side)
      if (this.item.api_key) body.api_key = this.item.api_key;
      this.api.put(`/ai-subscriptions/${this.editing.id}`, body).subscribe({
        next: () => { this.toast.show('Assinatura salva!', 'success'); this.showForm = false; this.load(); },
        error: () => this.toast.show('Erro ao salvar.', 'error'),
      });
    } else {
      body.api_key = this.item.api_key;
      this.api.post('/ai-subscriptions', body).subscribe({
        next: () => { this.toast.show('Assinatura cadastrada!', 'success'); this.showForm = false; this.load(); },
        error: () => this.toast.show('Erro ao cadastrar.', 'error'),
      });
    }
  }

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  remove(it: any) {
    this.confirmItem.set({ msg: `Tem certeza que deseja excluir a assinatura <strong>${it.name}</strong>?`, action: () => {
      this.api.delete(`/ai-subscriptions/${it.id}`).subscribe({
        next: () => { this.toast.show('Assinatura excluída.', 'success'); this.load(); },
        error: () => this.toast.show('Erro ao excluir.', 'error'),
      });
    }});
  }

  doDelete() {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }

  sync(it: any) {
    this.syncingId = it.id;
    this.api.post(`/ai-subscriptions/${it.id}/sync`, {}).subscribe({
      next: () => { this.toast.show('Uso sincronizado!', 'success'); this.syncingId = null; this.load(); },
      error: (err) => {
        this.syncingId = null;
        this.toast.show(err?.error?.error || 'Não foi possível sincronizar — informe o uso manualmente.', 'error');
      },
    });
  }

  toggleManualForm(it: any) {
    this.manualFormId = this.manualFormId === it.id ? null : it.id;
    this.manualUsage = { requests_count: it.current_usage?.requests_count ?? null, cost_usd: it.current_usage?.cost_usd ?? null };
  }

  saveManualUsage(it: any) {
    this.api.post(`/ai-subscriptions/${it.id}/usage`, {
      requests_count: this.manualUsage.requests_count ?? 0,
      cost_usd: this.manualUsage.cost_usd ?? 0,
    }).subscribe({
      next: () => { this.toast.show('Uso registrado!', 'success'); this.manualFormId = null; this.load(); },
      error: () => this.toast.show('Erro ao registrar uso.', 'error'),
    });
  }
}
