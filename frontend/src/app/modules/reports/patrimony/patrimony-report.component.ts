import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-patrimony-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- AC-RL-22: Patrimony evolution report -->
    <div class="report-page">
      <div class="report-header">
        <h1>Evolução Patrimonial</h1>
        <div class="report-actions">
          <!-- AC-RL-21: Export -->
          <button class="btn btn--outline btn--sm" (click)="exportData('csv')">⬇ CSV</button>
          <button class="btn btn--outline btn--sm" (click)="exportData('excel')">⬇ Excel</button>
        </div>
      </div>
      <div class="filters">
        <input type="date" [(ngModel)]="from" (ngModelChange)="load()" class="input" />
        <input type="date" [(ngModel)]="to" (ngModelChange)="load()" class="input" />
      </div>

      <!-- Simple chart representation -->
      <div class="chart-area">
        @if (loading()) {
          <div class="skel-bars">
            @for (i of [1,2,3,4,5,6,7,8,9,10,11,12]; track i) {
              <div class="skel-bar-col">
                <div class="skel-block" style="width:32px;height:{{ 40 + i * 8 }}px;margin-bottom:.5rem"></div>
              </div>
            }
          </div>
        } @else if (points().length === 0) {
          <div class="empty">Nenhum dado para o período selecionado.</div>
        } @else {
          <div class="bar-chart">
            @for (p of points(); track p.month) {
              <div class="bar-col">
                <div class="bar-label">R$ {{ p.net_worth | number:'1.0-0' }}</div>
                <div class="bar"
                     [style.height.px]="barHeight(p.net_worth)"
                     [class.bar--positive]="p.net_worth >= 0"
                     [class.bar--negative]="p.net_worth < 0">
                </div>
                <div class="bar-month">{{ p.month }}</div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Data table -->
      <table class="table">
        <thead><tr><th>Mês</th><th>Patrimônio Líquido</th><th>Variação</th></tr></thead>
        <tbody>
          @if (loading()) {
            @for (i of [1,2,3,4,5]; track i) {
              <tr>
                <td><span class="skel-block skel-p" style="width:70px"></span></td>
                <td><span class="skel-block skel-p" style="width:90px"></span></td>
                <td><span class="skel-block skel-p" style="width:70px"></span></td>
              </tr>
            }
          }
          @for (p of points(); track p.month; let i = $index) {
            <tr>
              <td>{{ p.month }}</td>
              <td [class.text-green]="p.net_worth >= 0" [class.text-red]="p.net_worth < 0">
                R$ {{ p.net_worth | number:'1.2-2' }}
              </td>
              <td>
                @if (i > 0) {
                  <span [class.text-green]="variation(i) >= 0" [class.text-red]="variation(i) < 0">
                    {{ variation(i) >= 0 ? '+' : '' }}{{ variation(i) | number:'1.2-2' }}
                  </span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .report-page { }
    .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .report-actions { display: flex; gap: .5rem; }
    .filters { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .chart-area { background: #fff; border-radius: .5rem; padding: 1.5rem; margin-bottom: 1.5rem;
                  box-shadow: 0 1px 3px rgba(0,0,0,.07); min-height: 200px; }
    .bar-chart { display: flex; align-items: flex-end; gap: .75rem; height: 200px; }
    .bar-col { display: flex; flex-direction: column; align-items: center; gap: .25rem; flex: 1; }
    .bar-label { font-size: .65rem; color: #6b7280; }
    .bar { width: 100%; border-radius: .25rem .25rem 0 0; min-height: 4px; }
    .bar--positive { background: #22c55e; }
    .bar--negative { background: #ef4444; }
    .bar-month { font-size: .7rem; color: #9ca3af; }
    .skel-bars { display: flex; align-items: flex-end; gap: .75rem; height: 200px; }
    .skel-bar-col { display: flex; flex-direction: column; justify-content: flex-end; flex: 1; }
    .table { width: 100%; border-collapse: collapse; background: #fff; border-radius: .5rem; overflow: hidden; }
    .table th, .table td { padding: .75rem 1rem; text-align: left; border-bottom: 1px solid #f3f4f6; font-size: .875rem; }
    .table th { background: #f9fafb; font-weight: 600; }
    .text-green { color: #22c55e; }
    .text-red { color: #ef4444; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--outline { border: 1px solid #6366f1; color: #6366f1; background: none; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
    .empty { text-align: center; color: #9ca3af; padding: 2rem; }
  `]
})
export class PatrimonyReportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  from = `${new Date().getFullYear()}-01-01`;
  to = `${new Date().getFullYear()}-12-31`;
  loading = signal(true);
  points = signal<any[]>([]);

  maxAbs = 0;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<any>('/reports/patrimony', { from: this.from, to: this.to }).subscribe(res => {
      this.points.set(res.data ?? []);
      this.maxAbs = Math.max(...(res.data ?? []).map((p: any) => Math.abs(p.net_worth)), 1);
      this.loading.set(false);
    });
  }

  barHeight(val: number): number {
    return Math.max(4, (Math.abs(val) / this.maxAbs) * 160);
  }

  variation(i: number): number {
    const pts = this.points();
    return pts[i].net_worth - pts[i - 1].net_worth;
  }

  exportData(format: 'csv' | 'excel'): void {
    const path = format === 'csv' ? '/reports/export/csv' : '/reports/export/excel';
    this.api.download(path, { report: 'patrimony', from: this.from, to: this.to }).subscribe(blob => {
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `patrimony.${ext}`; a.click();
      URL.revokeObjectURL(url);
    });
  }
}
