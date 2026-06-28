import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
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

      <!-- ── First-visit skeleton overlay ── -->
      @if (firstVisit() && loading()) {
        <div class="fv-overlay">
          <div class="fv-inner">

            <!-- hero -->
            <div class="fv-hero">
              <div class="fv-greeting">
                <div class="sk sk--name"></div>
                <div class="sk sk--sub"></div>
              </div>
              <div class="fv-hero-cards">
                <div class="sk sk--hero-card"></div>
                <div class="sk sk--hero-card"></div>
              </div>
            </div>

            <!-- two-column grid -->
            <div class="fv-grid">
              <!-- left column -->
              <div class="fv-col">
                <div class="fv-card">
                  <div class="sk sk--label"></div>
                  <div class="sk sk--big"></div>
                  <div class="sk sk--row"></div>
                  <div class="sk sk--row"></div>
                  <div class="sk sk--row"></div>
                </div>
                <div class="fv-card">
                  <div class="sk sk--label"></div>
                  <div class="sk sk--row"></div>
                  <div class="sk sk--row"></div>
                  <div class="sk sk--row"></div>
                </div>
              </div>
              <!-- right column -->
              <div class="fv-col">
                <div class="fv-card">
                  <div class="sk sk--label"></div>
                  <div class="sk sk--row"></div>
                  <div class="sk sk--row"></div>
                </div>
                <div class="fv-card">
                  <div class="sk sk--label"></div>
                  <div class="sk sk--donut">
                    <div class="sk sk--circle"></div>
                    <div class="fv-cat-lines">
                      <div class="sk sk--cat"></div>
                      <div class="sk sk--cat"></div>
                      <div class="sk sk--cat"></div>
                    </div>
                  </div>
                </div>
                <div class="fv-card">
                  <div class="sk sk--label"></div>
                  <div class="sk sk--row"></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      }

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
                  <div class="bill-row" [class.bill-row--paid]="bill.paid">
                    <div class="bill-icon" [style.background]="billColor(bill, '#ef4444')" [class.bill-icon--emoji]="!!billCat(bill)?.icon">{{ billIcon(bill) }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt">{{ bill.amount | appCurrency }}</span>
                    @if (!bill.paid) {
                      <button class="pay-btn" title="Clique para marcar como pago"
                              [disabled]="markingPaid.has(bill.id)"
                              (click)="markPaid(bill)">👍</button>
                    } @else {
                      <span class="pay-done">✓</span>
                    }
                  </div>
                }
              }
              @if (upcomingPayable().length > 0) {
                <p class="section-label">{{ 'dashboard.upcoming' | translate }}</p>
                @for (bill of upcomingPayable().slice(0, 4); track bill.id) {
                  <div class="bill-row" [class.bill-row--paid]="bill.paid">
                    <div class="bill-icon" [style.background]="billColor(bill, '#6b7280')" [class.bill-icon--emoji]="!!billCat(bill)?.icon">{{ billIcon(bill) }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt">{{ bill.amount | appCurrency }}</span>
                    @if (!bill.paid) {
                      <button class="pay-btn" title="Clique para marcar como pago"
                              [disabled]="markingPaid.has(bill.id)"
                              (click)="markPaid(bill)">👍</button>
                    } @else {
                      <span class="pay-done">✓</span>
                    }
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
                  <div class="bill-row" [class.bill-row--paid]="bill.paid">
                    <div class="bill-icon" [style.background]="billColor(bill, '#16a34a')" [class.bill-icon--emoji]="!!billCat(bill)?.icon">{{ billIcon(bill) }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt bill-amt--income">{{ bill.amount | appCurrency }}</span>
                    @if (!bill.paid) {
                      <button class="pay-btn" title="Clique para marcar como recebido"
                              [disabled]="markingPaid.has(bill.id)"
                              (click)="markPaid(bill)">👍</button>
                    } @else {
                      <span class="pay-done">✓</span>
                    }
                  </div>
                }
              }
              @if (upcomingReceivable().length > 0) {
                <p class="section-label">{{ 'dashboard.upcoming' | translate }}</p>
                @for (bill of upcomingReceivable().slice(0, 4); track bill.id) {
                  <div class="bill-row" [class.bill-row--paid]="bill.paid">
                    <div class="bill-icon" [style.background]="billColor(bill, '#16a34a')" [class.bill-icon--emoji]="!!billCat(bill)?.icon">{{ billIcon(bill) }}</div>
                    <div class="bill-info">
                      <span class="bill-name">{{ bill.description }}</span>
                      <span class="bill-date">{{ bill.date | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="bill-amt bill-amt--income">{{ bill.amount | appCurrency }}</span>
                    @if (!bill.paid) {
                      <button class="pay-btn" title="Clique para marcar como recebido"
                              [disabled]="markingPaid.has(bill.id)"
                              (click)="markPaid(bill)">👍</button>
                    } @else {
                      <span class="pay-done">✓</span>
                    }
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

          <!-- Resultado do mês — visualização mensal -->
          @if (!loading()) {
            <div class="card mt">
              <div class="flow-header">
                <p class="section-label" style="margin-top:0">{{ 'dashboard.month_result' | translate }}</p>
                <div class="flow-legend">
                  <span class="flow-legend-dot flow-legend-dot--in"></span><span>Receitas</span>
                  <span class="flow-legend-dot flow-legend-dot--ex"></span><span>Despesas</span>
                </div>
              </div>

              @if (monthlyFlow().length > 0) {
                <div class="flow-chart">
                  @for (m of monthlyFlow(); track m.month) {
                    <div class="flow-col">
                      <div class="flow-bars">
                        <div class="flow-bar flow-bar--in"
                             [style.height]="flowBarH(m.income) + '%'"
                             [title]="m.income | appCurrency"></div>
                        <div class="flow-bar flow-bar--ex"
                             [style.height]="flowBarH(m.expense) + '%'"
                             [title]="m.expense | appCurrency"></div>
                      </div>
                      <span class="flow-month-label">{{ flowMonthLabel(m.month) }}</span>
                    </div>
                  }
                </div>
              }

              <div class="result-row" [class.negative]="balance() < 0">
                <span>{{ balance() < 0 ? ('dashboard.deficit' | translate) : ('dashboard.balance' | translate) }}</span>
                <span class="result-val">{{ balance() | appCurrency }}</span>
              </div>
              <a routerLink="/reports/flow" class="manage-link">{{ 'dashboard.see_flow_report' | translate }}</a>
            </div>
          }
        </div>
      </div>

      <!-- ── Evolução de Patrimônio (multi-carteira) ──────────────── -->
      @if (!loading() && patrimonySnapshots().length > 0) {
        <div class="card mt patrimony-card">
          <div class="patrimony-header">
            <p class="section-label" style="margin-top:0">Evolução do Patrimônio</p>
            <a routerLink="/patrimony" class="manage-link" style="margin-top:0">Ver detalhes →</a>
          </div>

          <!-- Legend -->
          <div class="pat-legend">
            @for (w of patWalletLines(); track w.name) {
              <span class="pat-legend-item">
                <span class="pat-legend-dot" [style.background]="w.color"></span>{{ w.name }}
              </span>
            }
          </div>

          <!-- Chart -->
          <div class="patrimony-chart">
            <svg [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH" preserveAspectRatio="none" class="pat-svg">
              <!-- Grid lines -->
              @for (y of chartYLines(); track y.v) {
                <line [attr.x1]="padL" [attr.x2]="chartW - padR"
                      [attr.y1]="y.py" [attr.y2]="y.py"
                      stroke="#f3f4f6" stroke-width="1"/>
                <text [attr.x]="padL - 6" [attr.y]="y.py + 4"
                      text-anchor="end" font-size="10" fill="#9ca3af">{{ y.label }}</text>
              }
              <!-- X labels -->
              @for (m of patAllMonths(); track m.month; let i = $index) {
                <text [attr.x]="patXPos(i)" [attr.y]="chartH - 2"
                      text-anchor="middle" font-size="9" fill="#9ca3af">{{ m.label }}</text>
              }
              <!-- One line + area per wallet -->
              @for (w of patWalletLines(); track w.name) {
                <path [attr.d]="w.areaPath" [attr.fill]="w.color" fill-opacity="0.07" stroke="none"/>
                <path [attr.d]="w.linePath" fill="none" [attr.stroke]="w.color" stroke-width="2" stroke-linejoin="round"/>
                @for (pt of w.points; track pt.month) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5"
                          fill="#fff" [attr.stroke]="w.color" stroke-width="2"/>
                }
              }
            </svg>
          </div>

          <!-- Wallet cards -->
          <div class="pat-wallet-grid">
            @for (w of patWalletCards(); track w.name) {
              <div class="pat-wcard">
                <span class="pat-wcard__name">
                  <span class="pat-wcard__dot" [style.background]="w.color"></span>{{ w.name }}
                </span>
                <span class="pat-wcard__total">{{ w.latest | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</span>
                <span class="pat-wcard__delta" [class.pos]="w.deltaPct >= 0" [class.neg-val]="w.deltaPct < 0">
                  {{ w.deltaPct >= 0 ? '▲' : '▼' }} {{ w.deltaPct | number:'1.1-1' }}%
                </span>
              </div>
            }
            <!-- Consolidated -->
            @if (patWalletCards().length > 1) {
              <div class="pat-wcard pat-wcard--total">
                <span class="pat-wcard__name">
                  <span class="pat-wcard__dot" style="background:#6b7280"></span>Total consolidado
                </span>
                <span class="pat-wcard__total">{{ patConsolidated() | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</span>
              </div>
            }
          </div>
        </div>
      }
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
    .bill-row--paid { opacity: .5; }
    .pay-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 0 .25rem; opacity: .35; transition: opacity .15s, transform .1s; flex-shrink: 0; }
    .pay-btn:hover { opacity: 1; transform: scale(1.2); }
    .pay-btn:disabled { cursor: default; opacity: .2; }
    .pay-done { color: #16a34a; font-size: .85rem; font-weight: 700; flex-shrink: 0; }
    .bill-icon {
      width: 32px; height: 32px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: .85rem; flex-shrink: 0;
    }
    .bill-icon--emoji { font-size: 1rem; color: inherit; }
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
    .flow-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .75rem; }
    .flow-legend { display: flex; align-items: center; gap: .5rem; font-size: .72rem; color: #6b7280; }
    .flow-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
    .flow-legend-dot--in { background: #16a34a; }
    .flow-legend-dot--ex { background: #ef4444; }
    .flow-chart { display: flex; align-items: flex-end; gap: .3rem; height: 80px; margin-bottom: .75rem; }
    .flow-col { display: flex; flex-direction: column; align-items: center; flex: 1; gap: .25rem; height: 100%; }
    .flow-bars { display: flex; align-items: flex-end; gap: 2px; flex: 1; width: 100%; }
    .flow-bar { flex: 1; border-radius: 3px 3px 0 0; min-height: 2px; transition: height .3s ease; }
    .flow-bar--in { background: #16a34a; }
    .flow-bar--ex { background: #ef4444; opacity: .85; }
    .flow-month-label { font-size: .65rem; color: #9ca3af; white-space: nowrap; }
    .result-row { display: flex; justify-content: space-between; align-items: center; padding: .75rem 0; border-top: 1px solid #f3f4f6; }
    .result-val { font-size: 1.15rem; font-weight: 700; color: #16a34a; }
    .result-row.negative .result-val { color: #dc2626; }

    /* Patrimônio chart */
    .patrimony-card { margin-top: 1.25rem; }
    .patrimony-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem; }
    .pat-legend { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .pat-legend-item { display: flex; align-items: center; gap: .35rem; font-size: .78rem; color: #374151; }
    .pat-legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .patrimony-chart { width: 100%; height: 160px; }
    .pat-svg { width: 100%; height: 100%; overflow: visible; }
    .pat-wallet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: .5rem; margin-top: 1rem; padding-top: .75rem; border-top: 1px solid #f3f4f6; }
    .pat-wcard { background: #f8fafc; border-radius: .375rem; padding: .6rem .75rem; display: flex; flex-direction: column; gap: .15rem; }
    .pat-wcard--total { background: #f0fdf4; border: 1px solid #dcfce7; }
    .pat-wcard__name { display: flex; align-items: center; gap: .35rem; font-size: .72rem; color: #6b7280; }
    .pat-wcard__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .pat-wcard__total { font-size: .97rem; font-weight: 700; color: #111; }
    .pat-wcard__delta { font-size: .72rem; font-weight: 600; }
    .pos { color: #16a34a; }
    .neg-val { color: #dc2626; }

    /* ── First-visit overlay skeleton ── */
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    .sk {
      border-radius: .5rem;
      background: linear-gradient(90deg, #ececec 25%, #d8d8d8 50%, #ececec 75%);
      background-size: 1200px 100%;
      animation: shimmer 1.6s ease-in-out infinite;
    }
    .fv-overlay {
      position: fixed; inset: 0; background: #f9fafb; z-index: 500;
      overflow-y: auto; padding: 2rem 1.5rem;
      animation: fv-fade-in .2s ease;
    }
    @keyframes fv-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .fv-inner { max-width: 1100px; margin: 0 auto; }

    /* hero */
    .fv-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .fv-greeting { display: flex; flex-direction: column; gap: .5rem; }
    .sk--name { width: 220px; height: 1.8rem; }
    .sk--sub  { width: 140px; height: 1rem; }
    .fv-hero-cards { display: flex; gap: 1rem; }
    .sk--hero-card { width: 140px; height: 56px; border-radius: .75rem; }

    /* grid */
    .fv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    @media (max-width: 700px) { .fv-grid { grid-template-columns: 1fr; } }
    .fv-col { display: flex; flex-direction: column; gap: 1.25rem; }
    .fv-card {
      background: #fff; border-radius: .75rem; padding: 1.25rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      display: flex; flex-direction: column; gap: .6rem;
    }
    .sk--label { width: 100px; height: .75rem; border-radius: .25rem; }
    .sk--big   { width: 160px; height: 2rem; }
    .sk--row   { width: 100%; height: 42px; border-radius: .375rem; }
    .sk--donut { display: flex; align-items: center; gap: 1rem; }
    .sk--circle { width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0; }
    .fv-cat-lines { flex: 1; display: flex; flex-direction: column; gap: .5rem; }
    .sk--cat { width: 100%; height: 14px; border-radius: .25rem; }
    .sk--cat:nth-child(2) { width: 75%; }
    .sk--cat:nth-child(3) { width: 55%; }

    /* Existing inline skeleton */
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
  private api   = inject(ApiService);
  private auth  = inject(AuthService);
  private i18n  = inject(TranslationService);
  private toast = inject(ToastService);

  markingPaid = new Set<string>();

  markPaid(bill: any) {
    if (this.markingPaid.has(bill.id)) return;
    this.markingPaid.add(bill.id);
    this.api.patch<any>(`/transactions/${bill.id}/pay`, {}).subscribe({
      next: () => {
        bill.paid = true;
        this.markingPaid.delete(bill.id);
        const msg = bill.type === 'income' ? 'marcado como recebido!' : 'marcado como pago!';
        this.toast.success(`"${bill.description}" ${msg}`);
        // Recarrega saldo das contas para refletir no Saldo Geral
        this.api.get<any>('/accounts').subscribe(res => {
          const raw: any[] = res.data ?? [];
          this.accounts.set(raw.map((a: any) => ({ ...a, logo: this.inferLogo(a.name, this.normalizeLogo(a.logo)) })));
        });
      },
      error: () => {
        this.markingPaid.delete(bill.id);
        this.toast.error('Erro ao marcar como pago');
      }
    });
  }

  readonly C = 2 * Math.PI * 38; // SVG donut circumference ≈ 238.76

  loading     = signal(true);
  firstVisit  = signal(!sessionStorage.getItem('dash_visited'));
  income  = signal(0);
  expense = signal(0);
  balance = computed(() => this.income() - this.expense());

  flowBarH(val: number): number {
    const max = Math.max(...this.monthlyFlow().map(m => Math.max(m.income, m.expense)), 1);
    return Math.round((val / max) * 100);
  }

  flowMonthLabel(month: string): string {
    const [y, m] = month.split('-');
    const d = new Date(+y, +m - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  }

  accounts        = signal<any[]>([]);
  cards           = signal<any[]>([]);
  payableBills    = signal<any[]>([]);
  receivableBills = signal<any[]>([]);
  topCategories   = signal<any[]>([]);
  spendingLimits  = signal<any[]>([]);
  _categories     = signal<any[]>([]);

  totalBalance     = computed(() => this.accounts().reduce((s, a) => s + (a.balance ?? 0), 0));
  totalCardExpense = computed(() => this.cards().reduce((s, c) => s + (c.current_invoice ?? 0), 0));

  // Patrimony chart (multi-wallet)
  patrimonySnapshots = signal<any[]>([]);
  monthlyFlow = signal<any[]>([]);
  readonly chartW = 800; readonly chartH = 140; readonly padL = 60; readonly padR = 20; readonly padT = 12; readonly padB = 22;
  private readonly PAT_COLORS = ['#2563eb','#16a34a','#d97706','#9333ea','#e11d48','#0891b2','#ca8a04','#16a34a'];

  // All unique months sorted across all wallets
  patAllMonths = computed(() => {
    const months = [...new Set(this.patrimonySnapshots().map((s: any) => s.month))].sort();
    return months.map(m => ({ month: m, label: m.slice(5,7) + '/' + m.slice(2,4) }));
  });

  // Shared Y bounds across all wallets
  private patYBounds = computed(() => {
    const vals = this.patrimonySnapshots().map((s: any) => s.total);
    if (!vals.length) return { min: 0, max: 1 };
    const min = Math.min(...vals) * 0.97;
    const max = Math.max(...vals) * 1.03;
    return { min, max: max === min ? min + 1 : max };
  });

  patXPos(i: number): number {
    const n = this.patAllMonths().length;
    const W = this.chartW - this.padL - this.padR;
    return this.padL + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  }

  private patYPos(val: number): number {
    const { min, max } = this.patYBounds();
    const H = this.chartH - this.padT - this.padB;
    return this.padT + H - ((val - min) / (max - min)) * H;
  }

  // One entry per wallet with computed line/area paths and points
  patWalletLines = computed(() => {
    const months = this.patAllMonths();
    const all = this.patrimonySnapshots();
    const walletNames = [...new Set(all.map((s: any) => s.wallet_name))].sort();
    return walletNames.map((name, ci) => {
      const color = this.PAT_COLORS[ci % this.PAT_COLORS.length];
      const byMonth = new Map(all.filter((s: any) => s.wallet_name === name).map((s: any) => [s.month, s.total]));
      const pts = months
        .map((m, i) => byMonth.has(m.month) ? { x: this.patXPos(i), y: this.patYPos(byMonth.get(m.month)!), month: m.month } : null)
        .filter(Boolean) as { x: number; y: number; month: string }[];
      if (!pts.length) return null;
      const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
      const bottom = this.chartH - this.padB;
      const areaPath = `${linePath} L${pts[pts.length-1].x},${bottom} L${pts[0].x},${bottom} Z`;
      return { name, color, points: pts, linePath, areaPath };
    }).filter(Boolean);
  });

  // Summary cards per wallet
  patWalletCards = computed(() => {
    const all = this.patrimonySnapshots();
    const walletNames = [...new Set(all.map((s: any) => s.wallet_name))].sort();
    return walletNames.map((name, ci) => {
      const data = all.filter((s: any) => s.wallet_name === name).sort((a: any, b: any) => a.month.localeCompare(b.month));
      const latest = data.length ? data[data.length - 1].total : 0;
      const first = data.length ? data[0].total : 0;
      const deltaPct = first > 0 ? ((latest - first) / first) * 100 : 0;
      return { name, color: this.PAT_COLORS[ci % this.PAT_COLORS.length], latest, deltaPct };
    });
  });

  patConsolidated = computed(() =>
    this.patWalletCards().reduce((s: number, w: any) => s + w.latest, 0)
  );

  chartYLines = computed(() => {
    const { min, max } = this.patYBounds();
    const H = this.chartH - this.padT - this.padB;
    const fmt = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0);
    return [0, 0.5, 1].map(t => ({
      v: min + t * (max - min),
      py: this.padT + H - t * H,
      label: fmt(min + t * (max - min))
    }));
  });

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

  limitName(lim: any): string {
    const cat = this._categories().find((c: any) => c.id === lim.category_id);
    if (cat) return cat.name;
    const acc = this.accounts().find((a: any) => a.id === lim.account_id);
    if (acc) return acc.name;
    return 'Limite global';
  }

  billCat(bill: any): any {
    return this._categories().find((c: any) => c.id === bill.category_id) ?? null;
  }

  billIcon(bill: any): string {
    const cat = this.billCat(bill);
    if (cat?.icon) return cat.icon;
    return (bill.description ?? '?')[0].toUpperCase();
  }

  billColor(bill: any, fallback: string): string {
    const cat = this.billCat(bill);
    if (cat?.icon) return '#f3f4f6';
    return cat?.color ?? fallback;
  }
}
