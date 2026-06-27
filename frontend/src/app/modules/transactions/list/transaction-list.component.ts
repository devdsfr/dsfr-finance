import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ImportOrganizzeComponent } from '../../import-organizze/import-organizze.component';

interface Transaction {
  id: string; description: string; amount: number; type: string;
  date: string; paid: boolean; ignored: boolean;
  category?: { name: string; color?: string };
  tags?: { id: string; name: string; color?: string }[];
}

interface DayGroup {
  date: string;
  label: string;
  items: Transaction[];
}

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ImportOrganizzeComponent],
  template: `
    <!-- Overdue banner (AC-UX-01 / AC-UX-02) -->
    @if (overdueCount() > 0) {
      <div class="overdue-banner">
        <span class="overdue-banner__msg">
          ⚠️ Você tem <strong>{{ overdueCount() }}</strong>
          lançamento{{ overdueCount() > 1 ? 's' : '' }} vencido{{ overdueCount() > 1 ? 's' : '' }} não pago{{ overdueCount() > 1 ? 's' : '' }}.
        </span>
        <div class="overdue-banner__actions">
          <button class="btn btn--sm btn--white" (click)="markAllPaid()">✓ Marcar todos como pago</button>
          <button class="btn btn--sm btn--ghost-white" (click)="ignoreAll()">Ignorar todos</button>
        </div>
      </div>
    }

    <!-- Month navigator + New button -->
    <div class="month-nav">
      <button class="month-nav__arrow" (click)="changeMonth(-1)">&#8249;</button>
      <span class="month-nav__label">{{ monthLabel() }}</span>
      <button class="month-nav__arrow" (click)="changeMonth(1)">&#8250;</button>
      <div class="month-nav__actions">
        <a routerLink="/transactions/new" class="btn btn--primary btn--sm">+ Novo lancamento</a>
        <app-import-organizze (imported)="load()"></app-import-organizze>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input [(ngModel)]="search" placeholder="Buscar..." (ngModelChange)="load()" class="filter-input" />
      <select [(ngModel)]="filterType" (ngModelChange)="load()" class="filter-select">
        <option value="">Todos os tipos</option>
        <option value="expense">Despesas</option>
        <option value="income">Receitas</option>
        <option value="transfer">Transferencias</option>
      </select>
      <select [(ngModel)]="filterPaid" (ngModelChange)="load()" class="filter-select">
        <option value="">Todos</option>
        <option value="false">Nao pagos</option>
        <option value="true">Pagos</option>
      </select>
    </div>

    <!-- Grouped list -->
    <div class="tx-board">
      @if (loading()) {
        <div class="skel-list">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="skel-tx-row">
              <span class="skel skel--circle"></span>
              <span class="skel skel--line"></span>
              <span class="skel skel--amount"></span>
            </div>
          }
        </div>
      } @else if (groups().length === 0) {
        <div class="empty-state">Nenhum lancamento em {{ monthLabel() }}.</div>
      } @else {
        @for (group of groups(); track group.date) {
          <div class="day-header">
            <span class="day-header__label">{{ group.label }}</span>
            <span class="day-header__income">{{ groupIncome(group) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
            <span class="day-header__expense">{{ groupExpense(group) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
          </div>
          @for (tx of group.items; track tx.id) {
            <div class="tx-row" [class.tx-row--paid]="tx.paid" [class.tx-row--ignored]="tx.ignored">
              <span class="tx-bar"
                [class.tx-bar--income]="tx.type==='income'"
                [class.tx-bar--transfer]="tx.type==='transfer'"></span>

              <div class="tx-main">
                <span class="cat-dot"
                  [style.background]="tx.category?.color || '#d1d5db'"
                  [title]="tx.category?.name || ''"></span>
                <div class="tx-desc">
                  <span class="tx-name" [class.tx-name--ignored]="tx.ignored">{{ tx.description }}</span>
                  <div class="tx-meta">
                    @if (tx.category) {
                      <span class="chip">{{ tx.category.name }}</span>
                    }
                    @for (tag of tx.tags; track tag.id) {
                      <span class="chip chip--tag" [style.background]="tag.color || '#8b5cf6'">{{ tag.name }}</span>
                    }
                    @if (tx.paid) { <span class="chip chip--paid">pago</span> }
                  </div>
                </div>
              </div>

              <span class="tx-amount"
                [class.tx-amount--income]="tx.type==='income'"
                [class.tx-amount--ignored]="tx.ignored">
                {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.amount | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
              </span>

              @if (!tx.ignored) {
                <button class="pay-toggle" [class.pay-toggle--paid]="tx.paid"
                  (click)="togglePaid(tx)"
                  [title]="tx.paid ? 'Clique para marcar como não pago' : 'Clique para marcar como pago'">
                  {{ tx.paid ? '✓' : '👍' }}
                </button>
              }

              <div class="tx-actions">
                <a [routerLink]="['/transactions', tx.id, 'edit']" class="act" title="Editar">&#9998;</a>
                <button class="act" (click)="duplicate(tx)" title="Duplicar">&#10697;</button>
                <button class="act act--del" (click)="deleteTx(tx)" title="Excluir">&#10005;</button>
              </div>
            </div>
          }
        }
      }
    </div>

    <!-- Spacer for fixed footer -->
    <div style="height:68px"></div>

    <!-- Fixed balance footer -->
    <div class="balance-footer">
      <div class="balance-item">
        <span class="balance-item__label">Saldo atual</span>
        <span class="balance-item__value" [class.neg]="currentBalance() < 0">
          {{ currentBalance() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
        </span>
      </div>
      <div class="balance-divider"></div>
      <div class="balance-item">
        <span class="balance-item__label">Saldo previsto</span>
        <span class="balance-item__value" [class.neg]="projectedBalance() < 0">
          {{ projectedBalance() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .overdue-banner {
      background: #d97706; color: #fff; border-radius: .5rem;
      padding: .7rem 1rem; display: flex; align-items: center;
      justify-content: space-between; gap: 1rem; flex-wrap: wrap;
      margin-bottom: 1rem; font-size: .875rem;
    }
    .overdue-banner__msg strong { font-weight: 700; }
    .overdue-banner__actions { display: flex; gap: .5rem; }

    .month-nav {
      display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem;
    }
    .month-nav__arrow {
      width: 28px; height: 28px; border-radius: 50%;
      border: 1px solid #d1d5db; background: #fff; cursor: pointer;
      font-size: 1rem; color: #374151; line-height: 1;
      transition: background .12s;
    }
    .month-nav__arrow:hover { background: #f3f4f6; }
    .month-nav__label {
      font-size: 1rem; font-weight: 600; color: #111;
      min-width: 150px; text-align: center;
    }
    .month-nav__actions { margin-left: auto; }

    .filters { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filter-input, .filter-select {
      padding: .35rem .65rem; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .82rem; color: #374151; background: #fff;
    }
    .filter-input { min-width: 160px; }

    .tx-board {
      background: #fff; border-radius: .5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); overflow: hidden;
    }

    .day-header {
      display: flex; align-items: center; gap: .75rem;
      background: #f8fafc; padding: .375rem 1rem;
      border-bottom: 1px solid #e5e7eb; font-size: .75rem;
    }
    .day-header__label { font-weight: 600; color: #374151; flex: 1; }
    .day-header__income { color: #16a34a; font-weight: 600; }
    .day-header__expense { color: #dc2626; font-weight: 600; }

    .tx-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .6rem 1rem; border-bottom: 1px solid #f3f4f6;
      transition: background .1s;
    }
    .tx-row:hover { background: #fafafa; }
    .tx-row:hover .tx-actions { opacity: 1; }
    .tx-row:last-child { border-bottom: none; }
    .tx-row--paid { opacity: .6; }
    .tx-row--ignored { opacity: .4; }

    .tx-bar { width: 3px; height: 34px; border-radius: 2px; background: #ef4444; flex-shrink: 0; }
    .tx-bar--income { background: #22c55e; }
    .tx-bar--transfer { background: #6366f1; }

    .tx-main { display: flex; align-items: center; gap: .55rem; flex: 1; min-width: 0; }
    .cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

    .tx-desc { min-width: 0; }
    .tx-name {
      font-size: .88rem; font-weight: 500; color: #111;
      display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tx-name--ignored { text-decoration: line-through; color: #9ca3af; }
    .tx-meta { display: flex; gap: .25rem; margin-top: .12rem; flex-wrap: wrap; }

    .chip { font-size: .67rem; padding: .08rem .38rem; border-radius: 9999px; background: #e5e7eb; color: #374151; }
    .chip--tag { color: #fff; }
    .chip--paid { background: #dcfce7; color: #15803d; }

    .tx-amount { font-size: .92rem; font-weight: 600; color: #dc2626; white-space: nowrap; flex-shrink: 0; }
    .tx-amount--income { color: #16a34a; }
    .tx-amount--ignored { color: #9ca3af !important; }

    .tx-actions { display: flex; gap: .15rem; flex-shrink: 0; opacity: 0; transition: opacity .12s; }
    .act {
      width: 26px; height: 26px; border-radius: .25rem;
      border: none; background: none; cursor: pointer;
      font-size: .78rem; color: #6b7280;
      display: flex; align-items: center; justify-content: center; text-decoration: none;
    }
    .act:hover { background: #f3f4f6; color: #111; }
    .act--pay:hover { background: #dcfce7; color: #16a34a; }
    .act--del:hover { background: #fee2e2; color: #dc2626; }

    .pay-toggle {
      font-size: .85rem; border: 1px solid #d1d5db; background: #fff; cursor: pointer;
      border-radius: 50%; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; opacity: 0.25; transition: opacity .15s, transform .1s;
      padding: 0;
    }
    .tx-row:hover .pay-toggle { opacity: 1; }
    .pay-toggle:hover { transform: scale(1.15); }
    .pay-toggle--paid {
      opacity: 1 !important; background: #dcfce7; border-color: #16a34a;
      color: #16a34a; font-size: 1rem; font-weight: 700;
    }
    .pay-toggle--paid:hover { background: #fef2f2; border-color: #dc2626; color: #dc2626; }

    .empty-state { padding: 3rem; text-align: center; color: #9ca3af; font-size: .875rem; }

    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .skel {
      display: inline-block; border-radius: .375rem;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 800px 100%;
      animation: shimmer 1.4s infinite;
    }
    .skel-list { padding: .5rem 0; }
    .skel-tx-row { display: flex; align-items: center; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid #f3f4f6; }
    .skel--circle { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
    .skel--line   { flex: 1; height: 1rem; }
    .skel--amount { width: 80px; height: 1rem; flex-shrink: 0; }

    .balance-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 56px; background: #fff; border-top: 1px solid #e5e7eb;
      display: flex; align-items: center; justify-content: flex-end;
      padding: 0 2rem; gap: 2rem;
      box-shadow: 0 -2px 8px rgba(0,0,0,.06); z-index: 90;
    }
    .balance-item { display: flex; flex-direction: column; align-items: flex-end; }
    .balance-item__label { font-size: .68rem; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; }
    .balance-item__value { font-size: .97rem; font-weight: 700; color: #111; }
    .balance-item__value.neg { color: #dc2626; }
    .balance-divider { width: 1px; height: 30px; background: #e5e7eb; }

    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--primary:hover { background: #256330; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
    .btn--white { background: rgba(255,255,255,.9); color: #92400e; }
    .btn--ghost-white { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.55); }
  `]
})
export class TransactionListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  transactions = signal<Transaction[]>([]);
  loading = signal(false);
  overdueCount = signal(0);
  currentBalance = signal(0);
  projectedBalance = signal(0);

  year = signal(new Date().getFullYear());
  month = signal(new Date().getMonth() + 1);

  search = '';
  filterType = '';
  filterPaid = '';

  private readonly MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  monthLabel = computed(() => `${this.MONTHS[this.month()-1]} ${this.year()}`);

  groups = computed<DayGroup[]>(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of this.transactions()) {
      const d = (tx.date ?? '').slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(tx);
    }
    const sorted = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return sorted.map(date => {
      const parts = date.split('-');
      return { date, label: `${parts[2]}/${parts[1]}/${parts[0]}`, items: map.get(date)! };
    });
  });

  groupIncome(g: DayGroup): number {
    return g.items.filter(t => t.type === 'income' && !t.ignored).reduce((s, t) => s + t.amount, 0);
  }
  groupExpense(g: DayGroup): number {
    return g.items.filter(t => t.type === 'expense' && !t.ignored).reduce((s, t) => s + t.amount, 0);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const y = this.year(), m = this.month();
    const from = `${y}-${String(m).padStart(2,'0')}-01`;
    const to   = new Date(y, m, 0).toISOString().slice(0, 10); // último dia real do mês
    const params: any = { date_from: from, date_to: to, limit: 200 };
    if (this.search) params['search'] = this.search;
    if (this.filterType) params['type'] = this.filterType;
    if (this.filterPaid !== '') params['paid'] = this.filterPaid;

    this.api.get<any>('/transactions', params).subscribe({
      next: res => {
        this.transactions.set(res.data ?? []);
        this.overdueCount.set(res.overdue_count ?? 0);
        this.loading.set(false);
        this.calcBalance();
      },
      error: () => this.loading.set(false)
    });
  }

  private calcBalance(): void {
    const txs = this.transactions();
    const paid = txs.filter(t => t.paid && !t.ignored);
    const inc = paid.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = paid.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    this.currentBalance.set(inc - exp);
    const all = txs.filter(t => !t.ignored);
    const ai = all.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const ae = all.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    this.projectedBalance.set(ai - ae);
  }

  changeMonth(delta: number): void {
    let m = this.month() + delta;
    let y = this.year();
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    this.month.set(m);
    this.year.set(y);
    this.load();
  }

  togglePaid(tx: Transaction): void {
    if (tx.paid) {
      this.api.patch<any>(`/transactions/${tx.id}/unpay`).subscribe(res => {
        tx.paid = false;
        this.toast.success(res.toast ?? 'Marcado como não pago.');
        this.overdueCount.update(c => c + 1);
        this.calcBalance();
      });
    } else {
      this.api.patch<any>(`/transactions/${tx.id}/pay`).subscribe(res => {
        tx.paid = true;
        this.toast.success(res.toast ?? 'Marcado como pago!');
        this.overdueCount.update(c => Math.max(0, c - 1));
        this.calcBalance();
      });
    }
  }

  markPaid(tx: Transaction): void {
    this.api.patch<any>(`/transactions/${tx.id}/pay`).subscribe(res => {
      tx.paid = true;
      this.toast.success(res.toast ?? 'Marcado como pago!');
      this.overdueCount.update(c => Math.max(0, c - 1));
      this.calcBalance();
    });
  }

  markAllPaid(): void {
    this.api.post<any>('/transactions/mark-all-paid', {}).subscribe(res => {
      this.toast.success(res.toast ?? 'Lancamentos pagos!');
      this.overdueCount.set(0);
      this.load();
    });
  }

  ignoreAll(): void {
    this.api.post<any>('/transactions/ignore-all', {}).subscribe(res => {
      this.toast.info(res.toast ?? 'Lancamentos ignorados.');
      this.overdueCount.set(0);
      this.load();
    });
  }

  duplicate(tx: Transaction): void {
    this.router.navigate(['/transactions/new'], { queryParams: { duplicate: tx.id } });
  }

  deleteTx(tx: Transaction): void {
    if (!confirm(`Excluir "${tx.description}"?`)) return;
    this.api.delete(`/transactions/${tx.id}`).subscribe(() => {
      this.toast.success('Lancamento excluido.');
      this.load();
    });
  }
}
