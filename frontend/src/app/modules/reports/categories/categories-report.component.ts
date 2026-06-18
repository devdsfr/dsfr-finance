import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-categories-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>Relatório por Categorias</h1>
      <div class="controls">
        <input type="month" [(ngModel)]="month" (change)="load()" class="input" />
        <button class="btn btn--outline" (click)="export('csv')">CSV</button>
        <button class="btn btn--outline" (click)="export('excel')">Excel</button>
      </div>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Categoria</th><th>Tipo</th><th>Qtd</th><th>Total</th><th>%</th></tr></thead>
        <tbody>
          @if (loading()) {
            @for (i of [1,2,3,4,5]; track i) {
              <tr>
                <td><span class="skel-block skel-p" style="width:90px;border-radius:9999px"></span></td>
                <td><span class="skel-block skel-p" style="width:60px"></span></td>
                <td><span class="skel-block skel-p" style="width:30px"></span></td>
                <td><span class="skel-block skel-p" style="width:80px"></span></td>
                <td><span class="skel-block skel-p" style="width:60px"></span></td>
              </tr>
            }
          }
          @for (row of rows(); track row.category) {
            <tr>
              <td>
                <span class="badge" [style.background]="row.color || '#6366f1'">{{ row.category }}</span>
              </td>
              <td>{{ row.type === 'expense' ? 'Despesa' : 'Receita' }}</td>
              <td>{{ row.count }}</td>
              <td>R$ {{ row.total | number:'1.2-2' }}</td>
              <td>
                <div class="bar-wrap"><div class="bar" [style.width]="pct(row.total) + '%'" [style.background]="row.color || '#6366f1'"></div></div>
                {{ pct(row.total) | number:'1.0-0' }}%
              </td>
            </tr>
          }
          @empty {
            <tr><td colspan="5" class="empty">Nenhum dado para o período.</td></tr>
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
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; font-size: .875rem; }
    .badge { padding: .2rem .6rem; border-radius: 9999px; color: #fff; font-size: .78rem; }
    .bar-wrap { width: 80px; background: #f3f4f6; border-radius: 9999px; height: 6px; display: inline-block; margin-right: .4rem; vertical-align: middle; }
    .bar { height: 6px; border-radius: 9999px; }
    .empty { text-align: center; color: #9ca3af; }
  `]
})
export class CategoriesReportComponent implements OnInit {
  private api = inject(ApiService);
  loading = signal(true);
  rows = signal<any[]>([]);
  month = new Date().toISOString().slice(0, 7);

  maxTotal = () => Math.max(...this.rows().map(r => r.total), 1);
  pct = (v: number) => Math.round((v / this.maxTotal()) * 100);

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    this.api.get<any>('/reports/categories', { month: this.month }).subscribe(r => { this.rows.set(r.data ?? []); this.loading.set(false); });
  }
  export(format: string) {
    this.api.download(`/reports/export/${format}`, { type: 'categories', month: this.month })
      .subscribe(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `categories.${format === 'csv' ? 'csv' : 'xlsx'}`; a.click(); });
  }
}
