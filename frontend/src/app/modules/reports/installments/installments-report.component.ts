import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { PlanService } from '../../../core/services/plan.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-installments-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Parcelamentos Ativos</h1>
      <div class="header-actions">
        <button class="btn btn--outline btn--sm" (click)="exportCSV()" title="Recurso Premium">{{ plan.isPremium() ? '' : '🔒 ' }}CSV</button>
        <button class="btn btn--outline btn--sm" (click)="exportExcel()" title="Recurso Premium">{{ plan.isPremium() ? '' : '🔒 ' }}Excel</button>
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
    .btn--outline:hover { border-color: #2e7736; color: #2e7736; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }
  
    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .card { background: #161c28 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) h1, :host-context([data-theme="dark"]) h2, :host-context([data-theme="dark"]) h3, :host-context([data-theme="dark"]) h4, :host-context([data-theme="dark"]) h5, :host-context([data-theme="dark"]) label, :host-context([data-theme="dark"]) strong, :host-context([data-theme="dark"]) b, :host-context([data-theme="dark"]) dt, :host-context([data-theme="dark"]) th { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) small, :host-context([data-theme="dark"]) .muted, :host-context([data-theme="dark"]) .sub, :host-context([data-theme="dark"]) .subtitle, :host-context([data-theme="dark"]) .desc, :host-context([data-theme="dark"]) .hint, :host-context([data-theme="dark"]) .label, :host-context([data-theme="dark"]) .caption, :host-context([data-theme="dark"]) .meta { color: #8393ad !important; }
    :host-context([data-theme="dark"]) thead th { background: #1e2638 !important; color: #8393ad !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) td, :host-context([data-theme="dark"]) tr { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) input, :host-context([data-theme="dark"]) select, :host-context([data-theme="dark"]) textarea { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .btn--outline { border-color: #2e7736 !important; color: #4ade80 !important; background: transparent !important; }
  `]
})
export class InstallmentsReportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  plan = inject(PlanService);
  loading = signal(true);
  rows = signal<any[]>([]);

  ngOnInit() {
    if (!this.plan.loaded()) this.plan.load();
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
    if (!this.plan.isPremium()) { this.toast.show('Exportar relatórios é um recurso Premium.', 'warning'); return; }
    window.open(`${environment.apiUrl}/reports/export/csv?report=installments`, '_blank');
  }
  exportExcel() {
    if (!this.plan.isPremium()) { this.toast.show('Exportar relatórios é um recurso Premium.', 'warning'); return; }
    window.open(`${environment.apiUrl}/reports/export/excel?report=installments`, '_blank');
  }
}
