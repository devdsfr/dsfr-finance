import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-tags-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showCta()) {
      <div class="cta-banner">
        <div class="cta-banner__icon">🏷️</div>
        <div class="cta-banner__body">
          <strong>Comece a usar tags nos seus lançamentos!</strong>
          <p>Tags permitem categorizar e filtrar lançamentos com mais flexibilidade. Nenhum lançamento com tag foi encontrado ainda.</p>
        </div>
      </div>
    }
    <div class="page-header"><h1>Relatório por Tags</h1></div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Tag</th><th>Qtd</th><th>Total</th></tr></thead>
        <tbody>
          @for (row of rows(); track row.tag) {
            <tr>
              <td><span class="badge" [style.background]="row.color || '#6366f1'">{{ row.tag }}</span></td>
              <td>{{ row.count }}</td>
              <td>R$ {{ row.total | number:'1.2-2' }}</td>
            </tr>
          }
          @empty {
            <tr><td colspan="3" class="empty">Nenhum lançamento com tags ainda.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .cta-banner { background: #eef2ff; border: 1px solid #6366f1; border-radius: .5rem; padding: 1.25rem; margin-bottom: 1rem; display: flex; gap: 1rem; align-items: flex-start; }
    .cta-banner__icon { font-size: 2rem; }
    .cta-banner__body p { margin: .25rem 0 0; color: #6b7280; font-size: .875rem; }
    .page-header { margin-bottom: 1rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; }
    .badge { padding: .2rem .6rem; border-radius: 9999px; color: #fff; font-size: .78rem; }
    .empty { text-align: center; color: #9ca3af; }
  `]
})
export class TagsReportComponent implements OnInit {
  private api = inject(ApiService);
  rows = signal<any[]>([]);
  showCta = signal(false);

  ngOnInit() {
    this.api.get<any>('/reports/tags-cta').subscribe(r => this.showCta.set(r.show_cta ?? false));
    this.api.get<any>('/reports/categories', { type: 'tags' }).subscribe(r => this.rows.set(r.data ?? []));
  }
}
