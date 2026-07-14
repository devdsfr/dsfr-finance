import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppCurrencyPipe } from '../../../shared/pipes/app-currency.pipe';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

@Component({
  selector: 'app-spending-limits',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe, MoneyMaskDirective, ConfirmModalComponent],
  template: `
<div class="sl-page">

  <!-- Month nav -->
  <div class="month-nav">
    <button class="nav-btn" (click)="prevMonth()">‹</button>
    <span class="month-label">{{ monthLabel() }}</span>
    <button class="nav-btn" (click)="nextMonth()" [disabled]="isCurrentMonth()">›</button>
  </div>

  @if (loading()) {
    <div class="skeleton-wrap">
      @for (i of [1,2,3,4,5]; track i) {
        <div class="cat-row cat-skel">
          <div class="skel-block cat-skel__icon"></div>
          <div style="flex:1">
            <div class="skel-block" style="height:12px;width:100px;margin-bottom:6px"></div>
            <div class="skel-block" style="height:7px;border-radius:4px"></div>
          </div>
          <div class="skel-block" style="height:12px;width:60px"></div>
        </div>
      }
    </div>
  } @else {

    <!-- Global total panel -->
    @if (globalLimit()) {
      <div class="global-panel">
        <div class="global-panel__labels">
          <span class="global-panel__title">Total de despesas</span>
          <span class="global-panel__val">
            <strong [class.over]="totalSpend() > globalLimit()!.amount">{{ totalSpend() | appCurrency }}</strong>
            <span class="global-panel__of"> de {{ globalLimit()!.amount | appCurrency }}</span>
            <button class="edit-inline-btn" (click)="editLimit(globalLimit()!)" title="Editar limite global">✎</button>
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill"
               [style.width.%]="Math.min(100, (totalSpend() / globalLimit()!.amount) * 100)"
               [class.fill--warning]="totalSpend() / globalLimit()!.amount >= 0.8"
               [class.fill--danger]="totalSpend() >= globalLimit()!.amount">
          </div>
          <div class="progress-bar__today" [style.left.%]="todayPct()"></div>
        </div>
        <div class="global-panel__meta">
          <a class="forecast-link" href="javascript:void(0)" (click)="showForecast = !showForecast">
            {{ showForecast ? 'ocultar previsão no gráfico' : 'mostrar previsão no gráfico' }}
          </a>
        </div>
      </div>
    } @else {
      <div class="global-panel global-panel--empty">
        <div class="global-panel__labels">
          <span class="global-panel__title">Total de despesas</span>
          <span class="global-panel__val"><strong>{{ totalSpend() | appCurrency }}</strong></span>
        </div>
        <div class="progress-bar progress-bar--empty">
          <div class="progress-bar__fill" style="width:0"></div>
          <div class="progress-bar__today" [style.left.%]="todayPct()"></div>
        </div>
        <button class="add-global-btn" (click)="addGlobalLimit()">+ Limite global</button>
      </div>
    }

    <!-- Category list -->
    <div class="cat-list">
      <div class="cat-list__header">
        <span>Categorias</span>
      </div>

      @for (row of categoryRows(); track row.categoryId) {
        <div class="cat-row">
          <!-- Icon -->
          <div class="cat-icon">
            {{ row.icon || '📋' }}
          </div>

          <!-- Info + bar — always shown (empty if no limit, like Organizze) -->
          <div class="cat-body">
            <div class="cat-name">{{ row.name }}</div>
            <div class="cat-progress">
              <div class="progress-bar progress-bar--sm">
                <div class="progress-bar__fill"
                     [style.width.%]="row.limit ? Math.min(100, row.usagePct) : 0"
                     [class.fill--warning]="row.limit && row.usagePct >= (row.limit.alert_pct || 80)"
                     [class.fill--danger]="row.limit && row.usagePct >= 100">
                </div>
              </div>
            </div>
          </div>

          <!-- Spend / action -->
          <div class="cat-right">
            @if (row.limit) {
              <div class="cat-spend">
                <span [class.over]="row.spend > row.limit.amount">{{ row.spend | appCurrency }}</span>
                <span class="cat-of"> de {{ row.limit.amount | appCurrency }}</span>
              </div>
              <button class="action-btn action-btn--edit" (click)="editLimit(row.limit)" title="Editar limite">✎</button>
            } @else {
              @if (row.spend > 0) { <span class="cat-spend-only">{{ row.spend | appCurrency }}</span> }
              <button class="action-btn action-btn--add" (click)="addLimitForCategory(row)" title="Definir limite">+</button>
            }
          </div>
        </div>
      }

      @if (!categoryRows().length) {
        <div class="cat-empty">Nenhuma categoria de despesa cadastrada.</div>
      }
    </div>

    <!-- Limits with no category spend (accounts/cards) -->
    @if (extraLimits().length) {
      <div class="cat-list" style="margin-top:1rem">
        <div class="cat-list__header"><span>Contas e cartões</span></div>
        @for (l of extraLimits(); track l.id) {
          <div class="cat-row">
            <div class="cat-icon">💳</div>
            <div class="cat-body">
              <div class="cat-name">{{ limitTitle(l) }}</div>
              <div class="cat-progress">
                <div class="progress-bar progress-bar--sm">
                  <div class="progress-bar__fill"
                       [style.width.%]="Math.min(100, l.usage_pct || 0)"
                       [class.fill--warning]="(l.usage_pct||0) >= (l.alert_pct||80)"
                       [class.fill--danger]="(l.usage_pct||0) >= 100">
                  </div>
                </div>
              </div>
            </div>
            <div class="cat-right">
              <div class="cat-spend">
                <span [class.over]="l.current_spend > l.amount">{{ l.current_spend | appCurrency }}</span>
                <span class="cat-of"> de {{ l.amount | appCurrency }}</span>
              </div>
              <button class="action-btn action-btn--edit" (click)="editLimit(l)" title="Editar">✎</button>
            </div>
          </div>
        }
      </div>
    }
  }

  <!-- Inline form (modal-style slide-in) -->
  @if (showForm) {
    <div class="form-overlay" (click)="cancelForm()">
      <div class="form-panel" (click)="$event.stopPropagation()">
        <div class="form-panel__header">
          <span>{{ editing ? 'Editar Limite' : 'Definir Limite' }}</span>
          <button class="close-btn" (click)="cancelForm()">✕</button>
        </div>

        <form (ngSubmit)="save()" class="form">
          @if (!form.category_id && !form.account_id && !form.credit_card_id) {
            <div class="form-group">
              <label>Tipo</label>
              <select [(ngModel)]="form.limitType" name="limitType" class="input">
                <option value="global">Global</option>
                <option value="category">Categoria</option>
                <option value="account">Conta</option>
                <option value="card">Cartão</option>
              </select>
            </div>
            @if (form.limitType === 'category') {
              <div class="form-group">
                <label>Categoria</label>
                <select [(ngModel)]="form.category_id" name="cat" class="input">
                  <option value="">Selecione</option>
                  @for (c of categories(); track c.id) {
                    <option [value]="c.id">{{ c.icon }} {{ c.name }}</option>
                  }
                </select>
              </div>
            }
            @if (form.limitType === 'account') {
              <div class="form-group">
                <label>Conta</label>
                <select [(ngModel)]="form.account_id" name="acc" class="input">
                  @for (a of accounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </div>
            }
            @if (form.limitType === 'card') {
              <div class="form-group">
                <label>Cartão</label>
                <select [(ngModel)]="form.credit_card_id" name="card" class="input">
                  @for (c of cards(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
            }
          } @else {
            <div class="form-cat-preview">
              @if (formCategoryPreview()) {
                <div class="cat-icon">{{ formCategoryPreview()!.icon }}</div>
                <strong>{{ formCategoryPreview()!.name }}</strong>
              } @else {
                <strong>{{ editing ? limitTitle(editing) : 'Limite' }}</strong>
              }
            </div>
          }

          <div class="form-group">
            <label>Valor limite (R$)</label>
            <input [(ngModel)]="form.amount" name="amount" type="text" inputmode="decimal" appMoneyMask class="input" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Período</label>
              <select [(ngModel)]="form.period" name="period" class="input">
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <div class="form-group">
              <label>Alertar em (%)</label>
              <input [(ngModel)]="form.alert_pct" name="alert_pct" type="number" min="1" max="100" class="input" />
            </div>
          </div>
          <div class="form-actions">
            @if (editing) {
              <button type="button" class="btn btn--danger-ghost" (click)="promptDelete(editing)">Excluir</button>
            }
            <button type="button" class="btn btn--ghost" (click)="cancelForm()">Cancelar</button>
            <button type="submit" class="btn btn--primary">Salvar</button>
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

</div>
  `,
  styles: [`
    .sl-page { max-width: 680px; margin: 0 auto; padding: 1.5rem 1rem; }

    /* Month nav */
    .month-nav { display: flex; align-items: center; justify-content: center; gap: 1.25rem; margin-bottom: 1.5rem; }
    .month-label { font-size: 1.05rem; font-weight: 700; color: #111; min-width: 140px; text-align: center; }
    .nav-btn { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #e5e7eb; background: #fff;
      font-size: 1.25rem; cursor: pointer; color: #374151; display: flex; align-items: center; justify-content: center;
      transition: all .12s; line-height: 1; }
    .nav-btn:hover:not(:disabled) { border-color: #9ca3af; }
    .nav-btn:disabled { opacity: .3; cursor: not-allowed; }

    /* Global panel */
    .global-panel { background: #fff; border-radius: .75rem; border: 1px solid #e5e7eb;
      padding: 1.25rem 1.25rem 1rem; margin-bottom: 1.25rem; }
    .global-panel--empty { }
    .global-panel__labels { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: .6rem; }
    .global-panel__title { font-size: .8rem; font-weight: 600; color: #9ca3af; letter-spacing: .05em; text-transform: uppercase; }
    .global-panel__val { font-size: .95rem; color: #374151; }
    .global-panel__val strong { font-size: 1.2rem; font-weight: 700; color: #dc2626; }
    .global-panel__val strong.over { color: #dc2626; }
    .global-panel__of { color: #9ca3af; font-size: .85rem; }
    .global-panel__meta { margin-top: .5rem; }
    .forecast-link { font-size: .75rem; color: #6366f1; cursor: pointer; }
    .edit-inline-btn { background: none; border: none; color: #9ca3af; cursor: pointer;
      font-size: .9rem; padding: 0 .2rem; vertical-align: middle; line-height: 1; }
    .edit-inline-btn:hover { color: #374151; }
    .add-global-btn { margin-top: .75rem; font-size: .78rem; color: #6366f1; background: none; border: none;
      cursor: pointer; font-weight: 600; padding: 0; }

    /* Progress bar */
    .progress-bar { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: visible;
      position: relative; margin-bottom: 0; }
    .progress-bar--sm { height: 6px; margin-top: .35rem; overflow: hidden; }
    .progress-bar--empty .progress-bar__fill { background: #e5e7eb; }
    .progress-bar__fill { height: 100%; background: #22c55e; border-radius: 4px; transition: width .3s ease; }
    .fill--warning { background: #f59e0b; }
    .fill--danger { background: #ef4444; }
    .progress-bar__today { position: absolute; top: -3px; width: 2px; height: 14px;
      background: #374151; border-radius: 1px; transform: translateX(-50%); }

    /* Category list */
    .cat-list { background: #fff; border-radius: .75rem; border: 1px solid #e5e7eb; overflow: hidden; }
    .cat-list__header { padding: .75rem 1.25rem; border-bottom: 1px solid #f3f4f6;
      font-size: .72rem; font-weight: 700; color: #9ca3af; letter-spacing: .06em; text-transform: uppercase; }

    .cat-row { display: flex; align-items: center; gap: .875rem; padding: .875rem 1.25rem;
      border-bottom: 1px solid #f9fafb; }
    .cat-row:last-child { border-bottom: none; }
    .cat-skel { gap: .875rem; }
    .cat-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 1rem; flex-shrink: 0; background: #fff;
      border: 1.5px solid #e5e7eb; }
    .cat-body { flex: 1; min-width: 0; }
    .cat-name { font-size: .875rem; font-weight: 600; color: #111; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .cat-progress { }
    .cat-right { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; }
    .cat-spend { font-size: .82rem; font-weight: 700; color: #374151; white-space: nowrap; text-align: right; }
    .cat-spend .over { color: #dc2626; }
    .cat-spend-only { font-size: .82rem; color: #6b7280; white-space: nowrap; }
    .cat-of { color: #9ca3af; font-weight: 400; }

    .action-btn { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #e5e7eb;
      background: #fff; cursor: pointer; font-size: .9rem; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; transition: all .12s; }
    .action-btn--add { color: #16a34a; border-color: #16a34a; font-size: 1.1rem; font-weight: 700; }
    .action-btn--add:hover { background: #f0fdf4; }
    .action-btn--edit { color: #9ca3af; }
    .action-btn--edit:hover { color: #374151; border-color: #9ca3af; }

    .cat-empty { text-align: center; color: #9ca3af; padding: 2rem; font-size: .875rem; }

    /* Skeleton */
    .skeleton-wrap { display: flex; flex-direction: column; gap: 0; background: #fff;
      border-radius: .75rem; border: 1px solid #e5e7eb; overflow: hidden; }
    .cat-skel { border-bottom: 1px solid #f9fafb; }
    .cat-skel__icon { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
    .skel-block { background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: .25rem; }
    @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }

    /* Form overlay */
    .form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1000;
      display: flex; align-items: center; justify-content: center; }
    .form-panel { background: #fff; border-radius: .875rem; width: 100%; max-width: 480px;
      padding: 1.5rem; box-shadow: 0 8px 32px rgba(0,0,0,.18); margin: 1rem; }
    .form-panel__header { display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.25rem; font-weight: 700; font-size: 1rem; }
    .close-btn { background: none; border: none; font-size: 1.1rem; color: #6b7280; cursor: pointer; }
    .form-cat-preview { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem;
      padding: .75rem; background: #f9fafb; border-radius: .5rem; }
    .form { display: flex; flex-direction: column; gap: .875rem; }
    .form-row { display: flex; gap: .875rem; }
    .form-group { display: flex; flex-direction: column; gap: .25rem; flex: 1; font-size: .82rem; color: #374151; font-weight: 600; }
    .input { padding: .5rem .75rem; border: 1.5px solid #e5e7eb; border-radius: .5rem; font-size: .875rem;
      outline: none; transition: border .12s; }
    .input:focus { border-color: #6366f1; }
    .form-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: .25rem; }
    .btn { padding: .45rem 1rem; border-radius: .5rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 600; }
    .btn--primary { background: #16a34a; color: #fff; }
    .btn--primary:hover { background: #15803d; }
    .btn--ghost { background: #f3f4f6; color: #374151; }
    .btn--danger-ghost { background: none; color: #dc2626; margin-right: auto; }
    /* ══ DARK THEME ════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .global-panel,
    :host-context([data-theme="dark"]) .cat-list,
    :host-context([data-theme="dark"]) .skeleton-wrap { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .nav-btn,
    :host-context([data-theme="dark"]) .action-btn { background: #161c28 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .nav-btn:hover,
    :host-context([data-theme="dark"]) .action-btn:hover { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .month-label { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .panel-label,
    :host-context([data-theme="dark"]) .cat-list__header { border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .cat-row { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .cat-icon { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .cat-name { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .progress-bar { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .form-panel { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .form-panel h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .form-section { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .input { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .input:focus { border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .btn--ghost { background: #1e2638 !important; color: #c5cdd9 !important; }

  `]
})
export class SpendingLimitsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  Math = Math;

  // Month navigation
  private _year  = new Date().getFullYear();
  private _month = new Date().getMonth(); // 0-based
  monthLabel   = signal('');
  loading      = signal(true);
  showForecast = false;

  // Data
  limits     = signal<any[]>([]);
  categories = signal<any[]>([]);
  accounts   = signal<any[]>([]);
  cards      = signal<any[]>([]);
  catSpend   = signal<any[]>([]); // from /reports/categories

  // Form
  showForm = false;
  editing: any = null;
  form: any = { limitType: 'global', category_id: '', account_id: '', credit_card_id: '',
                amount: null, period: 'monthly', alert_pct: 80 };

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  // Derived
  globalLimit = computed(() => this.limits().find(l => !l.category_id && !l.account_id && !l.credit_card_id) ?? null);

  totalSpend = computed(() => this.catSpend().reduce((s: number, c: any) => s + (c.total ?? 0), 0));

  todayPct = computed(() => {
    const now = new Date();
    if (now.getFullYear() !== this._year || now.getMonth() !== this._month) return -1;
    const lastDay = new Date(this._year, this._month + 1, 0).getDate();
    return (now.getDate() / lastDay) * 100;
  });

  isCurrentMonth = computed(() => {
    const now = new Date();
    return this._year === now.getFullYear() && this._month === now.getMonth();
  });

  // All category rows: merge catSpend + category limits
  categoryRows = computed(() => {
    const catLimits = this.limits().filter(l => !!l.category_id);
    const spend = this.catSpend();
    // Show ALL expense categories, not just those with transactions
    const cats = this.categories().filter(c => c.type === 'expense');

    return cats.map(cat => {
      const spendEntry = spend.find((s: any) => s.category_id === cat.id);
      const limit = catLimits.find(l => l.category_id === cat.id) ?? null;
      const spendAmt = spendEntry?.total ?? 0;
      return {
        categoryId: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        spend: spendAmt,
        limit,
        usagePct: limit && limit.amount > 0 ? Math.min((spendAmt / limit.amount) * 100, 200) : 0,
      };
    }).sort((a, b) => {
      // Categories with limits first, then sort by spend descending
      if (a.limit && !b.limit) return -1;
      if (!a.limit && b.limit) return 1;
      return b.spend - a.spend;
    });
  });

  // Limits for accounts/cards (not categories)
  extraLimits = computed(() =>
    this.limits().filter(l => (l.account_id || l.credit_card_id))
  );

  formCategoryPreview = computed(() => {
    if (!this.form.category_id) return null;
    return this.categories().find(c => c.id === this.form.category_id) ?? null;
  });

  ngOnInit(): void {
    this.updateMonthLabel();
    this.api.get<any>('/categories').subscribe(r => this.categories.set(r.data ?? []));
    this.api.get<any>('/accounts').subscribe(r => this.accounts.set(r.data ?? []));
    this.api.get<any>('/credit-cards').subscribe(r => this.cards.set(r.data ?? []));
    this.loadMonth();
  }

  private updateMonthLabel(): void {
    this.monthLabel.set(`${PT_MONTHS[this._month]} ${this._year}`);
  }

  private monthStr(): string {
    return `${this._year}-${String(this._month + 1).padStart(2, '0')}`;
  }

  private monthRange(): { from: string; to: string } {
    const from = `${this._year}-${String(this._month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(this._year, this._month + 1, 0).getDate();
    const to = `${this._year}-${String(this._month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  }

  loadMonth(): void {
    this.loading.set(true);
    const { from, to } = this.monthRange();
    forkJoin({
      limits: this.api.get<any>(`/spending-limits?month=${this.monthStr()}`).pipe(catchError(() => of({ data: [] }))),
      spend:  this.api.get<any>(`/reports/categories?from=${from}&to=${to}&type=expense`).pipe(catchError(() => of({ data: [] }))),
    }).subscribe(({ limits, spend }) => {
      this.limits.set(limits.data ?? []);
      this.catSpend.set(spend.data ?? []);
      this.loading.set(false);
    });
  }

  prevMonth(): void {
    if (this._month === 0) { this._month = 11; this._year--; }
    else { this._month--; }
    this.updateMonthLabel();
    this.loadMonth();
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    if (this._month === 11) { this._month = 0; this._year++; }
    else { this._month++; }
    this.updateMonthLabel();
    this.loadMonth();
  }

  // Form helpers
  addGlobalLimit(): void {
    this.editing = null;
    this.form = { limitType: 'global', category_id: '', account_id: '', credit_card_id: '', amount: null, period: 'monthly', alert_pct: 80 };
    this.showForm = true;
  }

  addLimitForCategory(row: any): void {
    this.editing = null;
    this.form = { limitType: 'category', category_id: row.categoryId, account_id: '', credit_card_id: '', amount: null, period: 'monthly', alert_pct: 80 };
    this.showForm = true;
  }

  editLimit(l: any): void {
    this.editing = l;
    let limitType = 'global';
    if (l.category_id) limitType = 'category';
    else if (l.account_id) limitType = 'account';
    else if (l.credit_card_id) limitType = 'card';
    this.form = { ...l, limitType,
      category_id: l.category_id ?? '', account_id: l.account_id ?? '',
      credit_card_id: l.credit_card_id ?? '' };
    this.showForm = true;
  }

  cancelForm(): void { this.showForm = false; this.editing = null; }

  save(): void {
    const payload: any = { amount: this.form.amount, period: this.form.period, alert_pct: this.form.alert_pct || 80 };
    if (this.form.limitType === 'category' && this.form.category_id) payload.category_id = this.form.category_id;
    if (this.form.limitType === 'account' && this.form.account_id) payload.account_id = this.form.account_id;
    if (this.form.limitType === 'card' && this.form.credit_card_id) payload.credit_card_id = this.form.credit_card_id;

    const req = this.editing
      ? this.api.put<any>(`/spending-limits/${this.editing.id}`, payload)
      : this.api.post<any>('/spending-limits', payload);

    req.subscribe(() => {
      this.toast.success('Limite salvo!');
      this.cancelForm();
      this.loadMonth();
    });
  }

  promptDelete(l: any): void {
    this.confirmItem.set({
      msg: `Excluir o limite <strong>${this.limitTitle(l)}</strong>?`,
      action: () => {
        this.api.delete(`/spending-limits/${l.id}`).subscribe(() => {
          this.toast.success('Limite excluído.');
          this.loadMonth();
        });
      }
    });
    this.cancelForm();
  }

  doDelete(): void {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }

  limitTitle(l: any): string {
    if (l.category_id) return this.categories().find(c => c.id === l.category_id)?.name ?? 'Categoria';
    if (l.account_id)  return this.accounts().find(a => a.id === l.account_id)?.name ?? 'Conta';
    if (l.credit_card_id) return this.cards().find(c => c.id === l.credit_card_id)?.name ?? 'Cartão';
    return 'Limite global';
  }
}
