import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-installments-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Parcelamentos Ativos</h1>
      <div class="header-actions">
        <button class="btn btn--outline btn--sm" (click)="exportCSV()">CSV</button>
        <button class="btn btn--outline btn--sm" (click)="exportExcel()">Excel</button>
      </div>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Descricao</th>
            <th>Cartao</th>
            <th class="num">Parcela</th>
            <th class="num">Valor/Parcela</th>
            <th class="num">Total Restante</th>
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            @for (i of [1,2,3,4,5]; track i) {
              <tr>
                <td><span class="skel-block skel-p" style="width:120px"></span></td>
                <td><span class="skel-block skel-p" style="width:70px"></span></td>
                <td class="num"><span class="skel-block skel-p" style="width:40px;margin-left:auto"></span></td>
                <td class="num"><span class="skel-block skel-p" style="width:70px;margin-left:auto"></span></td>
                <td class="num"><span class="skel-block skel-p" style="width:70px;margin-left:auto"></span></td>
              </tr>
            }
          }
          @for (row of rows(); track row.id) {
            <tr>
              <td>{{ row.description }}</td>
              <td>{{ row.card_name }}</td>
              <td class="num">{{ row.installment_number }}/{{ row.installment_total }}</td>
              <td class="num">{{ row.amount_per_part | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              <td class="num">{{ row.total_remaining | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
            </tr>
          }
          @empty {
            <tr><td colspan="5" class="empty">Nenhum parcelamento ativo encontrado.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .page-header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }
    .header-actions { display: flex; gap: .5rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table th.num { text-align: right; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; font-size: .875rem; }
    .table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .empty { text-align: center; color: #9ca3af; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; }
    .btn--outline { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .btn--outline:hover { border-color: #6366f1; color: #6366f1; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
  `]
})
export class InstallmentsReportComponent implements OnInit {
  private api = inject(ApiService);
  loading = signal(true);
  rows = signal<any[]>([]);

  ngOnInit() {
    this.api.get<any>('/reports/installments').subscribe(r => {
      const raw: any[] = r.data ?? [];
      // Normalise field names from backend model
      this.rows.set(raw.map(i => ({
        id: i.transaction_id ?? i.id,
        description: i.description,
        card_name: i.card_name ?? i.CardName ?? '',
        installment_number: i.installment_num ?? i.installment_number ?? 0,
        installment_total: i.installment_total ?? 0,
        amount_per_part: i.amount_per_part ?? i.amount ?? 0,
        total_remaining: i.total_remaining ?? 0,
      })));
      this.loading.set(false);
    });
  }

  exportCSV() {
    window.open(`${environment.apiUrl}/reports/export/csv?report=installments`, '_blank');
  }
  exportExcel() {
    window.open(`${environment.apiUrl}/reports/export/excel?report=installments`, '_blank');
  }
}
