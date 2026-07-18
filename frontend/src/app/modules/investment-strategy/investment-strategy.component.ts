import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PlanService } from '../../core/services/plan.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

interface InvestmentClass {
  class_name: string;
  ideal_pct: number;
  current_value: number;
}

interface InvestmentAsset {
  id: string;
  class_name: string;
  sector: string;
  ticker: string;
  display_order: number;
}

interface ClassRow extends InvestmentClass {
  current_pct: number;
  allocation: number;
}

const CLASS_META: Record<string, { label: string; icon: string; color: string }> = {
  acoes:         { label: 'Ações',        icon: '📈', color: '#dc2626' },
  exterior:      { label: 'Exterior',     icon: '🌎', color: '#16a34a' },
  etfs:          { label: 'ETFs',         icon: '📊', color: '#2563eb' },
  fiis:          { label: 'FIIs',         icon: '🏢', color: '#7c3aed' },
  renda_fixa:    { label: 'Renda Fixa',   icon: '🏦', color: '#ea580c' },
  criptomoedas:  { label: 'Criptomoedas', icon: '₿',  color: '#db2777' },
};
const CLASS_ORDER = ['acoes', 'exterior', 'etfs', 'fiis', 'renda_fixa', 'criptomoedas'];

const STOCK_SECTORS = [
  'Bancos', 'Energia e Petróleo', 'Metalurgia e Mineração', 'Bebidas', 'Seguros',
  'Saneamento', 'Telecomunicações', 'Tecnologia', 'Varejo', 'Saúde',
  'Infraestrutura', 'Roupas e Calçados', 'Educação', 'Papel e Celulose', 'Outros',
];
const FII_SECTORS = [
  'Shoppings', 'Galpão Logístico', 'Laje Corporativa', 'Papel', 'Híbridos',
  'Fiagros', 'Hedge', 'Residenciais', 'Outros',
];

function sectorsFor(className: string): string[] {
  if (className === 'acoes' || className === 'exterior') return STOCK_SECTORS;
  if (className === 'fiis') return FII_SECTORS;
  return ['Outros'];
}

// Rebalances a new contribution across classes, prioritizing underweight ones.
function computeAllocations(classes: InvestmentClass[], contribution: number): number[] {
  const totalCurrent = classes.reduce((s, c) => s + (c.current_value || 0), 0);
  const totalFuture = totalCurrent + contribution;
  const diffs = classes.map(c => (c.ideal_pct / 100) * totalFuture - (c.current_value || 0));
  const sumPositive = diffs.reduce((s, d) => s + Math.max(0, d), 0);

  if (contribution <= 0) return classes.map(() => 0);

  if (sumPositive <= 0) {
    // Nothing underweight — just split by ideal % as a fallback.
    return classes.map(c => contribution * (c.ideal_pct / 100));
  }
  if (sumPositive <= contribution) {
    const remainder = contribution - sumPositive;
    return classes.map((c, i) => Math.max(0, diffs[i]) + remainder * (c.ideal_pct / 100));
  }
  return diffs.map(d => Math.max(0, d) * (contribution / sumPositive));
}

