import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-flow-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>Entradas x Saídas</h1>
      <div class="controls">
        <input type="month" [(ngModel)]="month" (change)="load()" class="input" />
        <button class="btn btn--outline" (click)="export('csv')">CSV</button>
        <button class="btn btn--outline" (click)="export('excel')">Excel</button>
      </div>
    </div>

    <div class="summary-cards">
      <div class="summary-card summary-card--income">
        <div class="summary-label">Total de Entradas</div>
        <div class="summary-value">R$ {{ totalIncome() | number:'1.2-2' }}</div>
      </div>
      <div class="summary-card summary-card--expense">
        <div class="summary-label">Total de Saídas</div>
        <div class="summary-value">R$ {{ totalExpense() | number:'1.2-2' }}</div>
      </div>
      <div class="summary-card" [class.summary-card--income]="balance() >= 0" [class.summary-card--expense]="balance() < 0">
        <div class="summary-label">Saldo do Período</div>
        <div class="summary-value">R$ {{ balance() | number:'1.2-2' }}</div>
      </div>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr>
        </thead>
        <tbody>
          @if (loading()) {
            @for (i of [1,2,3,4,5]; track i) {
              <tr>
                <td><span class="skel-block skel-p" style="width:70px"></span></td>
                <td><span class="skel-block skel-p" style="width:80px"></span></td>
                <td><span class="skel-block skel-p" style="width:80px"></span></td>
                <td><span class="skel-block skel-p" style="width:80px"></span></td>
              </tr>
            }
          }
          @for (row of rows(); track row.month) {
            <tr>
              <td>{{ row.month }}</td>
              <td class="income">R$ {{ row.income | number:'1.2-2' }}</td>
              <td class="expense">R$ {{ row.expense | number:'1.2-2' }}</td>
              <td [class.income]="row.balance >= 0" [class.expense]="row.balance < 0">R$ {{ row.balance | number:'1.2-2' }}</td>
            </tr>
          }
          @empty {
            <tr><td colspan="4" class="empty">Nenhum dado para o período.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: .5rem; }
    .controls { display: flex; gap: .5rem; align-items: center; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--outline { border: 1px solid #6366f1; color: #6366f1; background: none; }
    .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
    .summary-card { background: #fff; padding: 1rem 1.25rem; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); }
    .summary-card--income { border-left: 4px solid #22c55e; }
    .summary-card--expense { border-left: 4px solid #ef4444; }
    .summary-label { font-size: .8rem; color: #6b7280; }
    .summary-value { font-size: 1.5rem; font-weight: 700; margin-top: .25rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; font-size: .875rem; }
    .income { color: #22c55e; }
    .expense { color: #ef4444; }
    .empty { text-align: center; color: #9ca3af; }
  `]
})
export class FlowReportComponent implements OnInit {
  private api = inject(ApiService);
  loading = signal(true);
  rows = signal<any[]>([]);
  month = new Date().toISOString().slice(0, 7);

  totalIncome = () => this.rows().reduce((s, r) => s + (r.income || 0), 0);
  totalExpense = () => this.rows().reduce((s, r) => s + (r.expense || 0), 0);
  balance = () => this.totalIncome() - this.totalExpense();

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.get<any>('/reports/flow', { month: this.month }).subscribe(r => { this.rows.set(r.data ?? []); this.loading.set(false); });
  }

  export(format: string) {
    this.api.download(`/reports/export/${format}`, { type: 'flow', month: this.month })
      .subscribe(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `flow.${format === 'csv' ? 'csv' : 'xlsx'}`;
        a.click();
      });
  }
}
