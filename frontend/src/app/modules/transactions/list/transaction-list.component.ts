import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface Transaction {
  id: string; description: string; amount: number; type: string;
  date: string; paid: boolean; ignored: boolean;
  category?: { name: string; color?: string };
  tags?: { id: string; name: string; color?: string }[];
}

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <!-- AC-UX-01 / AC-UX-02: Overdue banner -->
    @if (overdueCount() > 0) {
      <div class="overdue-banner">
        <span>⚠️ Você tem <strong>{{ overdueCount() }}</strong> lançamentos vencidos não pagos.</span>
        <div class="overdue-banner__actions">
          <!-- AC-UX-01 -->
          <button class="btn btn--primary btn--sm" (click)="markAllPaid()">✓ Marcar todos como pago</button>
          <!-- AC-UX-02 -->
          <button class="btn btn--ghost btn--sm" (click)="ignoreAll()">Ignorar todos</button>
        </div>
      </div>
    }

    <div class="page-header">
      <h1>Lançamentos</h1>
      <a routerLink="/transactions/new" class="btn btn--primary">+ Novo lançamento</a>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input [(ngModel)]="filters.search" placeholder="Buscar..." (ngModelChange)="load()" class="input" />
      <select [(ngModel)]="filters.type" (ngModelChange)="load()" class="input">
        <option value="">Todos</option>
        <option value="expense">Despesas</option>
        <option value="income">Receitas</option>
        <option value="transfer">Transferências</option>
      </select>
      <select [(ngModel)]="filters.paid" (ngModelChange)="load()" class="input">
        <option value="">Todos</option>
        <option value="false">Não pagos</option>
        <option value="true">Pagos</option>
      </select>
      <input type="date" [(ngModel)]="filters.date_from" (ngModelChange)="load()" class="input" />
      <input type="date" [(ngModel)]="filters.date_to" (ngModelChange)="load()" class="input" />
    </div>

    <!-- Transaction list -->
    <div class="card">
      @for (tx of transactions(); track tx.id) {
        <div class="tx-row" [class.tx-row--paid]="tx.paid" [class.tx-row--ignored]="tx.ignored">
          <div class="tx-row__info">
            <span class="tx-row__desc">{{ tx.description }}</span>
            <div class="tx-row__meta">
              <span class="tx-row__date">{{ tx.date }}</span>
              @if (tx.category) {
                <span class="badge" [style.background]="tx.category.color || '#6366f1'">{{ tx.category.name }}</span>
              }
              <!-- AC-TG-04: tags visible in list -->
              @for (tag of tx.tags; track tag.id) {
                <span class="badge badge--tag" [style.background]="tag.color || '#8b5cf6'">{{ tag.name }}</span>
              }
            </div>
          </div>
          <div class="tx-row__amount" [class.tx-row__amount--income]="tx.type === 'income'">
            {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.amount | number:'1.2-2' }}
          </div>
          <div class="tx-row__actions">
            <!-- AC-UX-07: mark paid with immediate toast feedback -->
            @if (!tx.paid) {
              <button class="btn btn--sm btn--outline" (click)="markPaid(tx)" title="Marcar como pago">✓</button>
            }
            <a [routerLink]="['/transactions', tx.id, 'edit']" class="btn btn--sm btn--ghost" title="Editar">✎</a>
            <!-- AC-UX-06: duplicate -->
            <button class="btn btn--sm btn--ghost" (click)="duplicate(tx)" title="Duplicar">⧉</button>
            <button class="btn btn--sm btn--danger" (click)="delete(tx)" title="Excluir">✕</button>
          </div>
        </div>
      } @empty {
        <div class="empty">Nenhum lançamento encontrado.</div>
      }
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <button class="btn btn--sm" [disabled]="page() <= 1" (click)="changePage(-1)">‹</button>
      <span>Página {{ page() }} de {{ totalPages() }}</span>
      <button class="btn btn--sm" [disabled]="page() >= totalPages()" (click)="changePage(1)">›</button>
    </div>
  `,
  styles: [`
    .overdue-banner {
      background: #fef3c7; border: 1px solid #f59e0b; border-radius: .5rem;
      padding: .875rem 1.25rem; margin-bottom: 1rem;
      display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;
    }
    .overdue-banner__actions { display: flex; gap: .5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .filters { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .tx-row {
      display: flex; align-items: center; gap: 1rem; padding: .875rem 1.25rem;
      border-bottom: 1px solid #f3f4f6;
    }
    .tx-row--paid { opacity: .6; }
    .tx-row--ignored { opacity: .4; text-decoration: line-through; }
    .tx-row__info { flex: 1; }
    .tx-row__desc { font-weight: 500; }
    .tx-row__meta { display: flex; gap: .375rem; align-items: center; margin-top: .2rem; flex-wrap: wrap; }
    .tx-row__date { font-size: .78rem; color: #6b7280; }
    .badge {
      font-size: .7rem; padding: .1rem .45rem; border-radius: 9999px;
      color: #fff; white-space: nowrap;
    }
    .tx-row__amount { font-weight: 600; font-size: 1rem; white-space: nowrap; }
    .tx-row__amount--income { color: #22c55e; }
    .tx-row__actions { display: flex; gap: .25rem; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--primary { background: #6366f1; color: #fff; }
    .btn--outline { border: 1px solid #6366f1; color: #6366f1; background: none; }
    .btn--ghost { background: none; color: #374151; }
    .btn--danger { background: none; color: #ef4444; }
    .btn--sm { padding: .2rem .5rem; font-size: .78rem; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; }
    .empty { padding: 2rem; text-align: center; color: #9ca3af; }
  `]
})
export class TransactionListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  transactions = signal<Transaction[]>([]);
  overdueCount = signal(0);
  total = signal(0);
  page = signal(1);
  limit = 20;

  filters = { search: '', type: '', paid: '', date_from: '', date_to: '' };

  get totalPages(): () => number {
    return () => Math.max(1, Math.ceil(this.total() / this.limit));
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    const params = { ...this.filters, page: this.page(), limit: this.limit };
    this.api.get<any>('/transactions', params).subscribe(res => {
      this.transactions.set(res.data ?? []);
      this.total.set(res.total ?? 0);
      this.overdueCount.set(res.overdue_count ?? 0);
    });
  }

  // AC-UX-07: immediate feedback
  markPaid(tx: Transaction): void {
    this.api.patch<any>(`/transactions/${tx.id}/pay`).subscribe(res => {
      tx.paid = true;
      this.toast.success(res.toast ?? 'Marcado como pago!');
      this.overdueCount.update(c => Math.max(0, c - 1));
    });
  }

  // AC-UX-01
  markAllPaid(): void {
    this.api.post<any>('/transactions/mark-all-paid', {}).subscribe(res => {
      this.toast.success(res.toast ?? `${res.updated} lançamentos pagos!`);
      this.overdueCount.set(0);
      this.load();
    });
  }

  // AC-UX-02
  ignoreAll(): void {
    this.api.post<any>('/transactions/ignore-all', {}).subscribe(res => {
      this.toast.info(res.toast ?? `${res.updated} lançamentos ignorados.`);
      this.overdueCount.set(0);
      this.load();
    });
  }

  // AC-UX-06
  duplicate(tx: Transaction): void {
    this.api.post<any>(`/transactions/${tx.id}/duplicate`, {}).subscribe(() => {
      this.toast.success('Lançamento duplicado!');
      this.load();
    });
  }

  delete(tx: Transaction): void {
    if (!confirm(`Excluir "${tx.description}"?`)) return;
    this.api.delete(`/transactions/${tx.id}`).subscribe(() => {
      this.toast.success('Lançamento excluído.');
      this.load();
    });
  }

  changePage(delta: number): void {
    this.page.update(p => p + delta);
    this.load();
  }
}
                     