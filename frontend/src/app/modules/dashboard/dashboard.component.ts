import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-BR', en: 'en-US', ro: 'ro-RO' };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, AppCurrencyPipe],
  template: `
    <div class="dash">

      <!-- ── Hero ──────────────────────────────────────────────── -->
      <div class="hero">
        <div class="hero__left">
          <p class="greeting">{{ greeting() }}, <strong>{{ firstName() }}!</strong></p>
          <div class="month-summary">
            <div class="ms-item">
              <span class="ms-label">{{ 'dashboard.income_month' | translate }}</span>
              @if (loading()) { <span class="skel skel--val"></span> }
              @else { <span class="ms-value ms-value--income">{{ income() | appCurrency }}</span> }
            </div>
            <div class="ms-sep"></div>
            <div class="ms-item">
              <span class="ms-label">{{ 'dashboard.expense_month' | translate }}</span>
              @if (loading()) { <span class="skel skel--val"></span> }
              @else { <span class="ms-value ms-value--expense">{{ expense() | appCurrency }}</span> }
            </div>
          </div>
        </div>

        <div class="quick-access">
          <p class="qa-title">{{ 'dashboard.quick_access' | translate }}</p>
          <div class="qa-btns">
            <a routerLink="/transactions/new" [queryParams]="{type:'expense'}" class="qa-btn qa-btn--expense">
              <span class="qa-icon">➖</span><span>{{ 'dashboard.expense' | translate }}</span>
            </a>
            <a routerLink="/transactions/new" [queryParams]="{type:'income'}" class="qa-btn qa-btn--income">
              <span class="qa-icon">➕</span><span>{{ 'dashboard.income' | translate }}</span>
            </a>
            <a routerLink="/transactions/new" [queryParams]="{type:'transfer'}" class="qa-btn qa-btn--transfer">
              <span class="qa-icon">⇄</span><span>{{ 'dashboard.transfer' | translate }}</span>
            </a>
            <a routerLink="/transactions" class="qa-btn qa-btn--import">
              <span class="qa-icon">📥</span><span>{{ 'dashboard.import' | translate }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- ── Body: 2 columns ──────────────────────────────────── -->
      <div class="body-grid">

        <!-- ── LEFT ── -->
        <div class="col">

          <!-- Saldo geral -->
          <div class="card">
            <div class="card__header">
              <span class="green-bar"></span>
              <div>
                <p class="card__sup">{{ 'dashboard.overall_balance' | translate }}</p>
                @if (loading()) { <span class="skel skel--val"></span> }
                @else { <p class="card__big">{{ totalBalance() | appCurrency }}</p> }
              </div>
            </div>
            <p class="section-label">{{ 'dashboard.my_accounts' | translate }}</p>
            @if (loading()) {
              <div class="skel-rows">
                <div class="skel skel--row"></div>
                <div class="skel skel--row"></div>
              </div>
            }
            @for (acc of accounts(); track acc.id) {
              <div class="acc-row">
                @if (acc.logo) {
                  <div class="acc-icon acc-icon--img" [style.border-color]="acc.color ?? '#111'">
                    <img [src]="acc.logo" [alt]="acc.name" class="acc-logo"
                         (error)="$any($event.target).style.display='none'; $any($event.target).parentElement.style.background=acc.color??'#111'; $any($event.target).parentElement.textContent=acc.name[0]" />
                  </div>
                } @else {
                  <div class="acc-icon" [style.background]="acc.color ?? '#111'">{{ acc.name[0] }}</div>
                }
                <div class="acc-info">
                  <span class="acc-name">{{ acc.name }}</span>
                  <span class="acc-type">{{ acc.type }}</span>
                </div>
                <span class="acc-balance">{{ acc.balance | appCurrency }}</span>
              </div>
            }
            @if (!loading() && accounts().length === 0) {
              <p class="empty-msg">{{ 'dashboard.no_accounts' | translate }}</p>
            }
            <a routerLink="/banking" class="manage-link">{{ 'dashboard.manage_accounts' | translate }}</a>
          </div>

          <!-- Contas a pagar -->
          @if (!loading() && payableBills().length > 0) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">{{ 'dashboard.payable' | translate }}</p>
              @if (overduePayable().length > 0) {
                <div class="bill-banner bill-banner--danger">{{ 'dashboard.payable_overdue' | translate }}</div>
                @for (bill of overduePayable().slice(0, 4); track bill.id) {
                  <div class="bill-row">
                    <div class="bill-icon" [style.background]="bill.category?.color ?? '#ef4444'">{{ (bill.description ?? 'B')[0] }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt">{{ bill.amount | appCurrency }}</span>
                  </div>
                }
              }
              @if (upcomingPayable().length > 0) {
                <p class="section-label">{{ 'dashboard.upcoming' | translate }}</p>
                @for (bill of upcomingPayable().slice(0, 4); track bill.id) {
                  <div class="bill-row">
                    <div class="bill-icon" [style.background]="bill.category?.color ?? '#6b7280'">{{ (bill.description ?? 'B')[0] }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt">{{ bill.amount | appCurrency }}</span>
                  </div>
                }
              }
              <a routerLink="/transactions" [queryParams]="{type:'expense',paid:'false'}" class="manage-link">{{ 'dashboard.see_more' | translate }}</a>
            </div>
          }

          <!-- Contas a receber -->
          @if (!loading() && receivableBills().length > 0) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">{{ 'dashboard.receivable' | translate }}</p>
              @if (overdueReceivable().length > 0) {
                <div class="bill-banner bill-banner--warning">{{ 'dashboard.receivable_overdue' | translate }}</div>
                @for (bill of overdueReceivable().slice(0, 4); track bill.id) {
                  <div class="bill-row">
                    <div class="bill-icon" [style.background]="bill.category?.color ?? '#16a34a'">{{ (bill.description ?? 'R')[0] }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt bill-amt--income">{{ bill.amount | appCurrency }}</span>
                  </div>
                }
              }
              @if (upcomingReceivable().length > 0) {
                <p class="section-label">{{ 'dashboard.upcoming' | translate }}</p>
                @for (bill of upcomingReceivable().slice(0, 4); track bill.id) {
                  <div class="bill-row">
                    <div class="bill-icon" [style.background]="bill.category?.color ?? '#16a34a'">{{ (bill.description ?? 'R')[0] }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt bill-amt--income">{{ bill.amount | appCurrency }}</span>
                  </div>
                }
              }
              <a routerLink="/transactions" [queryParams]="{type:'income',paid:'false'}" class="manage-link">{{ 'dashboard.see_more' | translate }}</a>
            </div>
          }
        </div>

        <!-- ── RIGHT ── -->
        <div class="col">

          <!-- Faturas do mês (skeleton) -->
          @if (loading()) {
            <div class="card">
              <div class="card__header">
                <span class="green-bar"></span>
                <div>
                  <p class="card__sup">{{ 'dashboard.invoices_of' | translate }} {{ monthLabel() }}</p>
                  <span class="skel skel--val"></span>
                </div>
              </div>
              <div class="skel-rows">
                <div class="skel skel--row"></div>
                <div class="skel skel--row"></div>
              </div>
            </div>
          }

          <!-- Faturas do mês (data) -->
          @if (!loading() && cards().length > 0) {
            <div class="card">
              <div class="card__header">
                <span class="green-bar"></span>
                <div>
                  <p class="card__sup">{{ 'dashboard.invoices_of' | translate }} {{ monthLabel() }}</p>
                  <p class="card__big card__big--expense">{{ totalCardExpense() | appCurrency }}</p>
                </div>
              </div>
              <p class="section-label">{{ 'dashboard.my_cards' | translate }}</p>
              @for (card of cards(); track card.id) {
                <div class="card-row">
                  @if (card.logo) {
                    <div class="card-icon card-icon--img" [style.border-color]="card.color ?? '#6366f1'">
                      <img [src]="card.logo" [alt]="card.name" class="card-logo"
                           (error)="$any($event.target).style.display='none'; $any($event.target).parentElement.style.background=card.color??'#6366f1'; $any($event.target).parentElement.textContent=card.name[0]" />
                    </div>
                  } @else {
                    <div class="card-icon" [style.background]="card.color ?? '#6366f1'">{{ card.name[0] }}</div>
                  }
                  <div class="card-info">
                    <span class="card-name">{{ card.name }}</span>
                    <span class="card-sub">{{ 'dashboard.manual_card' | translate }}</span>
                  </div>
                  <a [routerLink]="['/reports/card-invoices']" class="ver-fatura">{{ 'dashboard.see_invoice' | translate }}</a>
                </div>
                <div class="card-limits">
                  <div>
                    <span class="cl-label">{{ 'dashboard.available_limit' | translate }}</span>
                    <span class="cl-val">{{ card.available_limit | appCurrency }}</span>
                  </div>
                  <div>
                    <span class="cl-label">{{ 'dashboard.current_invoice' | translate }}</span>
                    <span class="cl-val cl-val--expense">{{ card.current_invoice | appCurrency }}</span>
                  </div>
                </div>
              }
              <a routerLink="/banking" class="manage-link">{{ 'dashboard.manage_cards' | translate }}</a>
            </div>
          }

          <!-- Maiores gastos do mês -->
          @if (!loading() && topCategories().length > 0) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">{{ 'dashboard.top_spending' | translate }}</p>
              <div class="cat-chart">
                <div class="cat-list">
                  @for (c of topCategories(); track c.category) {
                    <div class="cat-row">
                      <span class="cat-dot" [style.background]="c.color"></span>
                      <span class="cat-name">{{ c.category }}</span>
                      <span class="cat-pct">{{ c.pct | number:'1.0-0' }}%</span>
                    </div>
                  }
                </div>
                <svg viewBox="0 0 100 100" class="donut-svg">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" stroke-width="14"/>
                  @for (seg of chartSegments(); track seg.category) {
                    <circle cx="50" cy="50" r="38" fill="none"
                            [attr.stroke]="seg.color"
                            stroke-width="14"
                            [attr.stroke-dasharray]="seg.dash + ' ' + C"
                            [attr.stroke-dashoffset]="seg.offset"
                            transform="rotate(-90 50 50)"/>
                  }
                </svg>
              </div>
              <a routerLink="/reports/categories" class="manage-link">{{ 'dashboard.see_report' | translate }}</a>
            </div>
          }

          <!-- Limite de gastos -->
          @if (!loading() && spendingLimits().length > 0) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">{{ 'dashboard.spending_limit_of' | translate }} {{ monthLabel() }}</p>
              @for (lim of spendingLimits().slice(0, 3); track lim.id) {
                <div class="lim-row">
                  <svg viewBox="0 0 36 36" class="lim-ring">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" stroke-width="3"/>
                    <circle cx="18" cy="18" r="15.9" fill="none"
                            [attr.stroke]="lim.usage_pct >= 100 ? '#dc2626' : lim.usage_pct >= (lim.alert_pct ?? 80) ? '#f59e0b' : '#2e7736'"
                            stroke-width="3"
                            stroke-linecap="round"
                            [attr.stroke-dasharray]="(lim.usage_pct > 100 ? 100 : lim.usage_pct) + ' 100'"
                            stroke-dashoffset="25"
                            transform="rotate(-90 18 18)"/>
                  </svg>
                  <div class="lim-info">
                    <span class="lim-name">{{ limitName(lim) }}</span>
                    <span class="lim-detail">{{ 'dashboard.goal' | translate }}: {{ lim.amount | appCurrency }}</span>
                    <span class="lim-detail">{{ 'dashboard.spent' | translate }}: {{ lim.current_spend | appCurrency }}</span>
                  </div>
                  <span class="lim-pct" [class.lim-pct--over]="lim.usage_pct >= 100">{{ lim.usage_pct | number:'1.0-0' }}%</span>
                </div>
              }
              <a routerLink="/spending-limits" class="manage-link">{{ 'dashboard.full_analysis' | translate }}</a>
            </div>
          }

          <!-- Resultado do mês -->
          @if (!loading()) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">{{ 'dashboard.month_result' | translate }}</p>
              <div class="result-row" [class.negative]="balance() < 0">
                <span>{{ balance() < 0 ? ('dashboard.deficit' | translate) : ('dashboard.balance' | translate) }}</span>
                <span class="result-val">{{ balance() | appCurrency }}</span>
              </div>
              <a routerLink="/reports/flow" class="manage-link">{{ 'dashboard.see_flow_report' | translate }}</a>
            </div>
          }
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
    .qa-btn--import .qa-icon  { color: #6366f1; border-color: #6366f1; }

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
    .acc-icon--img { background: #fff !important; border: 2px solid #e5e7eb; overflow: hidden; }
    .acc-logo { width: 70%; height: 70%; object-fit: contain; display: block; }
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
    .bill-banner {
      text-align: center; padding: .4rem; font-size: .78rem; font-weight: 600;
      border-radius: .25rem; margin-bottom: .5rem;
    }
    .bill-banner--danger  { background: #fef2f2; color: #dc2626; }
    .bill-banner--warning { background: #fef9c3; color: #b45309; }
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
    .bill-amt--income { color: #16a34a; }

    /* Credit Cards */
    .card-row { display: flex; align-items: center; gap: .75rem; padding: .6rem 0; border-top: 1px solid #f3f4f6; }
    .card-icon {
      width: 40px; height: 40px; border-radius: .375rem; display: flex;
      align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 1rem; flex-shrink: 0;
    }
    .card-icon--img { background: #fff !important; border: 2px solid #e5e7eb; overflow: hidden; }
    .card-logo { width: 70%; height: 70%; object-fit: contain; display: block; }
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

    /* Maiores gastos */
    .cat-chart { display: flex; align-items: center; gap: 1.5rem; margin: .5rem 0; }
    .cat-list { flex: 1; display: flex; flex-direction: column; gap: .6rem; }
    .cat-row { display: flex; align-items: center; gap: .5rem; font-size: .82rem; }
    .cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .cat-name { flex: 1; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cat-pct { font-weight: 700; color: #111; }
    .donut-svg { width: 110px; height: 110px; flex-shrink: 0; }

    /* Spending limits */
    .lim-row { display: flex; align-items: center; gap: 1rem; padding: .75rem 0; border-top: 1px solid #f3f4f6; }
    .lim-ring { width: 52px; height: 52px; flex-shrink: 0; }
    .lim-info { flex: 1; display: flex; flex-direction: column; gap: .1rem; }
    .lim-name { font-size: .875rem; font-weight: 600; color: #111; }
    .lim-detail { font-size: .72rem; color: #9ca3af; }
    .lim-pct { font-size: 1rem; font-weight: 700; color: #2e7736; white-space: nowrap; }
    .lim-pct--over { color: #dc2626; }

    /* Result */
    .result-row { display: flex; justify-content: space-between; align-items: center; padding: .75rem 0; border-top: 1px solid #f3f4f6; }
    .result-val { font-size: 1.15rem; font-weight: 700; color: #16a34a; }
    .result-row.negative .result-val { color: #dc2626; }

    /* Skeleton */
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
    .skel--row  { height: 44px; border-radius: .375rem; margin: .4rem 0; display: block; width: 100%; }
    .skel-rows  { margin: .5rem 0; }
  `]
})
export class DashboardComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);
  private i18n = inject(TranslationService);

  readonly C = 2 * Math.PI * 38; // SVG donut circumference ≈ 238.76

  loading = signal(true);
  income  = signal(0);
  expense = signal(0);
  balance = computed(() => this.income() - this.expense());

  accounts        = signal<any[]>([]);
  cards           = signal<any[]>([]);
  payableBills    = signal<any[]>([]);
  receivableBills = signal<any[]>([]);
  topCategories   = signal<any[]>([]);
  spendingLimits  = signal<any[]>([]);
  _categories     = signal<any[]>([]);

  totalBalance     = computed(() => this.accounts().reduce((s, a) => s + (a.balance ?? 0), 0));
  totalCardExpense = computed(() => this.cards().reduce((s, c) => s + (c.current_invoice ?? 0), 0));

  // Recomputed automatically whenever the language changes — uses Intl so
  // we don't need a hardcoded month-name array per language.
  monthLabel = computed(() => {
    const locale = LOCALE_MAP[this.i18n.lang()] ?? 'pt-BR';
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date());
  });

  overduePayable = computed(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return this.payableBills().filter(b => new Date(b.date) < t);
  });
  upcomingPayable = computed(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return this.payableBills().filter(b => new Date(b.date) >= t);
  });
  overdueReceivable = computed(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return this.receivableBills().filter(b => new Date(b.date) < t);
  });
  upcomingReceivable = computed(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return this.receivableBills().filter(b => new Date(b.date) >= t);
  });

  chartSegments = computed(() => {
    const C = this.C;
    let acc = 0;
    return this.topCategories().map(c => {
      const dash = (c.pct / 100) * C;
      const seg = { ...c, dash, offset: C - acc };
      acc += dash;
      return seg;
    });
  });

  firstName(): string {
    return (this.auth.currentUser()?.name ?? '').split(' ')[0];
  }

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return this.i18n.t('dashboard.greeting_morning');
    if (h < 18) return this.i18n.t('dashboard.greeting_afternoon');
    return this.i18n.t('dashboard.greeting_evening');
  }

  limitName(l: any): string {
    if (l.category_id) return this._categories().find((c: any) => c.id === l.category_id)?.name ?? 'Categoria';
    if (l.account_id)  return this.accounts().find(a => a.id === l.account_id)?.name ?? 'Conta';
    if (l.credit_card_id) return this.cards().find(c => c.id === l.credit_card_id)?.name ?? 'Cartão';
    return 'Limite geral';
  }

  private inferLogo(name: string, logo: string): string {
    if (logo) return logo;
    const n = name.toLowerCase();
    if (n.includes('nubank'))          return 'https://cdn.simpleicons.org/nubank/8a05be';
    if (n.includes('inter'))           return 'https://cdn.simpleicons.org/bancointer/ff7000';
    if (n.includes('itaú') || n.includes('itau')) return 'https://cdn.simpleicons.org/itau/003d8f';
    if (n.includes('bradesco'))        return 'https://cdn.simpleicons.org/bradesco/cc092f';
    if (n.includes('santander'))       return 'https://cdn.simpleicons.org/santander/ec0000';
    if (n.includes('caixa'))           return 'https://www.google.com/s2/favicons?domain=caixa.gov.br&sz=64';
    if (n.includes('brasil') || n.includes(' bb')) return 'https://cdn.simpleicons.org/bancodobrasil/000000';
    if (n.includes('c6'))              return 'https://www.google.com/s2/favicons?domain=c6bank.com.br&sz=64';
    if (n.includes('btg'))             return 'https://www.google.com/s2/favicons?domain=btgpactual.com&sz=64';
    if (n.includes('xp'))              return 'https://www.google.com/s2/favicons?domain=xpi.com.br&sz=64';
    if (n.includes('mercado pago') || n.includes('mercadopago')) return 'https://cdn.simpleicons.org/mercadopago/009ee3';
    if (n.includes('picpay'))          return 'https://cdn.simpleicons.org/picpay/21c25e';
    if (n.includes('sicoob'))          return 'https://www.google.com/s2/favicons?domain=sicoob.com.br&sz=64';
    if (n.includes('sicredi'))         return 'https://www.google.com/s2/favicons?domain=sicredi.com.br&sz=64';
    if (n.includes('neon'))            return 'https://www.google.com/s2/favicons?domain=neon.com.br&sz=64';
    if (n.includes('carrefour'))       return 'https://www.google.com/s2/favicons?domain=carrefour.com.br&sz=64';
    if (n.includes('mercado livre') || n.includes('mercadolivre')) return 'https://www.google.com/s2/favicons?domain=mercadolivre.com.br&sz=64';
    return '';
  }
  private normalizeLogo(logo: string): string {
    if (!logo) return '';
    const GF = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
    const SI = (slug: string, color: string) => `https://cdn.simpleicons.org/${slug}/${color}`;
    const MAP: Record<string,string> = {
      'nubank.com.br':      SI('nubank','8a05be'),
      'bancointer.com.br':  SI('bancointer','ff7000'),
      'itau.com.br':        SI('itau','003d8f'),
      'bradesco.com.br':    SI('bradesco','cc092f'),
      'santander.com.br':   SI('santander','ec0000'),
      'caixa.gov.br':       GF('caixa.gov.br'),
      'bb.com.br':          SI('bancodobrasil','000000'),
      'mercadopago.com.br': SI('mercadopago','009ee3'),
      'picpay.com':         SI('picpay','21c25e'),
    };
    let m = logo.match(/logo\.clearbit\.com\/([^?/]+)/);
    if (m) return MAP[m[1]] ?? GF(m[1]);
    m = logo.match(/https?:\/\/([^/]+)\/apple-touch-icon/);
    if (m) { const d = m[1].replace(/^www\./, ''); return MAP[d] ?? GF(d); }
    m = logo.match(/favicons\?domain=([^&]+)/);
    if (m) return MAP[m[1]] ?? GF(m[1]);
    return logo;
  }

  ngOnInit() {
    const now  = new Date();
    const year = now.getFullYear();
    const mon  = now.getMonth() + 1;

    // Current month for income/expense/category totals
    const from = `${year}-${String(mon).padStart(2,'0')}-01`;
    const to   = new Date(year, mon, 0).toISOString().slice(0, 10);

    // Wider range for unpaid bills (3 months back to 2 months ahead)
    const billFrom = new Date(year, mon - 4, 1).toISOString().slice(0, 10);
    const billTo   = new Date(year, mon + 2, 0).toISOString().slice(0, 10);

    forkJoin({
      txs:    this.api.get<any>('/transactions', { date_from: from, date_to: to, limit: 500 }).pipe(catchError(() => of({ data: [] }))),
      bills:  this.api.get<any>('/transactions', { date_from: billFrom, date_to: billTo, limit: 500 }).pipe(catchError(() => of({ data: [] }))),
      accs:   this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] }))),
      ccs:    this.api.get<any>('/credit-cards').pipe(catchError(() => of({ data: [] }))),
      limits: this.api.get<any>('/spending-limits').pipe(catchError(() => of({ data: [] }))),
      cats:   this.api.get<any>('/categories').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(({ txs, bills, accs, ccs, limits, cats }) => {
      const list: any[]     = txs.data ?? [];
      const billList: any[] = bills.data ?? [];

      // Income / expense for current month
      const inc = list.filter(t => t.type === 'income'  && !t.ignored).reduce((s: number, t: any) => s + t.amount, 0);
      const exp = list.filter(t => t.type === 'expense' && !t.ignored).reduce((s: number, t: any) => s + t.amount, 0);
      this.income.set(inc);
      this.expense.set(exp);

      // Top categories from current month expenses
      const catMap = new Map<string, { category: string; color: string; total: number }>();
      list.filter(t => t.type === 'expense' && !t.ignored).forEach(t => {
        const cat   = t.category?.name ?? 'Sem categoria';
        const color = t.category?.color ?? '#6b7280';
        if (!catMap.has(cat)) catMap.set(cat, { category: cat, color, total: 0 });
        catMap.get(cat)!.total += t.amount;
      });
      const topCats = [...catMap.values()]
     
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      const totalExp = topCats.reduce((s, c) => s + c.total, 0) || 1;
      this.topCategories.set(topCats.map(c => ({ ...c, pct: Math.round((c.total / totalExp) * 100) })));

      // Accounts, cards, categories
      this.accounts.set((accs.data ?? []).map((a: any) => ({ ...a, logo: this.inferLogo(a.name, this.normalizeLogo(a.logo)) })));
      this.cards.set((ccs.data ?? []).map((c: any) => ({ ...c, logo: this.inferLogo(c.name, this.normalizeLogo(c.logo)) })));
      this._categories.set(cats.data ?? []);

      // Spending limits — backend returns current_spend and usage_pct already
      this.spendingLimits.set(limits.data ?? []);

      // Unpaid bills from the wider date range
      const allBills = billList.filter((t: any) => !t.paid && !t.ignored);
      this.payableBills.set(
        allBills.filter((t: any) => t.type === 'expense')
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
      this.receivableBills.set(
        allBills.filter((t: any) => t.type === 'income')
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );

      this.loading.set(false);
    });
  }
}
