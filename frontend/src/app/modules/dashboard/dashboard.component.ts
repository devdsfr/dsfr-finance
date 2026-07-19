import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { ConfigurableDashboardComponent } from './configurable-dashboard.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-BR', en: 'en-US', ro: 'ro-RO' };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, AppCurrencyPipe, ConfigurableDashboardComponent],
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
            <div class="ms-sep"></div>
            <div class="ms-item">
              <span class="ms-label">Saldo do mês</span>
              @if (loading()) { <span class="skel skel--val"></span> }
              @else { <span class="ms-value" [class.ms-value--income]="balance() >= 0" [class.ms-value--expense]="balance() < 0">{{ balance() | appCurrency }}</span> }
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
          <button class="export-all-btn" (click)="exportAll()" [disabled]="exportingAll()">
            @if (exportingAll()) { <span class="export-spinner">⏳</span> Exportando… }
            @else { <span>📊</span> Exportar todos os dados }
          </button>
        </div>
      </div>

      <!-- ── Termômetro Financeiro ────────────────────────────── -->
      @if (!loading()) {
        <div class="card thermo">
          <div class="thermo__head">
            <div>
              <p class="card__sup">🌡️ Termômetro Financeiro</p>
              <p class="thermo__verdict" [style.color]="health().color">{{ health().label }}</p>
            </div>
            <div class="thermo__score" [style.color]="health().color">
              {{ health().score }}<span class="thermo__score-max">/100</span>
            </div>
          </div>

          <!-- Barra do termômetro -->
          <div class="thermo__bar">
            <div class="thermo__track"></div>
            <div class="thermo__marker" [style.left.%]="health().score">
              <span class="thermo__pin" [style.background]="health().color"></span>
            </div>
          </div>
          <div class="thermo__scale">
            <span>Crítico</span><span>Risco</span><span>Atenção</span><span>Saudável</span><span>Excelente</span>
          </div>

          <!-- Pilares -->
          <div class="thermo__pillars">
            @for (p of health().pillars; track p.key) {
              <div class="pillar" [class.pillar--good]="p.status === 'good'"
                   [class.pillar--warn]="p.status === 'warn'"
                   [class.pillar--bad]="p.status === 'bad'">
                <span class="pillar__icon">{{ p.status === 'good' ? '✓' : p.status === 'warn' ? '!' : '✕' }}</span>
                <div class="pillar__txt">
                  <span class="pillar__name">{{ p.name }}</span>
                  <span class="pillar__detail">{{ p.detail }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Dicas -->
          <p class="section-label thermo__tips-label">💡 3 dicas para estabilizar sua vida financeira</p>
          <div class="thermo__tips">
            @for (t of health().tips; track $index; let i = $index) {
              <div class="tip" [class.tip--urgent]="t.severity === 'high'"
                   [class.tip--medium]="t.severity === 'medium'">
                <span class="tip__num">{{ i + 1 }}</span>
                <div>
                  <strong class="tip__title">{{ t.title }}</strong>
                  <p class="tip__body">{{ t.body }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── Configurable dashboard (Meu Painel) ──────────────── -->
      <app-configurable-dashboard />

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
                @if (acc.icon && acc.icon.endsWith('.svg')) {
                  <div class="acc-icon acc-icon--img">
                    <img [src]="'assets/icons/' + acc.icon" [alt]="acc.name" class="acc-logo" />
                  </div>
                } @else if (acc.logo) {
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
              <p class="section-label" style="margin-top:0">
                {{ 'dashboard.payable' | translate }}
                <span class="bill-total bill-total--expense">{{ totalPayable() | appCurrency }}</span>
              </p>
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
                @for (bill of (showAllPayable() ? upcomingPayable() : upcomingPayable().slice(0, 4)); track bill.id) {
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
              @if (upcomingPayable().length > 4) {
                <button class="manage-link" (click)="showAllPayable.set(!showAllPayable())">
                  {{ showAllPayable() ? 'ver menos ▲' : 'ver mais ▼' }}
                </button>
              }
            </div>
          }

          <!-- ── Calculadora Dinâmica ── -->
          @if (!loading()) {
            <div class="card mt calc-card">
              <p class="section-label" style="margin-top:0">Calculadora de Caixa</p>

              <!-- Fluxo: saldo → receber → pagar -->
              <div class="calc-flow">
                <div class="calc-cell">
                  <span class="calc-cell__lbl">Saldo atual</span>
                  <span class="calc-cell__val" [class.calc-val--neg]="totalBalance() < 0">
                    {{ totalBalance() | appCurrency }}
                  </span>
                </div>
                <div class="calc-op calc-op--in">+</div>
                <div class="calc-cell">
                  <span class="calc-cell__lbl">A receber</span>
                  <span class="calc-cell__val calc-val--in">{{ totalReceivable() | appCurrency }}</span>
                </div>
                <div class="calc-op calc-op--out">−</div>
                <div class="calc-cell">
                  <span class="calc-cell__lbl">A pagar</span>
                  <span class="calc-cell__val calc-val--out">{{ totalPayable() | appCurrency }}</span>
                </div>
              </div>

              <!-- Resultado projetado -->
              <div class="calc-result" [class.calc-result--neg]="projectedCash() < 0">
                <div class="calc-result__left">
                  <span class="calc-result__eq">=</span>
                  <span class="calc-result__lbl">Saldo projetado</span>
                </div>
                <span class="calc-result__val">{{ projectedCash() | appCurrency }}</span>
              </div>

              <!-- Simulador -->
              <div class="calc-sim">
                <p class="calc-sim__title">Simular impacto</p>
                <div class="calc-sim__row">
                  <div class="calc-sign-group">
                    <button class="calc-sign"
                            [class.calc-sign--active-pos]="simSign() === '+'"
                            (click)="simSign.set('+')">+</button>
                    <button class="calc-sign"
                            [class.calc-sign--active-neg]="simSign() === '-'"
                            (click)="simSign.set('-')">−</button>
                  </div>
                  <input class="calc-input" type="number" min="0" step="0.01"
                         placeholder="Digite um valor…"
                         [value]="simAmount() || ''"
                         (input)="updateSimAmount($event)" />
                  @if (simAmount() > 0) {
                    <button class="calc-clear" (click)="simAmount.set(0)" title="Limpar">✕</button>
                  }
                </div>

                @if (simAmount() > 0) {
                  <div class="calc-sim__preview"
                       [class.calc-sim__preview--pos]="simulatedCash() >= 0"
                       [class.calc-sim__preview--neg]="simulatedCash() < 0">
                    <span class="calc-sim__preview-lbl">Com simulação:</span>
                    <span class="calc-sim__preview-val">{{ simulatedCash() | appCurrency }}</span>
                    <span class="calc-sim__delta"
                          [class.delta--pos]="simSign() === '+'"
                          [class.delta--neg]="simSign() === '-'">
                      {{ simSign() === '+' ? '▲' : '▼' }} {{ simAmount() | appCurrency }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Contas a receber -->
          @if (!loading() && receivableBills().length > 0) {
            <div class="card mt">
              <p class="section-label" style="margin-top:0">
                {{ 'dashboard.receivable' | translate }}
                <span class="bill-total bill-total--income">{{ totalReceivable() | appCurrency }}</span>
              </p>
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
                @for (bill of (showAllReceivable() ? upcomingReceivable() : upcomingReceivable().slice(0, 4)); track bill.id) {
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
              @if (upcomingReceivable().length > 4) {
                <button class="manage-link" (click)="showAllReceivable.set(!showAllReceivable())">
                  {{ showAllReceivable() ? 'ver menos ▲' : 'ver mais ▼' }}
                </button>
              }
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
                  @if (card.asset) {
                    <div class="card-icon card-icon--img">
                      <img [src]="'assets/banks/' + card.asset" [alt]="card.name" class="card-logo" />
                    </div>
                  } @else if (card.siSlug) {
                    <div class="card-icon" [style.background]="card.color ?? '#6366f1'">
                      <img [src]="'https://cdn.simpleicons.org/' + card.siSlug + '/ffffff'" [alt]="card.name" class="card-logo"
                           (error)="$any($event.target).style.display='none'; $any($event.target).parentElement.textContent=card.name[0]" />
                    </div>
                  } @else if (card.logo) {
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
                  <a [routerLink]="['/reports/card-invoices']" [queryParams]="{card_id: card.id}" class="ver-fatura">{{ 'dashboard.see_invoice' | translate }}</a>
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
                      <span class="cat-name">{{ c.category ?? c.category_name }}</span>
                      <span class="cat-amt">{{ c.total | appCurrency }}</span>
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

    .export-all-btn {
      margin-top: .65rem; display: flex; align-items: center; gap: .4rem;
      padding: .45rem 1rem; background: #217346; color: #fff;
      border: none; border-radius: .4rem; font-size: .8rem; font-weight: 600;
      cursor: pointer; transition: background .15s; white-space: nowrap; width: 100%;
      justify-content: center;
    }
    .export-all-btn:hover:not(:disabled) { background: #185c38; }
    .export-all-btn:disabled { opacity: .6; cursor: default; }
    .export-spinner { animation: spin .8s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

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
      transition: border-color .15s; background: none; cursor: pointer; width: 100%;
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
    .bill-total { float: right; font-size: .85rem; font-weight: 700; }
    .bill-total--expense { color: #dc2626; }
    .bill-total--income { color: #16a34a; }

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
    .cat-amt { font-size: .75rem; color: #6b7280; margin-right: .2rem; white-space: nowrap; }
    .cat-pct { font-weight: 700; color: #111; white-space: nowrap; }
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
    .flow-chart { display: flex; align-items: flex-end; gap: .3rem; height: 130px; margin-bottom: .75rem; }
    .flow-col { display: flex; flex-direction: column; align-items: center; flex: 1; gap: .25rem; height: 100%; }
    .flow-bars { display: flex; align-items: flex-end; gap: 2px; flex: 1; width: 100%; }
    .flow-bar { flex: 1; border-radius: 3px 3px 0 0; min-height: 2px; transition: height .3s ease; }
    .flow-bar--in { background: #16a34a; }
    .flow-bar--ex { background: #ef4444; opacity: .85; }
    .flow-month-label { font-size: .65rem; color: #9ca3af; white-space: nowrap; }
    .result-row { display: flex; justify-content: space-between; align-items: center; padding: .75rem 0; border-top: 1px solid #f3f4f6; }
    .result-val { font-size: 1.15rem; font-weight: 700; color: #16a34a; }
    .result-row.negative .result-val { color: #dc2626; }

    /* ── Calculadora Dinâmica ── */
    .calc-card { }

    .calc-flow {
      display: flex; align-items: stretch; gap: .35rem;
      margin: .5rem 0 .65rem;
    }
    .calc-cell {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      text-align: center; background: #f8fafc; border-radius: .5rem;
      padding: .55rem .4rem; min-width: 0;
    }
    .calc-cell__lbl {
      font-size: .63rem; color: #9ca3af; text-transform: uppercase;
      letter-spacing: .04em; margin-bottom: .2rem; white-space: nowrap;
    }
    .calc-cell__val {
      font-size: .88rem; font-weight: 700; color: #111;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
    }
    .calc-val--in  { color: #16a34a; }
    .calc-val--out { color: #dc2626; }
    .calc-val--neg { color: #dc2626; }

    .calc-op {
      display: flex; align-items: center; font-size: 1.1rem; font-weight: 700;
      color: #d1d5db; flex-shrink: 0; padding: 0 .1rem;
    }
    .calc-op--in  { color: #86efac; }
    .calc-op--out { color: #fca5a5; }

    .calc-result {
      display: flex; align-items: center; justify-content: space-between;
      padding: .6rem .85rem; border-radius: .5rem;
      background: #f0fdf4; border: 1.5px solid #bbf7d0;
      margin-bottom: .75rem;
    }
    .calc-result--neg { background: #fef2f2; border-color: #fecaca; }
    .calc-result__left { display: flex; align-items: center; gap: .5rem; }
    .calc-result__eq { font-size: 1.25rem; font-weight: 700; color: #9ca3af; line-height: 1; }
    .calc-result__lbl { font-size: .78rem; font-weight: 600; color: #374151; }
    .calc-result__val { font-size: 1.05rem; font-weight: 700; color: #16a34a; }
    .calc-result--neg .calc-result__val { color: #dc2626; }

    /* Simulador */
    .calc-sim { border-top: 1px solid #f3f4f6; padding-top: .65rem; }
    .calc-sim__title {
      font-size: .68rem; text-transform: uppercase; letter-spacing: .05em;
      color: #9ca3af; margin: 0 0 .45rem;
    }
    .calc-sim__row { display: flex; align-items: center; gap: .4rem; }
    .calc-sign-group { display: flex; border: 1.5px solid #e5e7eb; border-radius: .4rem; overflow: hidden; flex-shrink: 0; }
    .calc-sign {
      width: 30px; height: 30px; border: none; background: #fff;
      font-size: .95rem; font-weight: 700; color: #9ca3af; cursor: pointer;
      transition: all .12s; line-height: 1; display: flex; align-items: center; justify-content: center;
    }
    .calc-sign:hover { background: #f3f4f6; }
    .calc-sign--active-pos { background: #16a34a !important; color: #fff !important; }
    .calc-sign--active-neg { background: #dc2626 !important; color: #fff !important; }
    .calc-input {
      flex: 1; min-width: 0; padding: .38rem .6rem;
      border: 1.5px solid #e5e7eb; border-radius: .4rem;
      font-size: .85rem; color: #111; outline: none; transition: border-color .12s;
    }
    .calc-input:focus { border-color: #2e7736; }
    .calc-clear {
      width: 28px; height: 28px; border: none; background: #f3f4f6;
      border-radius: .375rem; cursor: pointer; color: #9ca3af;
      font-size: .75rem; flex-shrink: 0; transition: all .12s;
      display: flex; align-items: center; justify-content: center;
    }
    .calc-clear:hover { background: #fee2e2; color: #dc2626; }

    .calc-sim__preview {
      margin-top: .5rem; padding: .42rem .7rem; border-radius: .4rem;
      background: #f8fafc; display: flex; align-items: center; gap: .5rem;
      font-size: .8rem; border: 1px solid #e5e7eb;
    }
    .calc-sim__preview--pos { background: #f0fdf4; border-color: #bbf7d0; }
    .calc-sim__preview--neg { background: #fef2f2; border-color: #fecaca; }
    .calc-sim__preview-lbl { color: #6b7280; flex-shrink: 0; }
    .calc-sim__preview-val { font-weight: 700; flex: 1; }
    .calc-sim__preview--pos .calc-sim__preview-val { color: #16a34a; }
    .calc-sim__preview--neg .calc-sim__preview-val { color: #dc2626; }
    .calc-sim__delta { font-size: .72rem; font-weight: 600; white-space: nowrap; }
    .delta--pos { color: #16a34a; }
    .delta--neg { color: #dc2626; }

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

    /* ══ TERMÔMETRO FINANCEIRO ════════════════════════════════════════ */
    .thermo { margin-bottom: 1.25rem; }
    .thermo__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
    .thermo__verdict { font-size: 1.15rem; font-weight: 700; margin: .1rem 0 0; }
    .thermo__score { font-size: 2rem; font-weight: 800; line-height: 1; }
    .thermo__score-max { font-size: .9rem; font-weight: 600; opacity: .55; }

    .thermo__bar { position: relative; margin: 1.1rem 0 .35rem; height: 14px; }
    .thermo__track {
      height: 14px; border-radius: 9999px;
      background: linear-gradient(90deg,#dc2626 0%,#f97316 25%,#f59e0b 45%,#22c55e 70%,#16a34a 100%);
    }
    .thermo__marker { position: absolute; top: -4px; transform: translateX(-50%); transition: left .5s cubic-bezier(.34,1.2,.64,1); }
    .thermo__pin {
      display: block; width: 22px; height: 22px; border-radius: 50%;
      border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.28);
    }
    .thermo__scale { display: flex; justify-content: space-between; font-size: .65rem; color: #9ca3af; margin-bottom: 1.1rem; }

    .thermo__pillars { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .5rem; margin-bottom: 1.25rem; }
    .pillar { display: flex; align-items: flex-start; gap: .5rem; padding: .6rem .7rem; border-radius: .45rem; background: #f9fafb; border-left: 3px solid #d1d5db; }
    .pillar--good { background: #f0fdf4; border-left-color: #16a34a; }
    .pillar--warn { background: #fffbeb; border-left-color: #f59e0b; }
    .pillar--bad  { background: #fef2f2; border-left-color: #dc2626; }
    .pillar__icon { font-weight: 800; font-size: .8rem; line-height: 1.25; flex-shrink: 0; }
    .pillar--good .pillar__icon { color: #16a34a; }
    .pillar--warn .pillar__icon { color: #f59e0b; }
    .pillar--bad  .pillar__icon { color: #dc2626; }
    .pillar__txt { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
    .pillar__name { font-size: .78rem; font-weight: 700; color: #111; }
    .pillar__detail { font-size: .72rem; color: #6b7280; }

    .thermo__tips-label { margin-top: 0; }
    .thermo__tips { display: flex; flex-direction: column; gap: .5rem; }
    .tip { display: flex; gap: .7rem; padding: .75rem .85rem; border-radius: .45rem; background: #f9fafb; border-left: 3px solid #9ca3af; }
    .tip--urgent { background: #fef2f2; border-left-color: #dc2626; }
    .tip--medium { background: #fffbeb; border-left-color: #f59e0b; }
    .tip__num {
      flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
      background: rgba(0,0,0,.08); color: #374151;
      display: flex; align-items: center; justify-content: center;
      font-size: .7rem; font-weight: 800;
    }
    .tip__title { display: block; font-size: .85rem; color: #111; margin-bottom: .15rem; }
    .tip__body { margin: 0; font-size: .8rem; color: #4b5563; line-height: 1.55; }

    @media (max-width: 640px) {
      .thermo__score { font-size: 1.6rem; }
      .thermo__scale span:nth-child(2), .thermo__scale span:nth-child(4) { display: none; }
    }

    /* ══ DARK THEME ═══════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .hero,
    :host-context([data-theme="dark"]) .card,
    :host-context([data-theme="dark"]) .fv-card { background: #161c28 !important; }

    /* Termômetro financeiro */
    :host-context([data-theme="dark"]) .thermo__scale { color: #4f5f76 !important; }
    :host-context([data-theme="dark"]) .thermo__pin { border-color: #161c28 !important; }
    :host-context([data-theme="dark"]) .pillar { background: #1e2638 !important; border-left-color: #374151 !important; }
    :host-context([data-theme="dark"]) .pillar--good { background: rgba(22,163,74,.12) !important; border-left-color: #16a34a !important; }
    :host-context([data-theme="dark"]) .pillar--warn { background: rgba(245,158,11,.12) !important; border-left-color: #f59e0b !important; }
    :host-context([data-theme="dark"]) .pillar--bad  { background: rgba(220,38,38,.12) !important; border-left-color: #dc2626 !important; }
    :host-context([data-theme="dark"]) .pillar__name { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .pillar__detail { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .tip { background: #1e2638 !important; border-left-color: #374151 !important; }
    :host-context([data-theme="dark"]) .tip--urgent { background: rgba(220,38,38,.12) !important; border-left-color: #dc2626 !important; }
    :host-context([data-theme="dark"]) .tip--medium { background: rgba(245,158,11,.12) !important; border-left-color: #f59e0b !important; }
    :host-context([data-theme="dark"]) .tip__num { background: rgba(255,255,255,.1) !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .tip__title { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .tip__body { color: #8393ad !important; }

    :host-context([data-theme="dark"]) .greeting { color: #8393ad; }
    :host-context([data-theme="dark"]) .greeting strong { color: #e2e8f5; }
    :host-context([data-theme="dark"]) .ms-sep { background: #232d42 !important; }

    /* Borders */
    :host-context([data-theme="dark"]) .acc-row,
    :host-context([data-theme="dark"]) .bill-row,
    :host-context([data-theme="dark"]) .card-row,
    :host-context([data-theme="dark"]) .result-row,
    :host-context([data-theme="dark"]) .lim-row,
    :host-context([data-theme="dark"]) .card-limits,
    :host-context([data-theme="dark"]) .calc-sim,
    :host-context([data-theme="dark"]) .pat-wallet-grid { border-color: #232d42 !important; }

    /* Text */
    :host-context([data-theme="dark"]) .card__big,
    :host-context([data-theme="dark"]) .acc-name,
    :host-context([data-theme="dark"]) .card-name,
    :host-context([data-theme="dark"]) .bill-name,
    :host-context([data-theme="dark"]) .lim-name,
    :host-context([data-theme="dark"]) .cat-pct,
    :host-context([data-theme="dark"]) .cl-val,
    :host-context([data-theme="dark"]) .pat-wcard__total { color: #e2e8f5 !important; }

    :host-context([data-theme="dark"]) .card__sup,
    :host-context([data-theme="dark"]) .section-label,
    :host-context([data-theme="dark"]) .acc-type,
    :host-context([data-theme="dark"]) .card-sub,
    :host-context([data-theme="dark"]) .bill-date,
    :host-context([data-theme="dark"]) .lim-detail,
    :host-context([data-theme="dark"]) .cat-amt,
    :host-context([data-theme="dark"]) .pat-wcard__name { color: #8393ad !important; }

    :host-context([data-theme="dark"]) .cat-name,
    :host-context([data-theme="dark"]) .bill-amt,
    :host-context([data-theme="dark"]) .pat-legend-item { color: #c5cdd9 !important; }

    /* Links & buttons */
    :host-context([data-theme="dark"]) .manage-link { border-color: #232d42 !important; color: #8393ad !important; background: transparent; }
    :host-context([data-theme="dark"]) .manage-link:hover { border-color: #4ade80 !important; color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .acc-icon--img,
    :host-context([data-theme="dark"]) .card-icon--img { border-color: #232d42 !important; background: #1e2638 !important; }

    /* Bill banners */
    :host-context([data-theme="dark"]) .bill-banner--danger  { background: rgba(220,38,38,.18) !important; color: #f87171 !important; }
    :host-context([data-theme="dark"]) .bill-banner--warning { background: rgba(217,119,6,.18)  !important; color: #fbbf24 !important; }

    /* Calculadora */
    :host-context([data-theme="dark"]) .calc-cell { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .calc-cell__val { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .calc-result { background: rgba(34,197,94,.1) !important; border-color: rgba(34,197,94,.3) !important; }
    :host-context([data-theme="dark"]) .calc-result--neg { background: rgba(248,113,113,.1) !important; border-color: rgba(248,113,113,.3) !important; }
    :host-context([data-theme="dark"]) .calc-result__lbl { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .calc-sign-group { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .calc-sign { background: #1e2638 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .calc-sign:hover { background: #232d42 !important; }
    :host-context([data-theme="dark"]) .calc-input { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .calc-input:focus { border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .calc-clear { background: #1e2638 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .calc-clear:hover { background: rgba(248,113,113,.15) !important; color: #f87171 !important; }
    :host-context([data-theme="dark"]) .calc-sim__preview { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .calc-sim__preview--pos { background: rgba(34,197,94,.1) !important; border-color: rgba(34,197,94,.3) !important; }
    :host-context([data-theme="dark"]) .calc-sim__preview--neg { background: rgba(248,113,113,.1) !important; border-color: rgba(248,113,113,.3) !important; }
    :host-context([data-theme="dark"]) .calc-sim__preview-lbl { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .calc-op { color: #4f5f76 !important; }

    /* Patrimônio cards */
    :host-context([data-theme="dark"]) .pat-wcard { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .pat-wcard--total { background: rgba(34,197,94,.1) !important; border-color: rgba(34,197,94,.3) !important; }

    /* First-visit skeleton overlay */
    :host-context([data-theme="dark"]) .fv-overlay { background: #0d1117 !important; }
    :host-context([data-theme="dark"]) .sk {
      background: linear-gradient(90deg, #1e2638 25%, #283248 50%, #1e2638 75%) !important;
    }
    :host-context([data-theme="dark"]) .skel {
      background: linear-gradient(90deg, #1e2638 25%, #283248 50%, #1e2638 75%) !important;
    }
  `]
})
export class DashboardComponent implements OnInit {
  private api   = inject(ApiService);
  private auth  = inject(AuthService);
  private i18n  = inject(TranslationService);
  private toast = inject(ToastService);

  markingPaid = new Set<string>();
  showAllPayable   = signal(false);
  showAllReceivable = signal(false);

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
          this.accounts.set(raw);
        });
      },
      error: () => {
        this.markingPaid.delete(bill.id);
        this.toast.error('Erro ao marcar como pago');
      }
    });
  }

  readonly C = 2 * Math.PI * 38; // SVG donut circumference ≈ 238.76

  loading      = signal(true);
  exportingAll = signal(false);
  firstVisit   = signal(!sessionStorage.getItem('dash_visited'));
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
  totalPayable     = computed(() => this.payableBills().reduce((s: number, b: any) => s + (b.amount ?? 0), 0));
  totalReceivable  = computed(() => this.receivableBills().reduce((s: number, b: any) => s + (b.amount ?? 0), 0));

  // ── Calculadora dinâmica ──────────────────────────────────────────────────
  simAmount = signal(0);
  simSign   = signal<'+' | '-'>('+');

  projectedCash = computed(() =>
    this.totalBalance() + this.totalReceivable() - this.totalPayable()
  );
  simulatedCash = computed(() =>
    this.projectedCash() + (this.simSign() === '+' ? 1 : -1) * this.simAmount()
  );

  updateSimAmount(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value) || 0;
    this.simAmount.set(Math.max(0, val));
  }

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

  // ── Termômetro Financeiro ──────────────────────────────────────────────
  // Pontua 5 pilares (0-100) a partir dos dados já carregados na tela e
  // deriva as 3 dicas mais relevantes a partir dos pontos perdidos.
  health = computed(() => {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const income  = this.income();
    const expense = this.expense();
    const cardBill = this.totalCardExpense();
    const limits   = this.spendingLimits();
    const overdue  = this.overduePayable();

    // Reserva declarada nas carteiras do Patrimônio (mês mais recente registrado),
    // somada ao saldo em conta para medir a cobertura de emergência.
    const snaps = this.patrimonySnapshots();
    let declaredReserve = 0;
    if (snaps.length) {
      const lastMonth = snaps.reduce((m: string, s: any) => (s.month > m ? s.month : m), '');
      declaredReserve = snaps
        .filter((s: any) => s.month === lastMonth)
        .reduce((sum: number, s: any) => sum + (+s.emergency_reserve || 0), 0);
    }
    const cash = this.totalBalance() + declaredReserve;

    // Gasto médio mensal: usa o histórico de fluxo quando houver, senão o mês atual.
    const flow = this.monthlyFlow().filter(f => (f.expense ?? 0) > 0);
    const avgExpense = flow.length
      ? flow.reduce((s, f) => s + (f.expense ?? 0), 0) / flow.length
      : expense;

    type Status = 'good' | 'warn' | 'bad';
    const pillars: { key: string; name: string; detail: string; status: Status; lost: number }[] = [];
    const tips: { title: string; body: string; severity: 'high' | 'medium' | 'low'; lost: number }[] = [];

    // 1) Sobra do mês (25 pts)
    const leftover = income - expense;
    const savingsRate = income > 0 ? leftover / income : 0;
    let p1 = 0, s1: Status = 'bad', d1 = '';
    if (income <= 0) {
      p1 = 0; s1 = 'warn'; d1 = 'Sem receita no mês';
    } else if (savingsRate >= 0.20) {
      p1 = 25; s1 = 'good'; d1 = `Sobram ${(savingsRate * 100).toFixed(0)}% da receita`;
    } else if (savingsRate >= 0.10) {
      p1 = 18; s1 = 'good'; d1 = `Sobram ${(savingsRate * 100).toFixed(0)}% da receita`;
    } else if (savingsRate > 0) {
      p1 = 11; s1 = 'warn'; d1 = `Sobram só ${(savingsRate * 100).toFixed(0)}% da receita`;
    } else {
      p1 = 0; s1 = 'bad'; d1 = `Gastou ${fmt(Math.abs(leftover))} a mais`;
    }
    pillars.push({ key: 'flow', name: 'Sobra do mês', detail: d1, status: s1, lost: 25 - p1 });
    if (p1 < 25) {
      tips.push({
        severity: p1 === 0 ? 'high' : 'medium',
        lost: 25 - p1,
        title: leftover < 0 ? 'Seu mês fechou no vermelho' : 'Aumente a sobra do mês',
        body: leftover < 0
          ? `Você gastou ${fmt(Math.abs(leftover))} além do que recebeu. Abra Relatórios, veja as 3 maiores categorias do mês e corte a que menos impacta seu dia a dia até o saldo voltar a ficar positivo.`
          : `Hoje sobram ${(savingsRate * 100).toFixed(0)}% da sua receita. Mire em 20% (${fmt(income * 0.20)}/mês): assim que o salário cair, separe esse valor antes de gastar, em vez de guardar o que sobrar no fim do mês.`,
      });
    }

    // 2) Reserva de emergência (25 pts)
    const months = avgExpense > 0 ? cash / avgExpense : (cash > 0 ? 12 : 0);
    let p2 = 0, s2: Status = 'bad';
    if (months >= 6)      { p2 = 25; s2 = 'good'; }
    else if (months >= 3) { p2 = 18; s2 = 'good'; }
    else if (months >= 1) { p2 = 10; s2 = 'warn'; }
    else                  { p2 = 0;  s2 = 'bad'; }
    pillars.push({
      key: 'reserve', name: 'Reserva de emergência',
      detail: declaredReserve > 0
        ? `${months.toFixed(1)} ${months === 1 ? 'mês' : 'meses'} · inclui ${fmt(declaredReserve)} do patrimônio`
        : `${months.toFixed(1)} ${months === 1 ? 'mês' : 'meses'} de gastos`,
      status: s2, lost: 25 - p2,
    });
    if (p2 < 25) {
      const target = avgExpense * 6;
      const missing = Math.max(0, target - cash);
      tips.push({
        severity: months < 1 ? 'high' : months < 3 ? 'medium' : 'low',
        lost: 25 - p2,
        title: months < 1 ? 'Construa sua reserva de emergência' : 'Complete sua reserva até 6 meses',
        body: `Sua reserva cobre ${months.toFixed(1)} ${months === 1 ? 'mês' : 'meses'} de gastos${declaredReserve > 0 ? ` (saldo em conta + ${fmt(declaredReserve)} marcados no Patrimônio)` : ''}. O ideal são 6 meses (${fmt(target)}) — faltam ${fmt(missing)}.${declaredReserve === 0 ? ' Se você já tem uma reserva investida, informe o valor no campo "Reserva de Emergência" em Patrimônio para ela ser considerada aqui.' : ' Mantenha em algo com liquidez diária, separado da conta do dia a dia.'}`,
      });
    }

    // 3) Contas em atraso (20 pts)
    const overdueCount = overdue.length;
    const overdueTotal = overdue.reduce((s: number, b: any) => s + (b.amount ?? 0), 0);
    let p3 = 0, s3: Status = 'bad';
    if (overdueCount === 0)      { p3 = 20; s3 = 'good'; }
    else if (overdueCount === 1) { p3 = 10; s3 = 'warn'; }
    else if (overdueCount === 2) { p3 = 5;  s3 = 'bad'; }
    else                         { p3 = 0;  s3 = 'bad'; }
    pillars.push({
      key: 'overdue', name: 'Contas em atraso',
      detail: overdueCount === 0 ? 'Nenhuma conta atrasada' : `${overdueCount} em atraso (${fmt(overdueTotal)})`,
      status: s3, lost: 20 - p3,
    });
    if (p3 < 20) {
      tips.push({
        severity: 'high',
        lost: 20 - p3,
        title: 'Regularize as contas em atraso',
        body: `Você tem ${overdueCount} ${overdueCount === 1 ? 'conta vencida' : 'contas vencidas'} somando ${fmt(overdueTotal)}. Juros e multa de atraso são os mais caros que existem — priorize essas antes de qualquer investimento e ative lembretes de vencimento.`,
      });
    }

    // 4) Uso do cartão de crédito (15 pts)
    const cardRatio = income > 0 ? cardBill / income : (cardBill > 0 ? 1 : 0);
    let p4 = 0, s4: Status = 'bad';
    if (cardRatio <= 0.20)      { p4 = 15; s4 = 'good'; }
    else if (cardRatio <= 0.30) { p4 = 11; s4 = 'good'; }
    else if (cardRatio <= 0.50) { p4 = 6;  s4 = 'warn'; }
    else                        { p4 = 0;  s4 = 'bad'; }
    pillars.push({
      key: 'card', name: 'Uso do cartão',
      detail: income > 0 ? `${(cardRatio * 100).toFixed(0)}% da receita` : fmt(cardBill),
      status: s4, lost: 15 - p4,
    });
    if (p4 < 15 && cardBill > 0) {
      tips.push({
        severity: cardRatio > 0.5 ? 'high' : 'medium',
        lost: 15 - p4,
        title: 'Reduza o comprometimento com o cartão',
        body: `Sua fatura (${fmt(cardBill)}) representa ${(cardRatio * 100).toFixed(0)}% da sua receita — o saudável é ficar até 30% (${fmt(income * 0.30)}). Evite novos parcelamentos até a fatura cair e prefira débito nas compras do dia a dia.`,
      });
    }

    // 5) Limites de gastos (15 pts)
    const exceeded = limits.filter((l: any) => (l.usage_pct ?? 0) >= 100);
    const near     = limits.filter((l: any) => (l.usage_pct ?? 0) >= 80 && (l.usage_pct ?? 0) < 100);
    let p5 = 0, s5: Status = 'bad', d5 = '';
    if (limits.length === 0) {
      p5 = 8; s5 = 'warn'; d5 = 'Nenhum limite definido';
    } else if (exceeded.length === 0 && near.length === 0) {
      p5 = 15; s5 = 'good'; d5 = `${limits.length} ${limits.length === 1 ? 'limite' : 'limites'} sob controle`;
    } else if (exceeded.length === 0) {
      p5 = 10; s5 = 'warn'; d5 = `${near.length} perto do limite`;
    } else if (exceeded.length === 1) {
      p5 = 5; s5 = 'bad'; d5 = '1 limite estourado';
    } else {
      p5 = 0; s5 = 'bad'; d5 = `${exceeded.length} limites estourados`;
    }
    pillars.push({ key: 'limits', name: 'Limites de gastos', detail: d5, status: s5, lost: 15 - p5 });
    if (p5 < 15) {
      tips.push({
        severity: exceeded.length > 0 ? 'medium' : 'low',
        lost: 15 - p5,
        title: limits.length === 0 ? 'Defina limites por categoria' : 'Ajuste os limites estourados',
        body: limits.length === 0
          ? 'Você ainda não tem limites de gasto configurados. Comece pelas 2 categorias onde mais gasta: definir um teto mensal é o jeito mais simples de perceber o excesso antes do fim do mês.'
          : `${exceeded.length > 0 ? `${exceeded.length} ${exceeded.length === 1 ? 'categoria passou' : 'categorias passaram'} do teto` : `${near.length} ${near.length === 1 ? 'categoria está' : 'categorias estão'} perto do teto`}. Revise em Limite de Gastos: ou o teto está irreal para sua rotina, ou é o gasto que precisa cair.`,
      });
    }

    const score = Math.max(0, Math.min(100, Math.round(p1 + p2 + p3 + p4 + p5)));

    let label = 'Crítico', color = '#dc2626';
    if (score >= 80)      { label = 'Excelente'; color = '#16a34a'; }
    else if (score >= 60) { label = 'Saudável';  color = '#22c55e'; }
    else if (score >= 40) { label = 'Atenção';   color = '#f59e0b'; }
    else if (score >= 20) { label = 'Risco';     color = '#f97316'; }

    // Mantém as 3 dicas de maior impacto; completa com reforços quando estiver tudo bem.
    const ranked = [...tips].sort((a, b) => b.lost - a.lost);
    const filler = [
      {
        title: 'Automatize seus aportes',
        body: 'Com as contas em dia e reserva formada, o próximo passo é fazer o dinheiro trabalhar: programe uma transferência automática no dia do salário para a carteira de investimentos.',
        severity: 'low' as const, lost: 0,
      },
      {
        title: 'Revise assinaturas recorrentes',
        body: 'Serviços pouco usados corroem a sobra do mês em silêncio. Abra Assinaturas Tech e cancele o que não foi usado nos últimos 30 dias.',
        severity: 'low' as const, lost: 0,
      },
      {
        title: 'Defina um objetivo de médio prazo',
        body: 'Metas concretas sustentam a disciplina. Cadastre um objetivo em Objetivos com valor e prazo — acompanhar o progresso é o que mantém o hábito.',
        severity: 'low' as const, lost: 0,
      },
    ];
    const finalTips = [...ranked, ...filler].slice(0, 3);

    return { score, label, color, pillars, tips: finalTips };
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

  ngOnInit(): void {
    // 1) Mostra imediatamente o último estado conhecido (cache local), se houver,
    //    para o usuário não ver a tela em branco enquanto o backend responde.
    const hadCache = this.restoreCache();
    if (hadCache) { this.loading.set(false); this.firstVisit.set(false); }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dateFrom = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const dateTo   = `${y}-${m}-${lastDay}`;

    // 2) ONDA 1 — dados críticos (herói, contas, cartões, faturas do mês).
    //    A tela destrava assim que estes chegam, sem esperar os relatórios pesados.
    forkJoin({
      accounts:   this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] }))),
      cards:      this.api.get<any>('/credit-cards').pipe(catchError(() => of({ data: [] }))),
      payable:    this.api.get<any>(`/transactions?type=expense&paid=false&date_from=${dateFrom}&date_to=${dateTo}&limit=100`).pipe(catchError(() => of({ data: [] }))),
      receivable: this.api.get<any>(`/transactions?type=income&paid=false&date_from=${dateFrom}&date_to=${dateTo}&limit=100`).pipe(catchError(() => of({ data: [] }))),
      summary:    this.api.get<any>(`/reports/flow?month=${y}-${m}`).pipe(catchError(() => of({ data: { income: 0, expense: 0 } }))),
      cats:       this.api.get<any>('/categories').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(res => {
      this.accounts.set(res.accounts.data ?? []);
      const mappedCards = (res.cards.data ?? []).map((c: any) => {
        const rawIcon = c.icon || '';
        const isAsset = rawIcon.endsWith('.svg');
        return { ...c, asset: isAsset ? rawIcon : '', siSlug: isAsset ? '' : rawIcon, current_invoice: 0 };
      });
      this.cards.set(mappedCards);

      // Load current-month invoice total for each card
      const curMonth = `${y}-${m}`;
      if (mappedCards.length) {
        forkJoin<any[]>(
          mappedCards.map((c: any) =>
            this.api.get<any>(`/reports/cards/${c.id}/invoices`).pipe(catchError(() => of({ data: [] })))
          )
        ).subscribe((results: any[]) => {
          this.cards.update(cards => cards.map((c, i) => {
            const inv = (results[i].data ?? []).find((x: any) => x.month === curMonth);
            return { ...c, current_invoice: inv ? Math.abs(inv.expense ?? 0) : 0 };
          }));
          this.saveCache();
        });
      }
      this.payableBills.set((res.payable.data ?? []).slice().sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      this.receivableBills.set((res.receivable.data ?? []).slice().sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      this.income.set(res.summary.data?.income ?? res.summary.income ?? 0);
      this.expense.set(res.summary.data?.expense ?? res.summary.expense ?? 0);
      this._categories.set(res.cats.data ?? []);
      this.loading.set(false);
      sessionStorage.setItem('dash_visited', '1');
      this.firstVisit.set(false);
      this.saveCache();
    });

    // 3) ONDA 2 — relatórios mais pesados, carregados em segundo plano.
    //    Aparecem quando prontos, sem travar o resto da tela.
    forkJoin({
      top:        this.api.get<any>(`/reports/categories?date_from=${dateFrom}&date_to=${dateTo}&type=expense`).pipe(catchError(() => of({ data: [] }))),
      limits:     this.api.get<any>('/spending-limits').pipe(catchError(() => of({ data: [] }))),
      patrimony:  this.api.get<any>('/patrimony-snapshots').pipe(catchError(() => of({ data: [] }))),
      flow:       this.api.get<any>(`/reports/flow?from=${new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0,7)}-01&to=${y}-${m}-${lastDay}`).pipe(catchError(() => of({ data: [] }))),
    }).subscribe(res => {
      this.topCategories.set((res.top.data ?? []).slice(0, 5));
      this.spendingLimits.set(res.limits.data ?? []);
      this.patrimonySnapshots.set(res.patrimony.data ?? []);
      const flow: any[] = res.flow.data ?? [];
      this.monthlyFlow.set(flow.slice(-6));
      this.saveCache();
    });
  }

  // ── Cache local do dashboard ────────────────────────────────────────────────
  private cacheKey(): string {
    const uid = this.auth.currentUser()?.id ?? 'anon';
    return `dash_cache_v1_${uid}`;
  }

  /** Restaura o último snapshot salvo. Retorna true se havia cache. */
  private restoreCache(): boolean {
    try {
      const raw = localStorage.getItem(this.cacheKey());
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.accounts.set(s.accounts ?? []);
      this.cards.set(s.cards ?? []);
      this.payableBills.set(s.payableBills ?? []);
      this.receivableBills.set(s.receivableBills ?? []);
      this.income.set(s.income ?? 0);
      this.expense.set(s.expense ?? 0);
      this.topCategories.set(s.topCategories ?? []);
      this.spendingLimits.set(s.spendingLimits ?? []);
      this._categories.set(s.categories ?? []);
      this.patrimonySnapshots.set(s.patrimonySnapshots ?? []);
      this.monthlyFlow.set(s.monthlyFlow ?? []);
      return true;
    } catch { return false; }
  }

  /** Salva o estado atual para exibição instantânea na próxima abertura. */
  private saveCache(): void {
    try {
      const snap = {
        accounts: this.accounts(),
        cards: this.cards(),
        payableBills: this.payableBills(),
        receivableBills: this.receivableBills(),
        income: this.income(),
        expense: this.expense(),
        topCategories: this.topCategories(),
        spendingLimits: this.spendingLimits(),
        categories: this._categories(),
        patrimonySnapshots: this.patrimonySnapshots(),
        monthlyFlow: this.monthlyFlow(),
      };
      localStorage.setItem(this.cacheKey(), JSON.stringify(snap));
    } catch { /* quota/serialization — ignora */ }
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

  // ── Exportar todos os dados ───────────────────────────────────────────────
  exportAll(): void {
    if (this.exportingAll()) return;
    this.exportingAll.set(true);

    const dateStr  = new Date().toLocaleDateString('pt-BR');
    const yearStr  = new Date().getFullYear().toString();
    const filename = `dsfr-finance-completo-${yearStr}.xls`;

    forkJoin({
      txAll:  this.api.get<any>('/transactions?limit=1000').pipe(catchError(() => of({ data: [] }))),
      debts:  this.api.get<any>('/debts').pipe(catchError(() => of({ data: [] }))),
      subs:   this.api.get<any>('/ai-subscriptions').pipe(catchError(() => of({ data: [] }))),
    }).subscribe({
      next: res => {
        const txs   = (res.txAll.data  ?? []) as any[];
        const debts = (res.debts.data  ?? []) as any[];
        const subs  = (res.subs.data   ?? []) as any[];
        const pats  = this.patrimonySnapshots() as any[];

        // ── helpers ──────────────────────────────────────────────────────────
        const esc = (v: any) =>
          String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const S = (v: any, style?: string) =>
          `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
        const N = (v: number, style = 'money') =>
          `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${v}</Data></Cell>`;
        const CH = (cols: string[]) => cols.map(h => S(h,'ch')).join('');
        const EMPTY = (n: number) => '<Cell/>'.repeat(n);

        // ── indicadores ───────────────────────────────────────────────────────
        const totalAcc  = this.totalBalance();
        const mIncome   = this.income();
        const mExpense  = this.expense();
        const mBalance  = mIncome - mExpense;
        const totalDebt = debts.reduce((s: number, d: any) => s + Math.abs(d.remaining_balance ?? 0), 0);
        const totalSubs = subs.reduce((s: number, sub: any) => {
          const m = sub.billing_cycle === 'annual' ? (sub.monthly_cost ?? 0) / 12 : (sub.monthly_cost ?? 0);
          return s + m;
        }, 0);

        // ── SHEET 1 – Resumo ─────────────────────────────────────────────────
        const sheetResumo = `<Worksheet ss:Name="Resumo">
  <Table>
   <Column ss:Width="220"/><Column ss:Width="160"/>
   <Row ss:Height="22"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">DSFR Finance — Visão Geral</Data></Cell></Row>
   <Row><Cell ss:StyleID="sub"><Data ss:Type="String">Exportado em: ${esc(dateStr)}</Data></Cell></Row>
   <Row/>
   <Row>${CH(['Indicador','Valor'])}</Row>
   <Row>${S('Saldo em Contas','sum')}${N(totalAcc, totalAcc >= 0 ? 'sumPos':'sumNeg')}</Row>
   <Row>${S('Receitas do Mês Atual','sum')}${N(mIncome,'sumPos')}</Row>
   <Row>${S('Despesas do Mês Atual','sum')}${N(mExpense,'sumNeg')}</Row>
   <Row>${S('Saldo do Mês','sum')}${N(mBalance, mBalance >= 0 ? 'sumPos':'sumNeg')}</Row>
   <Row>${S('Total em Dívidas','sum')}${N(totalDebt,'sumNeg')}</Row>
   <Row>${S('Custo Mensal Assinaturas','sum')}${N(totalSubs,'sumNeg')}</Row>
   <Row/>
   <Row>${CH(['Contagem','Qtd'])}</Row>
   <Row>${S('Lançamentos exportados')}${S(String(txs.length))}</Row>
   <Row>${S('Dívidas cadastradas')}${S(String(debts.length))}</Row>
   <Row>${S('Assinaturas ativas')}${S(String(subs.filter((s:any) => s.status==='active').length))}</Row>
   <Row>${S('Snapshots de patrimônio')}${S(String(pats.length))}</Row>
  </Table>
 </Worksheet>`;

        // ── SHEET 2 – Lançamentos ─────────────────────────────────────────────
        const txLabel = (t: string) =>
          t === 'expense' ? 'Despesa' : t === 'income' ? 'Receita' : 'Transferência';
        const txRows = txs.map((tx: any) => {
          const sign = tx.type === 'expense' ? -1 : 1;
          return `<Row>
   ${S(tx.date?.slice(0,10) ?? '')}
   ${S(tx.description)}
   ${S(tx.category?.name ?? '')}
   ${S(txLabel(tx.type))}
   ${N(sign * (tx.amount ?? 0), tx.type==='income' ? 'pos' : tx.type==='expense' ? 'neg' : 'money')}
   ${S(tx.paid ? 'Pago' : 'Pendente')}
   ${S((tx.tags ?? []).map((t:any) => t.name).join(', '))}
  </Row>`;
        }).join('');
        const sheetTx = `<Worksheet ss:Name="Lançamentos">
  <Table>
   <Column ss:Width="90"/><Column ss:Width="200"/><Column ss:Width="140"/>
   <Column ss:Width="100"/><Column ss:Width="120"/><Column ss:Width="80"/><Column ss:Width="160"/>
   <Row ss:Height="22"><Cell ss:StyleID="title" ss:MergeAcross="6"><Data ss:Type="String">DSFR Finance — Lançamentos</Data></Cell></Row>
   <Row><Cell ss:StyleID="sub"><Data ss:Type="String">Total: ${txs.length} lançamentos · Exportado em: ${esc(dateStr)}</Data></Cell></Row>
   <Row/>
   <Row>${CH(['Data','Descrição','Categoria','Tipo','Valor (R$)','Status','Tags'])}</Row>
   ${txRows || `<Row>${S('Nenhum lançamento')}</Row>`}
  </Table>
 </Worksheet>`;

        // ── SHEET 3 – Dívidas ─────────────────────────────────────────────────
        const debtRows = debts.map((d: any) => `<Row>
   ${S(d.name)}
   ${S(d.type ?? '')}
   ${N(Math.abs(d.remaining_balance ?? 0),'neg')}
   ${N(Math.abs(d.original_balance  ?? 0),'money')}
   ${N(d.interest_rate ?? 0,'pct')}
   ${N(d.monthly_payment ?? 0,'money')}
   ${S(d.remaining_installments ?? '')}
   ${S(d.amortization_type ?? '')}
  </Row>`).join('');
        const sheetDebts = `<Worksheet ss:Name="Dívidas">
  <Table>
   <Column ss:Width="160"/><Column ss:Width="120"/><Column ss:Width="130"/>
   <Column ss:Width="130"/><Column ss:Width="100"/><Column ss:Width="130"/>
   <Column ss:Width="130"/><Column ss:Width="120"/>
   <Row ss:Height="22"><Cell ss:StyleID="title" ss:MergeAcross="7"><Data ss:Type="String">DSFR Finance — Dívidas</Data></Cell></Row>
   <Row><Cell ss:StyleID="sub"><Data ss:Type="String">Exportado em: ${esc(dateStr)}</Data></Cell></Row>
   <Row/>
   <Row>${CH(['Nome','Tipo','Saldo Devedor','Valor Original','Taxa (% a.m.)','Parcela Mensal','Parcelas Rest.','Amortização'])}</Row>
   ${debtRows || `<Row>${S('Nenhuma dívida cadastrada')}</Row>`}
   <Row/>
   <Row>${S('Total em Dívidas','sum')}${EMPTY(1)}<Cell ss:StyleID="sumNeg"><Data ss:Type="Number">${totalDebt}</Data></Cell></Row>
  </Table>
 </Worksheet>`;

        // ── SHEET 4 – Patrimônio ──────────────────────────────────────────────
        const patRows = pats
          .slice().sort((a:any,b:any) => a.month.localeCompare(b.month))
          .map((p: any) => `<Row>
   ${S(p.month)}
   ${S(p.wallet_name ?? 'Geral')}
   ${N(p.total ?? 0,'pos')}
  </Row>`).join('');
        const sheetPat = `<Worksheet ss:Name="Patrimônio">
  <Table>
   <Column ss:Width="100"/><Column ss:Width="180"/><Column ss:Width="150"/>
   <Row ss:Height="22"><Cell ss:StyleID="title" ss:MergeAcross="2"><Data ss:Type="String">DSFR Finance — Evolução do Patrimônio</Data></Cell></Row>
   <Row><Cell ss:StyleID="sub"><Data ss:Type="String">Exportado em: ${esc(dateStr)}</Data></Cell></Row>
   <Row/>
   <Row>${CH(['Mês','Carteira','Total (R$)'])}</Row>
   ${patRows || `<Row>${S('Sem dados de patrimônio')}</Row>`}
  </Table>
 </Worksheet>`;

        // ── SHEET 5 – Assinaturas ─────────────────────────────────────────────
        const catName = (c: string) => ({
          streaming:'Streaming', music:'Música', storage:'Armazenamento',
          ai:'IA / ChatGPT', productivity:'Produtividade', games:'Games',
          ecommerce:'E-commerce', other:'Outros'
        } as any)[c] ?? c;
        const subRows = subs.map((s: any) => {
          const monthly = s.billing_cycle === 'annual'
            ? (s.monthly_cost ?? 0) / 12
            : (s.monthly_cost ?? 0);
          return `<Row>
   ${S(s.name)}
   ${S(s.plan_name ?? '')}
   ${S(catName(s.category ?? 'other'))}
   ${S(s.billing_cycle === 'annual' ? 'Anual' : 'Mensal')}
   ${N(monthly,'money')}
   ${N(s.monthly_cost ?? 0,'money')}
   ${S(s.billing_day ?? '')}
   ${S(s.status === 'active' ? 'Ativa' : 'Cancelada')}
  </Row>`;
        }).join('');
        const sheetSubs = `<Worksheet ss:Name="Assinaturas Tech">
  <Table>
   <Column ss:Width="160"/><Column ss:Width="130"/><Column ss:Width="130"/>
   <Column ss:Width="80"/><Column ss:Width="130"/><Column ss:Width="130"/>
   <Column ss:Width="100"/><Column ss:Width="80"/>
   <Row ss:Height="22"><Cell ss:StyleID="title" ss:MergeAcross="7"><Data ss:Type="String">DSFR Finance — Assinaturas Tech</Data></Cell></Row>
   <Row><Cell ss:StyleID="sub"><Data ss:Type="String">Exportado em: ${esc(dateStr)}</Data></Cell></Row>
   <Row/>
   <Row>${CH(['Nome','Plano','Categoria','Ciclo','Custo/Mês (R$)','Custo Total','Dia Cobrança','Status'])}</Row>
   ${subRows || `<Row>${S('Nenhuma assinatura cadastrada')}</Row>`}
   <Row/>
   <Row>${S('Total mensal','sum')}${EMPTY(3)}<Cell ss:StyleID="sumNeg"><Data ss:Type="Number">${totalSubs}</Data></Cell></Row>
  </Table>
 </Worksheet>`;

        // ── Estilos compartilhados ────────────────────────────────────────────
        const styles = `<Styles>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="14" ss:Color="#2e7736"/></Style>
  <Style ss:ID="sub"><Font ss:Size="10" ss:Color="#6b7280" ss:Italic="1"/></Style>
  <Style ss:ID="ch"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2e7736" ss:Pattern="Solid"/></Style>
  <Style ss:ID="money"><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="pct"><NumberFormat ss:Format='0.00"%"'/></Style>
  <Style ss:ID="pos"><Font ss:Color="#16a34a"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="neg"><Font ss:Color="#dc2626"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="sum"><Font ss:Bold="1"/><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style>
  <Style ss:ID="sumPos"><Font ss:Bold="1" ss:Color="#16a34a"/><Interior ss:Color="#f0fdf4" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="sumNeg"><Font ss:Bold="1" ss:Color="#dc2626"/><Interior ss:Color="#fef2f2" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>`;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${styles}
 ${sheetResumo}
 ${sheetTx}
 ${sheetDebts}
 ${sheetPat}
 ${sheetSubs}
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.toast.success(`"${filename}" exportado com sucesso!`);
        this.exportingAll.set(false);
      },
      error: () => {
        this.toast.error('Erro ao exportar dados. Tente novamente.');
        this.exportingAll.set(false);
      }
    });
  }
}
