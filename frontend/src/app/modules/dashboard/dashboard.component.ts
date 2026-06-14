import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dash">
      <div class="dash__header">
        <h1>Visão Geral</h1>
        <span class="dash__month">{{ monthLabel() }}</span>
      </div>

      <div class="summary-cards">
        <div class="scard scard--income">
          <span class="scard__label">Receitas</span>
          <span class="scard__value">{{ income() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
        </div>
        <div class="scard scard--expense">
          <span class="scard__label">Despesas</span>
          <span class="scard__value">{{ expense() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
        </div>
        <div class="scard scard--balance" [class.negative]="balance() < 0">
          <span class="scard__label">Resultado</span>
          <span class="scard__value">{{ balance() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
        </div>
      </div>

      <div class="quick-links">
        <a routerLink="/transactions" class="qlink">
          <span class="qlink__icon">📋</span>
          <span>Lançamentos</span>
        </a>
        <a routerLink="/reports/flow" class="qlink">
          <span class="qlink__icon">📊</span>
          <span>Entradas x Saídas</span>
        </a>
        <a routerLink="/reports/categories" class="qlink">
          <span class="qlink__icon">🏷</span>
          <span>Categorias</span>
        </a>
        <a routerLink="/spending-limits" class="qlink">
          <span class="qlink__icon">⚡</span>
          <span>Limite de Gastos</span>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .dash { padding-bottom: 2rem; }
    .dash__header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 1.5rem; }
    .dash__header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }
    .dash__month { font-size: .9rem; color: #6b7280; }

    .summary-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-bottom: 2rem; }
    .scard {
      background: #fff; border-radius: .5rem; padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); border-top: 3px solid transparent;
      display: flex; flex-direction: column; gap: .35rem;
    }
    .scard--income { border-color: #22c55e; }
    .scard--expense { border-color: #ef4444; }
    .scard--balance { border-color: #6366f1; }
    .scard.negative { border-color: #f97316; }
    .scard__label { font-size: .8rem; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
    .scard__value { font-size: 1.4rem; font-weight: 700; color: #111; }
    .scard--income .scard__value { color: #16a34a; }
    .scard--expense .scard__value { color: #dc2626; }

    .quick-links { display: flex; gap: 1rem; flex-wrap: wrap; }
    .qlink {
      display: flex; flex-direction: column; align-items: center; gap: .5rem;
      background: #fff; border-radius: .5rem; padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); text-decoration: none; color: #374151;
      font-size: .875rem; font-weight: 500; transition: box-shadow .15s, transform .15s;
      min-width: 130px;
    }
    .qlink:hover { box-shadow: 0 4px 12px rgba(0,0,0,.12); transform: translateY(-2px); }
    .qlink__icon { font-size: 1.5rem; }

    @media (max-width: 600px) {
      .summary-cards { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);

  income = signal(0);
  expense = signal(0);
  balance = signal(0);
  monthLabel = signal('');

  ngOnInit(): void {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    this.monthLabel.set(`${months[now.getMonth()]} ${now.getFullYear()}`);

    this.api.get<any>('/reports/flow', { month }).subscribe(r => {
      const d = r.data ?? r;
      this.income.set(d.income ?? 0);
      this.expense.set(d.expense ?? 0);
      this.balance.set((d.income ?? 0) - (d.expense ?? 0));
    });
  }
}
