import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-card-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>Faturas do Cartão</h1>
      <select class="input" [(ngModel)]="selectedCard" (ngModelChange)="load()">
        <option value="">Selecione um cartão</option>
        @for (c of cards(); track c.id) {
          <option [value]="c.id">{{ c.name }}</option>
        }
      </select>
    </div>

    @if (selectedCard) {
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>Competência</th><th>Vencimento</th><th>Total</th><th>Qtd lançamentos</th></tr>
          </thead>
          <tbody>
            @for (inv of invoices(); track inv.month) {
              <tr>
                <td>{{ inv.month }}</td>
                <td>{{ inv.due_date }}</td>
                <td>R$ {{ inv.total | number:'1.2-2' }}</td>
                <td>{{ inv.count }}</td>
              </tr>
            }
            @empty {
              <tr><td colspan="4" class="empty">Nenhuma fatura encontrada.</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty-state">Selecione um cartão para ver o histórico de faturas.</div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: .75rem 1rem; text-align: left; font-size: .82rem; color: #6b7280; }
    .table td { padding: .75rem 1rem; border-top: 1px solid #f3f4f6; font-size: .875rem; }
    .empty { text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; color: #9ca3af; padding: 3rem; }
  `]
})
export class CardInvoicesComponent implements OnInit {
  private api = inject(ApiService);
  cards = signal<any[]>([]);
  invoices = signal<any[]>([]);
  selectedCard = '';

  ngOnInit() { this.api.get<any>('/credit-cards').subscribe(r => this.cards.set(r.data ?? [])); }

  load() {
    if (!this.selectedCard) return;
    this.api.get<any>(`/reports/cards/${this.selectedCard}/invoices`).subscribe(r => this.invoices.set(r.data ?? []));
  }
}