@Component({
  selector: 'app-investment-strategy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MoneyMaskDirective, ConfirmModalComponent],
  template: `
    @if (!plan.isPremium()) {
      <div class="upsell-card">
        <div class="upsell-icon">🔒</div>
        <h2>Recurso Premium</h2>
        <p>Defina sua alocação ideal de investimentos, mapeie seus ativos por setor e calcule quanto aportar em
           cada classe todo mês para manter sua carteira balanceada.</p>
        <a routerLink="/plan" class="btn btn--primary">Ver planos</a>
      </div>
    } @else {

    <div class="page-header">
      <h1>Estratégia de Investimentos</h1>
    </div>

    <div class="tabs">
      <button class="tab" [class.tab--active]="tab() === 'rebalance'" (click)="tab.set('rebalance')">⚖️ Rebalanceamento</button>
      <button class="tab" [class.tab--active]="tab() === 'sectors'" (click)="tab.set('sectors')">🗂️ Setores</button>
      <button class="tab" [class.tab--active]="tab() === 'calc'" (click)="tab.set('calc')">🧮 Calculadora</button>
    </div>

    @if (loading()) {
      <div class="skel-wrap">
        @for (i of [1,2,3]; track i) { <div class="skel-block skel-row"></div> }
      </div>
    }

    <!-- ══ TAB: Rebalanceamento ═══════════════════════════════════════ -->
    @if (!loading() && tab() === 'rebalance') {
      <div class="rb-top">
        <div class="scard">
          <span class="scard__l">Patrimônio atual</span>
          <span class="scard__v">{{ totalCurrent() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
        </div>
        <div class="scard scard--edit">
          <span class="scard__l">Quanto vou aportar</span>
          <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="monthlyContribution"
                 name="contribution" class="input scard__input" />
        </div>
        <div class="scard">
          <span class="scard__l">Total após aporte</span>
          <span class="scard__v">{{ (totalCurrent() + monthlyContribution) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
        </div>
      </div>

      <div class="panel">
        <table class="rtable">
          <thead>
            <tr>
              <th class="left">Classe</th>
              <th>% Ideal</th>
              <th>Valor Atual</th>
              <th>% Atual</th>
              <th>Quanto Colocar</th>
            </tr>
          </thead>
          <tbody>
            @for (row of classRows(); track row.class_name) {
              <tr>
                <td class="left">
                  <span class="class-chip" [style.background]="meta(row.class_name).color + '22'"
                        [style.color]="meta(row.class_name).color">
                    {{ meta(row.class_name).icon }} {{ meta(row.class_name).label }}
                  </span>
                </td>
                <td>
                  <input type="number" min="0" max="100" step="1" class="input input--pct"
                         [(ngModel)]="row.ideal_pct" [name]="'ideal_' + row.class_name" />
                </td>
                <td>
                  <input type="text" inputmode="decimal" appMoneyMask class="input input--money"
                         [(ngModel)]="row.current_value" [name]="'val_' + row.class_name" />
                </td>
                <td class="num">{{ row.current_pct | number:'1.0-1' }}%</td>
                <td class="num alloc" [class.alloc--zero]="row.allocation <= 0">
                  {{ row.allocation | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td class="left"><strong>Total</strong></td>
              <td [class.warn]="idealPctTotal() !== 100"><strong>{{ idealPctTotal() }}%</strong></td>
              <td><strong>{{ totalCurrent() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></td>
              <td class="num"><strong>100%</strong></td>
              <td class="num"><strong>{{ monthlyContribution | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></td>
            </tr>
          </tfoot>
        </table>
        @if (idealPctTotal() !== 100) {
          <p class="warn-msg">⚠️ A soma dos percentuais ideais está em {{ idealPctTotal() }}%, deveria ser 100%.</p>
        }
        <div class="rb-actions">
          <button class="btn btn--primary" (click)="saveConfig()" [disabled]="saving()">
            {{ saving() ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    }

    <!-- ══ TAB: Setores ═══════════════════════════════════════════════ -->
    @if (!loading() && tab() === 'sectors') {
      <div class="sec-tabs">
        @for (cn of classOrder; track cn) {
          <button class="sec-tab" [class.sec-tab--active]="sectorClass() === cn"
                  [style.borderColor]="sectorClass() === cn ? meta(cn).color : 'transparent'"
                  (click)="sectorClass.set(cn)">
            {{ meta(cn).icon }} {{ meta(cn).label }}
          </button>
        }
        <button class="btn btn--primary btn--sm sec-add" (click)="openAssetForm()">+ Novo ativo</button>
      </div>

      <div class="sec-grid">
        @for (grp of groupedAssets(); track grp.sector) {
          <div class="sec-card">
            <div class="sec-card__head">{{ grp.sector }}</div>
            <div class="sec-card__body">
              @for (a of grp.assets; track a.id) {
                <div class="asset-chip">
                  <span>{{ a.ticker }}</span>
                  <button class="chip-edit" (click)="openAssetForm(a)">✎</button>
                  <button class="chip-del" (click)="removeAsset(a)">×</button>
                </div>
              }
            </div>
          </div>
        }
        @if (groupedAssets().length === 0) {
          <div class="sec-empty">Nenhum ativo cadastrado em {{ meta(sectorClass()).label }} ainda.</div>
        }
      </div>
    }

    <!-- ══ TAB: Calculadora ═════════════════════════════════════════════ -->
    @if (!loading() && tab() === 'calc') {
      <div class="panel calc-panel">
        <h3>🧮 Calculadora Preço / Lucro</h3>
        <div class="calc-row">
          <div class="fg">
            <label>Preço</label>
            <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="calcPrice" name="calcPrice" class="input" />
          </div>
          <div class="fg">
            <label>Lucro</label>
            <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="calcProfit" name="calcProfit" class="input" />
          </div>
        </div>
        @if (calcProfit > 0) {
          <div class="calc-results">
            <div class="calc-item">
              <span class="calc-label">Relação Preço/Lucro</span>
              <span class="calc-val">{{ (calcPrice / calcProfit) | number:'1.2-4' }}</span>
            </div>
            <div class="calc-item">
              <span class="calc-label">Rendimento (Lucro/Preço)</span>
              <span class="calc-val calc-val--good">{{ calcPrice > 0 ? ((calcProfit / calcPrice) * 100 | number:'1.2-2') : '0' }}%</span>
            </div>
          </div>
        } @else {
          <p class="sim-hint">Informe preço e lucro para calcular.</p>
        }
      </div>
    }
    }

    <!-- ── Modal: novo/editar ativo ─────────────────────────────────── -->
    @if (showAssetForm()) {
      <div class="overlay" (click)="closeAssetForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingAsset() ? 'Editar Ativo' : 'Novo Ativo' }}</h2>
          <form (ngSubmit)="saveAsset()" class="mform">
            <div class="fg">
              <label>Classe</label>
              <select [(ngModel)]="assetForm.class_name" name="class_name" class="input" (ngModelChange)="onAssetClassChange()">
                @for (cn of classOrder; track cn) {
                  <option [value]="cn">{{ meta(cn).icon }} {{ meta(cn).label }}</option>
                }
              </select>
            </div>
            <div class="fg">
              <label>Setor</label>
              <input [(ngModel)]="assetForm.sector" name="sector" list="sector-options" class="input" placeholder="Ex: Bancos" />
              <datalist id="sector-options">
                @for (s of sectorsFor(assetForm.class_name); track s) { <option [value]="s"></option> }
              </datalist>
            </div>
            <div class="fg">
              <label>Ticker / Nome *</label>
              <input [(ngModel)]="assetForm.ticker" name="ticker" required class="input" placeholder="Ex: ITSA3" />
            </div>
            <div class="mform-actions">
              <button type="button" class="btn btn--ghost" (click)="closeAssetForm()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="savingAsset()">
                {{ savingAsset() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      (confirmed)="doDelete()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
  `,
  styles: [`
    .upsell-card {
      background: #fff; border-radius: .75rem; padding: 3rem 2rem; text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); max-width: 480px; margin: 2rem auto;
    }
    .upsell-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .upsell-card h2 { margin: 0 0 .5rem; font-size: 1.2rem; color: #111; }
    .upsell-card p { color: #6b7280; font-size: .9rem; line-height: 1.5; margin-bottom: 1.5rem; }
    .upsell-card .btn--primary { display: inline-block; text-decoration: none; padding: .55rem 1.2rem; border-radius: .375rem; background: #2e7736; color: #fff; font-weight: 600; font-size: .85rem; }

    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .page-header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }

    /* Tabs */
    .tabs { display: flex; gap: .5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #e5e7eb; }
    .tab { background: none; border: none; border-bottom: 2px solid transparent; padding: .6rem .9rem; font-size: .85rem; font-weight: 600; color: #6b7280; cursor: pointer; }
    .tab--active { color: #2e7736; border-color: #2e7736; }

    .skel-wrap { display: flex; flex-direction: column; gap: .5rem; }
    .skel-block { background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: .375rem; }
    .skel-row { height: 48px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Rebalance top cards */
    .rb-top { display: flex; gap: .875rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .scard { background: #fff; border-radius: .5rem; padding: .875rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); min-width: 160px; display: flex; flex-direction: column; gap: .35rem; flex: 1; }
    .scard__l { font-size: .7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; }
    .scard__v { font-size: 1.1rem; font-weight: 700; color: #111; }
    .scard__input { font-size: 1rem; font-weight: 700; }

    .panel { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
    .panel h3 { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; color: #111; }

    /* Rebalance table */
    .rtable { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .rtable th { background: #f9fafb; padding: .55rem .75rem; text-align: center; color: #6b7280; font-size: .72rem; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
    .rtable th.left, .rtable td.left { text-align: left; }
    .rtable td { padding: .5rem .75rem; border-top: 1px solid #f3f4f6; text-align: center; }
    .rtable td.num { text-align: right; }
    .rtable tfoot td { border-top: 2px solid #e5e7eb; padding-top: .65rem; }
    .rtable tfoot td.warn { color: #dc2626; }
    .class-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .25rem .6rem; border-radius: 9999px; font-size: .78rem; font-weight: 700; white-space: nowrap; }
    .input--pct { width: 64px; text-align: center; }
    .input--money { width: 110px; text-align: right; }
    .alloc { font-weight: 700; color: #16a34a; }
    .alloc--zero { color: #9ca3af; font-weight: 500; }
    .warn-msg { color: #dc2626; font-size: .8rem; margin: .75rem 0 0; }
    .rb-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }

    /* Sectors */
    .sec-tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: center; }
    .sec-tab { background: #fff; border: 2px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.07); border-radius: 9999px; padding: .4rem .9rem; font-size: .8rem; font-weight: 600; color: #374151; cursor: pointer; }
    .sec-tab--active { font-weight: 700; }
    .sec-add { margin-left: auto; }
    .sec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .sec-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .sec-card__head { background: #f9fafb; padding: .5rem .875rem; font-size: .78rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .03em; border-bottom: 1px solid #f3f4f6; }
    .sec-card__body { padding: .75rem .875rem; display: flex; flex-direction: column; gap: .4rem; }
    .asset-chip { display: flex; align-items: center; gap: .4rem; background: #f9fafb; border-radius: .375rem; padding: .35rem .6rem; font-size: .82rem; font-weight: 600; color: #111; }
    .asset-chip span { flex: 1; }
    .chip-edit, .chip-del { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: .85rem; padding: 0 .15rem; }
    .chip-edit:hover { color: #2e7736; }
    .chip-del:hover { color: #dc2626; }
    .sec-empty { color: #9ca3af; font-size: .85rem; padding: 2rem; text-align: center; grid-column: 1 / -1; }

    /* Calc */
    .calc-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .fg { display: flex; flex-direction: column; gap: .25rem; flex: 1; min-width: 160px; }
    .fg label { font-size: .8rem; font-weight: 500; color: #374151; }
    .calc-results { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .calc-item { background: #f9fafb; border-radius: .375rem; padding: .875rem; display: flex; flex-direction: column; gap: .2rem; }
    .calc-label { font-size: .7rem; color: #6b7280; text-transform: uppercase; }
    .calc-val { font-size: 1.3rem; font-weight: 700; color: #111; }
    .calc-val--good { color: #16a34a; }
    .sim-hint { color: #9ca3af; font-size: .875rem; margin: 0; }

    /* Buttons / inputs */
    .btn { padding: .4rem .875rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; transition: opacity .15s; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--ghost { background: none; color: #6b7280; }
    .btn--sm { padding: .25rem .65rem; font-size: .78rem; }
    .input { padding: .45rem .7rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; box-sizing: border-box; }

    /* Modal */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal { background: #fff; border-radius: .5rem; padding: 1.5rem; width: 90%; max-width: 420px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal h2 { margin: 0 0 1.25rem; font-size: 1.125rem; }
    .mform { display: flex; flex-direction: column; gap: .875rem; }
    .mform-actions { display: flex; justify-content: flex-end; gap: .75rem; padding-top: .5rem; border-top: 1px solid #f3f4f6; }

    @media (max-width: 640px) {
      .rb-top { flex-direction: column; }
      .rtable { font-size: .75rem; }
      .sec-add { margin-left: 0; width: 100%; }
    }

    /* ══ DARK THEME ════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .upsell-card,
    :host-context([data-theme="dark"]) .scard,
    :host-context([data-theme="dark"]) .panel,
    :host-context([data-theme="dark"]) .sec-tab,
    :host-context([data-theme="dark"]) .sec-card { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .upsell-card h2,
    :host-context([data-theme="dark"]) .page-header h1,
    :host-context([data-theme="dark"]) .panel h3,
    :host-context([data-theme="dark"]) .scard__v,
    :host-context([data-theme="dark"]) .class-chip,
    :host-context([data-theme="dark"]) .calc-val,
    :host-context([data-theme="dark"]) .asset-chip { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .scard__l,
    :host-context([data-theme="dark"]) .calc-label,
    :host-context([data-theme="dark"]) .sim-hint,
    :host-context([data-theme="dark"]) .fg label { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .tabs { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .tab { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .tab--active { color: #4ade80 !important; border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .rtable th { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .rtable td { border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .rtable tfoot td { border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .alloc { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .alloc--zero { color: #4f5f76 !important; }
    :host-context([data-theme="dark"]) .sec-tab { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .sec-tab--active { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sec-card__head { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .asset-chip { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .calc-val--good { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .calc-item { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .btn--ghost { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .input,
    :host-context([data-theme="dark"]) select { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .modal { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .mform-actions { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .skel-block { background: linear-gradient(90deg,#1e2638 25%,#283248 50%,#1e2638 75%) !important; }
    :host-context([data-theme="dark"]) .sec-empty { color: #4f5f76 !important; }
  `]
})
export class InvestmentStrategyComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  plan = inject(PlanService);

  loading = signal(true);
  saving  = signal(false);
  tab     = signal<'rebalance' | 'sectors' | 'calc'>('rebalance');

  classOrder = CLASS_ORDER;
  meta(cn: string) { return CLASS_META[cn] ?? { label: cn, icon: '•', color: '#6b7280' }; }
  sectorsFor = sectorsFor;

  // ── Rebalance state ─────────────────────────────────────────────────
  monthlyContribution = 0;
  classes = signal<InvestmentClass[]>(CLASS_ORDER.map(cn => ({ class_name: cn, ideal_pct: 0, current_value: 0 })));

  totalCurrent = computed(() => this.classes().reduce((s, c) => s + (c.current_value || 0), 0));
  idealPctTotal = computed(() => Math.round(this.classes().reduce((s, c) => s + (+c.ideal_pct || 0), 0)));

  classRows = computed<ClassRow[]>(() => {
    const list = this.classes();
    const total = this.totalCurrent();
    const allocations = computeAllocations(list, +this.monthlyContribution || 0);
    return list.map((c, i) => ({
      ...c,
      current_pct: total > 0 ? ((c.current_value || 0) / total) * 100 : 0,
      allocation: allocations[i],
    }));
  });

  // ── Sectors state ────────────────────────────────────────────────────
  sectorClass  = signal<string>('acoes');
  assets       = signal<InvestmentAsset[]>([]);
  showAssetForm = signal(false);
  savingAsset   = signal(false);
  editingAsset  = signal<InvestmentAsset | null>(null);
  assetForm: any = this.emptyAssetForm();

  groupedAssets = computed(() => {
    const cn = this.sectorClass();
    const list = this.assets().filter(a => a.class_name === cn);
    const bySector = new Map<string, InvestmentAsset[]>();
    for (const a of list) {
      const key = a.sector || 'Outros';
      if (!bySector.has(key)) bySector.set(key, []);
      bySector.get(key)!.push(a);
    }
    const order = sectorsFor(cn);
    const sectors = Array.from(bySector.keys()).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return sectors.map(sector => ({ sector, assets: bySector.get(sector)! }));
  });

  // ── Calculator state ─────────────────────────────────────────────────
  calcPrice = 0;
  calcProfit = 0;

  // ── Lifecycle ────────────────────────────────────────────────────────
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
    this.api.get<any>('/investment-config').subscribe(cfg => {
      this.monthlyContribution = cfg.monthly_contribution ?? 0;
      if (cfg.classes?.length) {
        this.classes.set(cfg.classes.map((c: any) => ({
          class_name: c.class_name, ideal_pct: c.ideal_pct, current_value: c.current_value,
        })));
      }
      this.api.get<any>('/investment-assets').subscribe(r => {
        this.assets.set(r.data ?? []);
        this.loading.set(false);
      });
    });
  }

  saveConfig() {
    this.saving.set(true);
    const payload = {
      monthly_contribution: +this.monthlyContribution || 0,
      classes: this.classes().map(c => ({
        class_name: c.class_name,
        ideal_pct: +c.ideal_pct || 0,
        current_value: +c.current_value || 0,
      })),
    };
    this.api.put<any>('/investment-config', payload).subscribe({
      next: () => { this.toast.success('Estratégia salva!'); this.saving.set(false); },
      error: err => { this.toast.error(err.error?.error ?? 'Erro ao salvar'); this.saving.set(false); },
    });
  }

  // ── Asset form ───────────────────────────────────────────────────────
  emptyAssetForm() {
    return { class_name: this.sectorClass(), sector: '', ticker: '' };
  }

  openAssetForm(a?: InvestmentAsset) {
    if (a) {
      this.editingAsset.set(a);
      this.assetForm = { ...a };
    } else {
      this.editingAsset.set(null);
      this.assetForm = this.emptyAssetForm();
    }
    this.showAssetForm.set(true);
  }
  closeAssetForm() { this.showAssetForm.set(false); this.editingAsset.set(null); }
  onAssetClassChange() { this.assetForm.sector = ''; }

  saveAsset() {
    if (!this.assetForm.ticker?.trim()) return;
    this.savingAsset.set(true);
    const payload = {
      class_name: this.assetForm.class_name,
      sector: this.assetForm.sector?.trim() || 'Outros',
      ticker: this.assetForm.ticker.trim(),
      display_order: 0,
    };
    const editing = this.editingAsset();
    const req = editing
      ? this.api.put<any>(`/investment-assets/${editing.id}`, payload)
      : this.api.post<any>('/investment-assets', payload);

    req.subscribe({
      next: () => {
        this.toast.success('Ativo salvo!');
        this.closeAssetForm();
        this.reloadAssets();
        this.savingAsset.set(false);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar');
        this.savingAsset.set(false);
      },
    });
  }

  reloadAssets() {
    this.api.get<any>('/investment-assets').subscribe(r => this.assets.set(r.data ?? []));
  }

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  removeAsset(a: InvestmentAsset) {
    this.confirmItem.set({ msg: `Excluir o ativo <strong>${a.ticker}</strong>?`, action: () => {
      this.api.delete(`/investment-assets/${a.id}`).subscribe(() => {
        this.toast.success('Ativo excluído.');
        this.reloadAssets();
      });
    }});
  }

  doDelete() {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }
}
