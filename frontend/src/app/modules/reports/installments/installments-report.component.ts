import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-installments-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header"><h1>Parcelamentos Ativos</h1></div>
    <div class="card">
      <table class="table">
        <thead>
          <tr><th>Descrição</th><th>Parcela</th><th>Valor/Parcela</th><th>Total</th><th>Próximo venc.</th></tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr>
              <td>{{ row.description }}</td>
              <td>{{ row.installment_number }}/{{ row.installment_count }}</td>
              <td>R$ {{ row.amount | number:'1.2-2' }}</td>
              <td>R$ {{ (row.amount * row.installment_count) | number:'1.2-2' }}</td>
              <td>{{ row.next_due }}</td>
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
    .page-header { margin-bottom: 1rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; font-size: .875rem; }
    .empty { text-align: center; color: #9ca3af; }
  `]
})
export class InstallmentsReportComponent implements OnInit {
  private api = inject(ApiService);
  rows = signal<any[]>([]);
  ngOnInit() { this.api.get<any>('/reports/installments').subscribe(r => this.rows.set(r.data ?? [])); }
}
