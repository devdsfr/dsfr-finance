import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-accounts-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- AC-RL-18: multi-account comparison; AC-RL-19: monthly consolidated balance -->
    <div class="report-page">
      <div class="report-header">
        <h1>Relatório de Contas</h1>
        <div class="report-actions">
          <button class="btn btn--outline btn--sm" (click)="exportData('csv')">⬇ CSV</button>
          <button class="btn btn--outline btn--sm" (click)="exportData('excel')">⬇ Excel</button>
        </div>
      </div>

      <div class="filters">
        <input type="date" [(ngModel)]="from" (ngModelChange)="load()" class="input" />
        <input type="date" [(ngModel)]="to" (ngModelChange)="load()" class="input" />
        <!-- AC-RL-18: multi-account filter -->
        <div class="account-selector">
          @for (acc of accounts(); track acc.id) {
            <label class="check-label">
              <input type="checkbox" [value]="acc.id"
                     [checked]="selectedAccounts.includes(acc.id)"
                     (change)="toggleAccount(acc.id)" />
              {{ acc.name }}
            </label>
          }
        </div>
      </div>

      <!-- AC-RL-19: Consolidated monthly balance table -->
      <div class="comparison-table">
        <table class="table">
          <thead>
            <tr>
              <th>Mês</th>
              @for (acc of visibleAccounts(); track acc) {
                <th>{{ acc }}</th>
              }
              <th>Consolidado</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr>
                  <td><span class="skel-block skel-p" style="width:70px"></span></td>
                  <td><span class="skel-block skel-p" style="width:80px"></span></td>
                  <td><span class="skel-block skel-p" style="width:80px"></span></td>
                </tr>
              }
            }
            @for (row of tableRows(); track row.month) {
              <tr>
                <td>{{ row.month }}</td>
                @for (acc of visibleAccounts(); track acc) {
                  <td [class.text-green]="row[acc] >= 0" [class.text-red]="row[acc] < 0">
                    {{ row[acc] | number:'1.2-2' }}
                  </td>
                }
                <td class="consolidated">{{ row.total | number:'1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .report-page {} .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .report-actions { display: flex; gap: .5rem; }
    .filters { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-start; margin-bottom: 1.5rem; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .account-selector { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
    .check-label { display: flex; align-items: center; gap: .3rem; font-size: .875rem; cursor: pointer; }
    .table { width: 100%; border-collapse: collapse; background: #fff; border-radius: .5rem; overflow: hidden; }
    .table th, .table td { padding: .6rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-size: .85rem; }
    .table th:first-child, .table td:first-child { text-align: left; }
    .table th { background: #f9fafb; font-weight: 600; }
    .text-green { color: #22c55e; } .text-red { color: #ef4444; }
    .consolidated { font-weight: 600; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--outline { border: 1px solid #6366f1; color: #6366f1; background: none; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
  `]
})
export class AccountsReportComponent implements OnInit {
  private api = inject(ApiService);

  from = `${new Date().getFullYear()}-01-01`;
  to = `${new Date().getFullYear()}-12-31`;
  loading = signal(true);
  accounts = signal<any[]>([]);
  selectedAccounts: string[] = [];
  data = signal<any[]>([]);

  ngOnInit(): void {
    this.api.get<any>('/accounts').subscribe(r => {
      this.accounts.set(r.data ?? []);
      this.selectedAccounts = (r.data ?? []).map((a: any) => a.id);
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.get<any>('/reports/accounts', {
      from: this.from, to: this.to, account_id: this.selectedAccounts
    }).subscribe(r => { this.data.set(r.data ?? []); this.loading.set(false); });
  }

  toggleAccount(id: string): void {
    if (this.selectedAccounts.includes(id))
      this.selectedAccounts = this.selectedAccounts.filter(a => a !== id);
    else this.selectedAccounts = [...this.selectedAccounts, id];
    this.load();
  }

  visibleAccounts(): string[] {
    const names = new Set<string>();
    this.data().forEach(d => names.add(d.account_name));
    return [...names];
  }

  tableRows(): any[] {
    const months = new Set<string>();
    this.data().forEach(d => months.add(d.month));
    return [...months].sort().map(month => {
      const row: any = { month, total: 0 };
      this.data().filter(d => d.month === month).forEach(d => {
        row[d.account_name] = (row[d.account_name] || 0) + d.balance;
        row.total += d.balance;
      });
      return row;
    });
  }

  exportData(fmt: string): void {
    const path = fmt === 'csv' ? '/reports/export/csv' : '/reports/export/excel';
    this.api.download(path, { report: 'accounts', from: this.from, to: this.to }).subscribe(blob => {
      const ext = fmt === 'csv' ? 'csv' : 'xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `accounts.${ext}`; a.click();
    });
  }
}
