import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-tags-report',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>Relatorio por Tags</h1>
      <div class="header-actions">
        <input type="month" [(ngModel)]="month" (ngModelChange)="load()" class="input" />
        @if (rows().length > 0) {
          <button class="btn btn--outline btn--sm" (click)="exportCSV()">CSV</button>
          <button class="btn btn--outline btn--sm" (click)="exportExcel()">Excel</button>
        }
      </div>
    </div>

    @if (rows().length === 0) {
      <!-- AC-RL-20: CTA contextual quando sem tags -->
      <div class="cta-card">
        <div class="cta-card__icon">🏷️</div>
        <div class="cta-card__body">
          <strong>Voce ainda nao usa tags nos lancamentos!</strong>
          <p>
            Tags permitem agrupar lancamentos por projeto, cliente ou objetivo financeiro.
            Por exemplo: <em>viagem</em>, <em>airbnb</em>, <em>freelance</em>.
          </p>
          <p>Adicione tags ao criar ou editar um lancamento e os totais aparecerao aqui.</p>
          <a routerLink="/transactions/new" class="btn btn--primary btn--sm">+ Criar lancamento com tag</a>
        </div>
      </div>
    } @else {
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Tag</th>
              <th class="num">Qtd</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.tag) {
              <tr>
                <td>
                  <span class="badge" [style.background]="row.color || '#6366f1'">{{ row.tag }}</span>
                </td>
                <td class="num">{{ row.count }}</td>
                <td class="num">{{ row.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: .75rem; }
    .page-header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }
    .header-actions { display: flex; gap: .5rem; align-items: center; }
    .input { padding: .35rem .65rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .82rem; }
    .cta-card {
      display: flex; gap: 1.25rem; align-items: flex-start;
      background: #eef2ff; border: 1px solid #a5b4fc; border-radius: .5rem;
      padding: 1.5rem; max-width: 600px;
    }
    .cta-card__icon { font-size: 2.5rem; flex-shrink: 0; }
    .cta-card__body { display: flex; flex-direction: column; gap: .5rem; }
    .cta-card__body strong { font-size: 1rem; color: #111; }
    .cta-card__body p { margin: 0; color: #4b5563; font-size: .875rem; }
    .cta-card__body em { font-style: normal; font-weight: 600; color: #6366f1; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table th.num { text-align: right; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; }
    .table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .badge { padding: .2rem .6rem; border-radius: 9999px; color: #fff; font-size: .78rem; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--outline { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .btn--outline:hover { border-color: #6366f1; color: #6366f1; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
  `]
})
export class TagsReportComponent implements OnInit {
  private api = inject(ApiService);
  rows = signal<any[]>([]);

  month = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  })();

  ngOnInit() { this.load(); }

  load() {
    const [y, m] = this.month.split('-');
    const from = `${y}-${m}-01`;
    const to   = `${y}-${m}-31`;
    // Tags are not yet in a dedicated endpoint — derive from transactions
    this.api.get<any>('/transactions', { date_from: from, date_to: to, limit: 500 }).subscribe(r => {
      const txs: any[] = r.data ?? [];
      const map = new Map<string, { tag: string; color: string; count: number; total: number }>();
      for (const tx of txs) {
        for (const tag of (tx.tags ?? [])) {
          const k = tag.id;
          if (!map.has(k)) map.set(k, { tag: tag.name, color: tag.color ?? '#6366f1', count: 0, total: 0 });
          const e = map.get(k)!;
          e.count++;
          e.total += tx.type === 'expense' ? tx.amount : 0;
        }
      }
      this.rows.set([...map.values()].sort((a, b) => b.total - a.total));
    });
  }

  exportCSV() {
    const [y, m] = this.month.split('-');
    window.open(`/api/v1/reports/export/csv?report=tags&from=${y}-${m}-01&to=${y}-${m}-31`, '_blank');
  }
  exportExcel() {
    const [y, m] = this.month.split('-');
    window.open(`/api/v1/reports/export/excel?report=tags&from=${y}-${m}-01&to=${y}-${m}-31`, '_blank');
  }
}
