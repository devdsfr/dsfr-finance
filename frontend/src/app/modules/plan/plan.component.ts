import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';

const FREE_INCLUDES = [
  'Lançamentos e contas ilimitadas',
  'Categorias e tags',
  'Limite de gastos',
  'Relatórios na tela (sem exportação)',
];

export const PREMIUM_LABELS: Record<string, string> = {
  export_reports: '📤 Exportar relatórios em CSV / Excel',
  debt_strategy: '📊 Estratégia de Dívidas (bola de neve / avalanche)',
  ai_subscriptions: '🤖 Assinaturas Tech — consumo e recomendação de cancelamento',
};

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Controle de Acesso</h1>
    </div>

    <div class="current-plan">
      Seu plano atual:
      <span class="plan-tag" [class.plan-tag--premium]="plan.isPremium()">
        {{ plan.isPremium() ? 'Premium' : 'Free' }}
      </span>
    </div>

    <div class="plans-grid">
      <!-- FREE -->
      <div class="plan-card" [class.plan-card--active]="!plan.isPremium()">
        <div class="plan-card__head">
          <h2>Free</h2>
          <span class="price">R$ 0</span>
        </div>
        <ul class="feature-list">
          @for (f of freeIncludes; track f) {
            <li>✅ {{ f }}</li>
          }
          @for (f of plan.features(); track f.key) {
            <li class="locked">🔒 {{ f.label }}</li>
          }
        </ul>
        @if (plan.isPremium()) {
          <button class="btn btn--ghost" (click)="changePlan('free')" [disabled]="saving">Voltar para Free</button>
        } @else {
          <span class="current-badge">Plano atual</span>
        }
      </div>

      <!-- PREMIUM -->
      <div class="plan-card plan-card--highlight" [class.plan-card--active]="plan.isPremium()">
        <div class="plan-card__head">
          <h2>Premium</h2>
          <span class="price">Tudo incluído</span>
        </div>
        <ul class="feature-list">
          @for (f of freeIncludes; track f) {
            <li>✅ {{ f }}</li>
          }
          @for (f of plan.features(); track f.key) {
            <li>✅ {{ f.label }}</li>
          }
        </ul>
        @if (!plan.isPremium()) {
          <button class="btn btn--primary" (click)="changePlan('premium')" [disabled]="saving">
            {{ saving ? 'Atualizando…' : 'Ativar Premium' }}
          </button>
        } @else {
          <span class="current-badge current-badge--premium">Plano atual</span>
        }
      </div>
    </div>

    <div class="features-detail">
      <h3>Recursos Premium</h3>
      @for (f of plan.features(); track f.key) {
        <div class="feature-row">
          <div class="feature-row__icon" [class.feature-row__icon--on]="plan.isPremium()">
            {{ plan.isPremium() ? '✅' : '🔒' }}
          </div>
          <div>
            <div class="feature-row__label">{{ f.label }}</div>
            <div class="feature-row__desc">{{ f.description }}</div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 1rem; }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; color: #111; margin: 0; }

    .current-plan { margin-bottom: 1.5rem; font-size: .9rem; color: #374151; }
    .plan-tag { display: inline-block; padding: .15rem .6rem; border-radius: 9999px; background: #e5e7eb; color: #374151; font-weight: 700; font-size: .8rem; margin-left: .4rem; }
    .plan-tag--premium { background: #2e7736; color: #fff; }

    .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
    .plan-card { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.5rem; border: 2px solid transparent; display: flex; flex-direction: column; }
    .plan-card--highlight { border-color: #2e7736; }
    .plan-card--active { box-shadow: 0 4px 16px rgba(46,119,54,.18); }
    .plan-card__head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
    .plan-card__head h2 { margin: 0; font-size: 1.15rem; color: #111; }
    .price { font-size: .9rem; font-weight: 700; color: #2e7736; }
    .feature-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: .55rem; }
    .feature-list li { font-size: .85rem; color: #374151; }
    .feature-list li.locked { color: #9ca3af; }

    .current-badge { text-align: center; padding: .5rem; border-radius: .375rem; background: #f3f4f6; color: #6b7280; font-size: .8rem; font-weight: 600; }
    .current-badge--premium { background: #f0fdf4; color: #2e7736; }

    .btn { padding: .55rem 1rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .85rem; font-weight: 600; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--primary:hover { background: #235c29; }
    .btn--primary:disabled { opacity: .6; }
    .btn--ghost { background: none; border: 1px solid #d1d5db; color: #374151; }
    .btn--ghost:hover { border-color: #9ca3af; }

    .features-detail { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.5rem; }
    .features-detail h3 { margin: 0 0 1rem; font-size: 1rem; color: #111; }
    .feature-row { display: flex; gap: .85rem; padding: .75rem 0; border-bottom: 1px solid #f3f4f6; }
    .feature-row:last-child { border-bottom: none; }
    .feature-row__icon { font-size: 1.1rem; flex-shrink: 0; width: 28px; text-align: center; }
    .feature-row__label { font-weight: 600; color: #111; font-size: .88rem; }
    .feature-row__desc { font-size: .78rem; color: #9ca3af; }
    /* ══ DARK THEME ════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .plan-card,
    :host-context([data-theme="dark"]) .features-detail { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .plan-card--highlight { border-color: #2e7736 !important; }
    :host-context([data-theme="dark"]) .plan-card__head h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .plan-card__price { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .plan-card__price--free { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .current-badge { background: #1e2638 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .current-badge--premium { background: rgba(74,222,128,.12) !important; color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .feature-item { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .feature-item--locked { color: #4f5f76 !important; }
    :host-context([data-theme="dark"]) .features-detail h3 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .feature-detail__name { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .feature-detail__desc { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .plan-btn { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .plan-tag { background: #1e2638 !important; color: #c5cdd9 !important; }

  `]
})
export class PlanComponent implements OnInit {
  plan = inject(PlanService);
  private toast = inject(ToastService);

  saving = false;
  readonly freeIncludes = FREE_INCLUDES;

  ngOnInit() {
    this.plan.load();
  }

  changePlan(p: 'free' | 'premium') {
    this.saving = true;
    this.plan.setPlan(p).subscribe({
      next: () => {
        this.plan.plan.set(p);
        this.plan.load();
        this.toast.show(p === 'premium' ? 'Plano Premium ativado!' : 'Você voltou para o plano Free.', 'success');
        this.saving = false;
      },
      error: () => { this.toast.show('Erro ao atualizar plano.', 'error'); this.saving = false; },
    });
  }
}
