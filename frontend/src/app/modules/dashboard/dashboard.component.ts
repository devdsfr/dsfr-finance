import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dash">

      <!-- ── Greeting + month summary ──────────────────────── -->
      <div class="hero">
        <div class="hero__left">
          <p class="greeting">{{ greeting() }}, <strong>{{ firstName() }}!</strong></p>
          <div class="month-summary">
            <div class="ms-item">
              <span class="ms-label">Receitas no mês atual</span>
              @if (loading()) { <span class="skel skel--val"></span> }
              @else { <span class="ms-value ms-value--income">{{ income() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span> }
            </div>
            <div class="ms-sep"></div>
            <div class="ms-item">
              <span class="ms-label">Despesas no mês atual</span>
              @if (loading()) { <span class="skel skel--val"></span> }
              @else { <span class="ms-value ms-value--expense">{{ expense() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span> }
            </div>
          </div>
        </div>

        <!-- Acesso rápido -->
        <div class="quick-access">
          <p class="qa-title">Acesso rápido</p>
          <div class="qa-btns">
            <a routerLink="/transactions/new" [queryParams]="{type:'expense'}" class="qa-btn qa-btn--expense">
              <span class="qa-icon">➖</span>
              <span>DESPESA</span>
            </a>
            <a routerLink="/transactions/new" [queryParams]="{type:'income'}" class="qa-btn qa-btn--income">
              <span class="qa-icon">➕</span>
              <span>RECEITA</span>
            </a>
            <a routerLink="/transactions/new" [queryParams]="{type:'transfer'}" class="qa-btn qa-btn--transfer">
              <span class="qa-icon">⇄</span>
              <span>TRANSF.</span>
            </a>
          </div>
        </div>
      </div>

      <!-- ── Body: 2 columns ───────────────────────────────── -->
      <div class="body-grid">

        <!-- LEFT: saldo geral + contas a pagar -->
        <div class="col">

          <!-- Saldo geral -->
          <div class="card">
            <div class="card__header">
              <span class="green-bar"></span>
              <div>
                <p class="card__sup">Saldo geral</p>
                @if (loading()) { <span class="skel skel--val"></span> }
                @else { <p class="card__big">{{ totalBalance() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p> }
              </div>
            </div>
            <p class="section-label">Minhas contas</p>
            @if (loading()) {
              <div class="skel-rows">
                <div class="skel skel--row"></div>
                <div class="skel skel--row"></div>
              </div>
            }
            @for (acc of accounts(); track acc.id) {
              <div class="acc-row">
                <div class="acc-icon">{{ acc.name[0] }}</div>
                <div class="acc-info">
                  <span class="acc-name">{{ acc.name }}</span>
                  <span class="acc-type">{{ acc.type }}</span>
                </div>
                <span class="acc-balance">{{ acc.balance | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
              </div>
            }
            @if (!loading() && accounts().length === 0) {
              <p class="empty-msg">Nenhuma conta cadastrada.</p>
            }
            <a routerLink="/banking" class="manage-link">Gerenciar contas</a>
          </div>

          <!-- Contas a pagar -->
          @if (upcomingBills().length > 0) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">Contas a pagar</p>
              @if (todayBills().length > 0) {
                <div class="due-today">Vence hoje</div>
              }
              @for (bill of upcomingBills(); track bill.id) {
                <div class="bill-row">
                  <div class="bill-icon" [style.background]="bill.color ?? '#ef4444'">
                    {{ (bill.description ?? 'B')[0] }}
                  </div>
                  <div class="bill-info">
                    <span class="bill-name">{{ bill.description }}</span>
                    <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                  </div>
                  <span class="bill-amt">{{ bill.amount | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- RIGHT: faturas + cartoes -->
        <div class="col">

          <!-- Faturas do mes -->
          @if (loading()) {
            <div class="card">
              <div class="card__header">
                <span class="green-bar"></span>
                <div>
                  <p class="card__sup">Faturas do mês</p>
                  <span class="skel skel--val"></span>
                </div>
              </div>
              <div class="skel-rows">
                <div class="skel skel--row"></div>
                <div class="skel skel--row"></div>
              </div>
            </div>
          }
          @if (!loading() && cards().length > 0) {
            <div class="card">
              <div class="card__header">
                <span class="green-bar"></span>
                <div>
                  <p class="card__sup">Faturas de {{ monthLabel() }}</p>
                  <p class="card__big card__big--expense">{{ totalCardExpense() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
                </div>
              </div>
              <p class="section-label">Meus cartões</p>
              @for (card of cards(); track card.id) {
                <div class="card-row">
                  <div class="card-icon" [style.background]="card.color ?? '#6366f1'">
                    {{ card.name[0] }}
                  </div>
                  <div class="card-info">
                    <span class="card-name">{{ card.name }}</span>
                    <span class="card-sub">Cartão manual</span>
                  </div>
                  <a [routerLink]="['/reports/card-invoices']" class="ver-fatura">Ver fatura</a>
                </div>
                <div class="card-limits">
                  <div>
                    <span class="cl-label">Limite Disponível</span>
                    <span class="cl-val">{{ card.available_limit | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                  </div>
                  <div>
                    <span class="cl-label">Fatura atual</span>
                    <span class="cl-val cl-val--expense">{{ card.current_invoice | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Quick stats -->
          <div class="card mt">
            <p class="section-label" style="margin-top:0">Resultado do mês</p>
            @if (loading()) {
              <div class="result-row">
                <span class="skel skel--text"></span>
                <span class="skel skel--val"></span>
              </div>
            } @else {
            <div class="result-row" [class.negative]="balance() < 0">
              <span>{{ balance() < 0 ? 'Déficit' : 'Saldo' }}</span>
              <span class="result-val">{{ balance() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
            </div>
            }
            <a routerLink="/reports/flow" class="manage-link">Ver relatório de entradas e saídas →</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dash { padding-bottom: 2rem; }

    /* ── Hero ── */
    .hero {
      display: flex; gap: 1.5rem; align-items: flex-start;
      background: #fff; border-radius: .5rem;
      padding: 1.5rem 2rem; margin-bottom: 1.25rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      flex-wrap: wrap;
    }
    .hero__left { flex: 1; min-width: 200px; }
    .greeting { margin: 0 0 1rem; font-size: 1.1rem; color: #374151; }
    .greeting strong { color: #111; }
    .month-summary { display: flex; gap: 2rem; flex-wrap: wrap; }
    .ms-item { display: flex; flex-direction: column; gap: .2rem; }
    .ms-label { font-size: .78rem; color: #9ca3af; }
    .ms-value { font-size: 1.35rem; font-weight: 700; }
    .ms-value--income { color: #16a34a; }
    .ms-value--expense { color: #dc2626; }
    .ms-sep { width: 1px; background: #e5e7eb; }

    /* Acesso rápido */
    .quick-access { display: flex; flex-direction: column; gap: .75rem; align-items: flex-start; }
    .qa-title { margin: 0; font-size: .82rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .qa-btns { display: flex; gap: .75rem; }
    .qa-btn {
      display: flex; flex-direction: column; align-items: center; gap: .35rem;
      text-decoration: none; font-size: .72rem; font-weight: 700; letter-spacing: .04em;
      color: #374151;
    }
    .qa-icon {
      width: 48px; height: 48px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 1.2rem;
      border: 2px solid currentColor;
    }
    .qa-btn--expense .qa-icon { color: #ef4444; border-color: #ef4444; }
    .qa-btn--income .qa-icon  { color: #22c55e; border-color: #22c55e; }
    .qa-btn--transfer .qa-icon { color: #94a3b8; border-color: #94a3b8; }

    /* ── Body grid ── */
    .body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    @media (max-width: 780px) { .body-grid { grid-template-columns: 1fr; } }

    /* ── Cards ── */
    .card {
      background: #fff; border-radius: .5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); overflow: hidden;
      padding: 1.25rem 1.5rem;
    }
    .mt { margin-top: 1.25rem; }
    .card__header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .green-bar { width: 4px; height: 40px; border-radius: 2px; background: #2e7736; flex-shrink: 0; }
    .card__sup { margin: 0; font-size: .78rem; color: #6b7280; }
    .card__big { margin: .2rem 0 0; font-size: 1.4rem; font-weight: 700; color: #111; }
    .card__big--expense { color: #dc2626; }
    .section-label { font-size: .78rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; margin: 1rem 0 .5rem; }

    /* Accounts */
    .acc-row { display: flex; align-items: center; gap: .75rem; padding: .6rem 0; border-top: 1px solid #f3f4f6; }
    .acc-icon {
      width: 36px; height: 36px; border-radius: 50%; background: #111;
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .9rem; flex-shrink: 0;
    }
    .acc-info { flex: 1; display: flex; flex-direction: column; }
    .acc-name { font-size: .875rem; font-weight: 600; color: #111; }
    .acc-type { font-size: .72rem; color: #9ca3af; }
    .acc-balance { font-size: .95rem; font-weight: 700; color: #2563eb; }
    .empty-msg { color: #9ca3af; font-size: .82rem; }
    .manage-link {
      display: block; text-align: center; margin-top: 1rem;
      padding: .5rem; border: 1px solid #e5e7eb; border-radius: .375rem;
      color: #6b7280; text-decoration: none; font-size: .82rem;
      transition: border-color .15s;
    }
    .manage-link:hover { border-color: #2e7736; color: #2e7736; }

    /* Bills */
    .due-today {
      text-align: center; padding: .4rem; background: #fef2f2;
      color: #dc2626; font-size: .78rem; font-weight: 600;
      border-radius: .25rem; margin-bottom: .5rem;
    }
    .bill-row { display: flex; align-items: center; gap: .75rem; padding: .55rem 0; border-top: 1px solid #f3f4f6; }
    .bill-icon {
      width: 32px; height: 32px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: .85rem; flex-shrink: 0;
    }
    .bill-info { flex: 1; display: flex; flex-direction: column; }
    .bill-name { font-size: .82rem; font-weight: 600; color: #111; }
    .bill-date { font-size: .7rem; color: #9ca3af; }
    .bill-amt { font-size: .875rem; font-weight: 600; color: #374151; }

    /* Cards */
    .card-row { display: flex; align-items: center; gap: .75rem; padding: .6rem 0; border-top: 1px solid #f3f4f6; }
    .card-icon {
      width: 40px; height: 40px; border-radius: .375rem; display: flex;
      align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 1rem; flex-shrink: 0;
    }
    .card-info { flex: 1; display: flex; flex-direction: column; }
    .card-name { font-size: .875rem; font-weight: 600; color: #111; }
    .card-sub { font-size: .72rem; color: #9ca3af; }
    .ver-fatura {
      padding: .3rem .75rem; background: #dcfce7; color: #16a34a;
      border-radius: .25rem; font-size: .75rem; font-weight: 700;
      text-decoration: none; white-space: nowrap;
    }
    .card-limits {
      display: flex; justify-content: space-between;
      padding: .4rem 0 .6rem 52px; border-bottom: 1px solid #f3f4f6;
    }
    .cl-label { display: block; font-size: .7rem; color: #9ca3af; }
    .cl-val { font-size: .875rem; font-weight: 600; color: #111; }
    .cl-val--expense { color: #dc2626; }

    /* Result */
    .result-row { display: flex; justify-content: space-between; align-items: center; padding: .75rem 0; border-top: 1px solid #f3f4f6; }
    .result-val { font-size: 1.15rem; font-weight: 700; color: #16a34a; }
    .result-row.negative .result-val { color: #dc2626; }

    /* Skeleton loading */
    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .skel {
      display: inline-block; border-radius: .375rem;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 800px 100%;
      animation: shimmer 1.4s infinite;
    }
    .skel--val  { width: 120px; height: 1.6rem; vertical-align: middle; margin: .15rem 0; }
    .skel--text { width: 60px;  height: 1rem;   vertical-align: middle; }
    .skel--row  { height: 44px; border-radius: .375rem; margin: .4rem 0; display: block; width: 100%; }
    .skel-rows  { margin: .5rem 0; }
  `]
})
export class DashboardComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  loading = signal(true);

  income  = signal(0);
  expense = signal(0);
  balance = computed(() => this.income() - this.expense());

  accounts      = signal<any[]>([]);
  cards         = signal<any[]>([]);
  upcomingBills = signal<any[]>([]);
  todayBills    = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.upcomingBills().filter(b => b.date?.slice(0, 10) === today);
  });

  totalBalance    = computed(() => this.accounts().reduce((s, a) => s + (a.balance ?? 0), 0));
  totalCardExpense = computed(() => this.cards().reduce((s, c) => s + (c.current_invoice ?? 0), 0));

  monthLabel = signal('');

  firstName(): string {
    return (this.auth.currentUser()?.name ?? '').split(' ')[0];
  }

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  ngOnInit() {
    const now  = new Date();
    const year = now.getFullYear();
    const mon  = now.getMonth() + 1;
    const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    this.monthLabel.set(MONTHS[now.getMonth()]);

    const from = `${year}-${String(mon).padStart(2,'0')}-01`;
    const to   = new Date(year, mon, 0).toISOString().slice(0, 10); // último dia real do mês

    forkJoin({
      txs:     this.api.get<any>('/transactions', { date_from: from, date_to: to, limit: 500 }).pipe(catchError(() => of({ data: [] }))),
      accs:    this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] }))),
      ccs:     this.api.get<any>('/credit-cards').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(({ txs, accs, ccs }) => {
      const list: any[] = txs.data ?? [];
      const inc = list.filter(t => t.type === 'income'  && !t.ignored).reduce((s: number, t: any) => s + t.amount, 0);
      const exp = list.filter(t => t.type === 'expense' && !t.ignored).reduce((s: number, t: any) => s + t.amount, 0);
      this.income.set(inc);
      this.expense.set(exp);

      // Upcoming bills = unpaid expenses with date in next 7 days
      const today  = new Date(); today.setHours(0,0,0,0);
      const next7  = new Date(today); next7.setDate(next7.getDate() + 7);
      const bills = list.filter(t => {
        if (t.type !== 'expense' || t.paid || t.ignored) return false;
        const d = new Date(t.date);
        return d >= today && d <= next7;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
      this.upcomingBills.set(bills);

      this.accounts.set(accs.data ?? []);

      // Attach current invoice from transactions to each card
      const ccList: any[] = ccs.data ?? [];
      const cardExpMap = new Map<string, number>();
      list.filter(t => t.credit_card_id && t.type === 'expense').forEach(t => {
        cardExpMap.set(t.credit_card_id, (cardExpMap.get(t.credit_card_id) ?? 0) + t.amount);
      });
      this.cards.set(ccList.map(c => ({
        ...c,
        current_invoice: cardExpMap.get(c.id) ?? 0,
        available_limit: (c.limit ?? 0) - (cardExpMap.get(c.id) ?? 0),
      })));

      this.loading.set(false);
    });
  }
}
