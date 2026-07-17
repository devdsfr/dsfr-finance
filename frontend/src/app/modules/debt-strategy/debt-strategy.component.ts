import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PlanService } from '../../core/services/plan.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

interface Debt {
  id: string; name: string; type: string; system: string;
  original_amount: number; remaining_balance: number;
  monthly_rate: number; monthly_payment: number; remaining_months: number; notes: string;
}

interface AmorRow { month: number; payment: number; interest: number; amort: number; balance: number; }

const TYPES: Record<string, string> = {
  mortgage:      '🏠 Financiamento Imobiliário',
  car:           '🚗 Financiamento Veículo',
  consorcio:     '🤝 Consórcio',
  consignado:    '💼 Consignado',
  personal_loan: '💳 Empréstimo Pessoal',
  other:         '📄 Outro',
};

// ── Math helpers ──────────────────────────────────────────────────────────────
function calcMonths(balance: number, r: number, pmt: number): number {
  if (r === 0) return Math.ceil(balance / pmt);
  if (pmt <= balance * r + 0.01) return 9999;
  return Math.ceil(-Math.log(1 - (balance * r) / pmt) / Math.log(1 + r));
}
function calcInterestTotal(balance: number, r: number, pmt: number): number {
  const n = calcMonths(balance, r, pmt);
  if (n >= 9999) return Infinity;
  return n * pmt - balance;
}
function fv(pmt: number, r: number, n: number): number {
  if (r === 0) return pmt * n;
  return pmt * ((Math.pow(1 + r, n) - 1) / r);
}
function amortTable(balance: number, r: number, pmt: number, rows = 12): AmorRow[] {
  const result: AmorRow[] = [];
  let b = balance;
  for (let i = 1; i <= rows && b > 0.01; i++) {
    const interest = b * r;
    const amort = Math.min(pmt - interest, b);
    b = Math.max(0, b - amort);
    result.push({ month: i, payment: pmt, interest, amort, balance: b });
  }
  return result;
}
function months2text(n: number): string {
  if (n >= 9999) return '∞';
  const y = Math.floor(n / 12), m = n % 12;
  return y > 0 ? (m > 0 ? `${y}a ${m}m` : `${y} anos`) : `${m} meses`;
}

@Component({
  selector: 'app-debt-strategy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MoneyMaskDirective, ConfirmModalComponent],
  template: `
    @if (!plan.isPremium()) {
      <div class="upsell-card">
        <div class="upsell-icon">🔒</div>
        <h2>Recurso Premium</h2>
        <p>Simule estratégias de quitação de dívidas (bola de neve, avalanche, amortização) e descubra quanto você
           economiza pagando parcelas maiores ou investindo a diferença.</p>
        <a routerLink="/plan" class="btn btn--primary">Ver planos</a>
      </div>
    } @else {
    <div class="ds-page">

      <!-- ── Sidebar ──────────────────────────────────────────────────── -->
      <aside class="sidebar">
        <div class="sidebar__head">
          <h2>Minhas Dívidas</h2>
          <button class="btn btn--primary btn--sm" (click)="openForm()">+ Nova</button>
        </div>

        @if (loading()) {
          @for (i of [1,2,3]; track i) {
            <div class="debt-card">
              <div class="skel-block skel-p" style="width:60px;margin-bottom:.4rem"></div>
              <div class="skel-block skel-h3" style="width:120px;margin-bottom:.4rem"></div>
              <div class="skel-block skel-p" style="width:100px;margin-bottom:.5rem"></div>
              <div class="skel-block" style="height:4px;width:100%;border-radius:2px"></div>
            </div>
          }
        }
        @for (d of debts(); track d.id) {
          <div class="debt-card" [class.debt-card--active]="selected()?.id === d.id"
               (click)="select(d)">
            <div class="debt-card__type">{{ typeLabel(d.type) }}</div>
            <div class="debt-card__name">{{ d.name }}</div>
            <div class="debt-card__balance">
              {{ d.remaining_balance | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
              <span class="debt-card__rate">{{ (d.monthly_rate * 100) | number:'1.2-2' }}% a.m.</span>
            </div>
            <div class="debt-card__bar">
              <div class="debt-card__bar-fill"
                   [style.width.%]="debtProgress(d)"
                   [class.high]="d.monthly_rate > 0.015"
                   [class.mid]="d.monthly_rate > 0.005 && d.monthly_rate <= 0.015"
                   [class.low]="d.monthly_rate <= 0.005">
              </div>
            </div>
          </div>
        }

        @if (!loading() && debts().length === 0) {
          <div class="empty-sidebar">
            <p>Nenhuma dívida cadastrada.</p>
            <p>Cadastre financiamentos, consórcios, empréstimos e simule estratégias para quitá-los.</p>
          </div>
        }
      </aside>

      <!-- ── Main ─────────────────────────────────────────────────────── -->
      <main class="ds-main">

        @if (!selected()) {
          <div class="welcome">
            <div class="welcome__icon">📊</div>
            <h2>Estratégia de Quitação de Dívidas</h2>
            <p>Cadastre suas dívidas longas (financiamento, consórcio, consignado) e simule quanto você economiza pagando parcelas maiores — ou se é melhor investir a diferença.</p>
            <button class="btn btn--primary" (click)="openForm()">Cadastrar primeira dívida</button>
          </div>
        }

        @if (selected(); as d) {
          <div class="detail">

            <!-- Header -->
            <div class="detail__head">
              <div>
                <span class="type-badge">{{ typeLabel(d.type) }}</span>
                <h1>{{ d.name }}</h1>
              </div>
              <div class="detail__actions">
                <button class="btn btn--outline btn--sm" (click)="openForm(d)">Editar</button>
                <button class="btn btn--danger btn--sm" (click)="remove(d)">Excluir</button>
              </div>
            </div>

            <!-- Summary cards -->
            <div class="summary-row">
              <div class="scard">
                <span class="scard__l">Saldo Atual</span>
                <span class="scard__v">{{ d.remaining_balance | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
              </div>
              <div class="scard">
                <span class="scard__l">Taxa Mensal</span>
                <span class="scard__v {{ rateClass(d) }}">{{ (d.monthly_rate * 100) | number:'1.2-2' }}% a.m.</span>
                <span class="scard__sub">{{ (annualRate(d) * 100) | number:'1.2-2' }}% a.a.</span>
              </div>
              <div class="scard">
                <span class="scard__l">Parcela Atual</span>
                <span class="scard__v">{{ d.monthly_payment | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
              </div>
              <div class="scard">
                <span class="scard__l">Término Atual</span>
                <span class="scard__v">{{ months2text(currentMonths()) }}</span>
              </div>
              <div class="scard">
                <span class="scard__l">Total de Juros</span>
                <span class="scard__v scard__v--red">{{ currentInterest() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
              </div>
            </div>

            <!-- Simulator -->
            <div class="panel sim-panel">
              <h3>🔢 Simulador de Amortização Acelerada</h3>
              <div class="sim-controls">
                <div class="sim-field">
                  <label>Parcela simulada</label>
                  <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="simPayment" name="simPayment" class="input" />
                </div>
                <div class="sim-field">
                  <label>Benchmark de investimento (% a.m.)</label>
                  <input type="number" [(ngModel)]="benchmarkRate" step="0.01" class="input input--sm" />
                  <span class="hint">Selic ≈ 0.84% a.m.</span>
                </div>
              </div>

              @if (simPayment > d.monthly_payment) {
                <div class="sim-results">
                  <div class="sim-item sim-item--good">
                    <span class="sim-label">Novo prazo</span>
                    <span class="sim-val">{{ months2text(simMonths()) }}</span>
                    <span class="sim-delta">−{{ months2text(currentMonths() - simMonths()) }} a menos</span>
                  </div>
                  <div class="sim-item sim-item--good">
                    <span class="sim-label">Juros economizados</span>
                    <span class="sim-val">{{ interestSaved() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                  </div>
                  <div class="sim-item" [class.sim-item--good]="!investBetter()" [class.sim-item--neutral]="investBetter()">
                    <span class="sim-label">Se investir a diferença*</span>
                    <span class="sim-val">{{ investGain() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                    <span class="sim-delta">Rendimento em {{ months2text(simMonths()) }}</span>
                  </div>
                </div>
              } @else {
                <p class="sim-hint">Aumente a parcela acima do valor atual para ver o impacto.</p>
              }
            </div>

            <!-- Strategy -->
            <div class="panel strategy-panel">
              <h3>🤖 Estratégia Recomendada</h3>
              @for (tip of strategy(); track tip.title) {
                <div class="tip" [class.tip--pay]="tip.action==='pay'"
                     [class.tip--invest]="tip.action==='invest'"
                     [class.tip--neutral]="tip.action==='neutral'">
                  <span class="tip__icon">{{ tip.icon }}</span>
                  <div>
                    <strong>{{ tip.title }}</strong>
                    <p>{{ tip.body }}</p>
                  </div>
                </div>
              }
            </div>

            <!-- Amortization table -->
            <div class="panel">
              <h3>📅 Próximas Parcelas — Comparativo</h3>
              <table class="atable">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Parcela atual</th>
                    <th>Juros</th>
                    <th>Amort.</th>
                    <th>Saldo atual</th>
                    @if (simPayment > d.monthly_payment) {
                      <th class="sim-col">Saldo simulado</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of amortRows(); track row.month) {
                    <tr>
                      <td>{{ row.month }}</td>
                      <td>{{ row.payment | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</td>
                      <td class="red">{{ row.interest | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</td>
                      <td class="green">{{ row.amort | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</td>
                      <td>{{ row.balance | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</td>
                      @if (simPayment > d.monthly_payment) {
                        <td class="sim-col green">
                          {{ simAmortRows()[row.month - 1]?.balance | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
              @if (simPayment > d.monthly_payment) {
                <small>* Rendimento calculado reinvestindo {{ simPayment - d.monthly_payment | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}/mês ao benchmark configurado</small>
              }
            </div>

          </div>
        }
      </main>
    </div>

    <!-- ── Modal form ────────────────────────────────────────────────── -->
    @if (showForm()) {
      <div class="overlay" (click)="closeForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingDebt() ? 'Editar Dívida' : 'Nova Dívida' }}</h2>
          <form (ngSubmit)="save()" class="mform">
            <div class="mform-row">
              <div class="fg">
                <label>Nome *</label>
                <input [(ngModel)]="form.name" name="name" required class="input"
                       placeholder="Ex: Financiamento Caixa" />
              </div>
              <div class="fg fg--sm">
                <label>Tipo *</label>
                <select [(ngModel)]="form.type" name="type" class="input">
                  @for (t of typeOptions; track t.value) {
                    <option [value]="t.value">{{ t.label }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="mform-row">
              <div class="fg">
                <label>Saldo devedor atual *</label>
                <input [(ngModel)]="form.remaining_balance" name="remaining_balance"
                       type="text" inputmode="decimal" appMoneyMask required class="input" (ngModelChange)="recalcMonths()" />
              </div>
              <div class="fg">
                <label>Valor original</label>
                <input [(ngModel)]="form.original_amount" name="original_amount"
                       type="text" inputmode="decimal" appMoneyMask class="input" placeholder="Opcional" />
              </div>
            </div>
            <div class="mform-row">
              <div class="fg">
                <label>Taxa de juros (% a.m.) *</label>
                <input [(ngModel)]="form.monthly_rate_pct" name="rate"
                       type="number" step="0.01" required class="input"
                       (ngModelChange)="recalcMonths()" placeholder="Ex: 1.99" />
              </div>
              <div class="fg">
                <label>Parcela mensal atual *</label>
                <input [(ngModel)]="form.monthly_payment" name="payment"
                       type="text" inputmode="decimal" appMoneyMask required class="input" (ngModelChange)="recalcMonths()" />
              </div>
            </div>
            <div class="mform-row">
              <div class="fg">
                <label>Parcelas restantes</label>
                <input [(ngModel)]="form.remaining_months" name="months"
                       type="number" class="input" />
                <small>{{ calcMonthsHint() }}</small>
              </div>
              <div class="fg">
                <label>Sistema de amortização</label>
                <select [(ngModel)]="form.system" name="system" class="input">
                  <option value="price">Price (parcela fixa)</option>
                  <option value="sac">SAC (amortização constante)</option>
                </select>
              </div>
            </div>
            <div class="fg">
              <label>Observações</label>
              <textarea [(ngModel)]="form.notes" name="notes" class="input input--ta"
                        placeholder="Banco, condições especiais, etc."></textarea>
            </div>
            <div class="mform-actions">
              <button type="button" class="btn btn--ghost" (click)="closeForm()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="saving()">
                {{ saving() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
    }

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      (confirmed)="doDelete()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
  `,
  styles: [`
    .upsell-card {
      background: #fff; border-radius: .75rem; padding: 3rem 2rem; text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); max-width: 480px; margin: 2rem auto;
    }
    .upsell-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .upsell-card h2 { margin: 0 0 .5rem; font-size: 1.2rem; color: #111; }
    .upsell-card p { color: #6b7280; font-size: .9rem; line-height: 1.5; margin-bottom: 1.5rem; }
    .upsell-card .btn--primary { display: inline-block; text-decoration: none; padding: .55rem 1.2rem; border-radius: .375rem; background: #2e7736; color: #fff; font-weight: 600; font-size: .85rem; }
    .ds-page { display: grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 52px); gap: 0; margin: -1.5rem -2rem; }

    /* Sidebar */
    .sidebar { background: #fff; border-right: 1px solid #e5e7eb; padding: 1.25rem; overflow-y: auto; }
    .sidebar__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .sidebar__head h2 { font-size: 1rem; font-weight: 700; margin: 0; }
    .debt-card { padding: .75rem; border-radius: .375rem; border: 1px solid #e5e7eb; margin-bottom: .5rem; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
    .debt-card:hover { border-color: #2e7736; }
    .debt-card--active { border-color: #2e7736; box-shadow: 0 0 0 2px rgba(46,119,54,.15); background: #f0fdf4; }
    .debt-card__type { font-size: .68rem; color: #9ca3af; margin-bottom: .15rem; }
    .debt-card__name { font-size: .875rem; font-weight: 600; color: #111; }
    .debt-card__balance { display: flex; justify-content: space-between; font-size: .82rem; margin-top: .25rem; }
    .debt-card__rate { color: #6b7280; font-size: .72rem; }
    .debt-card__bar { height: 3px; background: #f3f4f6; border-radius: 9999px; margin-top: .35rem; }
    .debt-card__bar-fill { height: 100%; border-radius: 9999px; transition: width .3s; }
    .debt-card__bar-fill.high { background: #ef4444; }
    .debt-card__bar-fill.mid  { background: #f59e0b; }
    .debt-card__bar-fill.low  { background: #22c55e; }
    .empty-sidebar { color: #9ca3af; font-size: .82rem; text-align: center; padding: 2rem .5rem; }
    .empty-sidebar p { margin: .25rem 0; }

    /* Main */
    .ds-main { background: #f4f6f8; padding: 1.5rem; overflow-y: auto; }
    .welcome { text-align: center; max-width: 540px; margin: 4rem auto; }
    .welcome__icon { font-size: 3rem; margin-bottom: 1rem; }
    .welcome h2 { font-size: 1.375rem; margin-bottom: .75rem; }
    .welcome p { color: #6b7280; margin-bottom: 1.5rem; }

    /* Detail */
    .detail__head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem; }
    .detail__head h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: .25rem 0 0; }
    .detail__actions { display: flex; gap: .5rem; }
    .type-badge { font-size: .72rem; background: #dcfce7; color: #166534; padding: .2rem .6rem; border-radius: 9999px; }

    /* Summary row */
    .summary-row { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .scard { background: #fff; border-radius: .5rem; padding: .875rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); min-width: 130px; display: flex; flex-direction: column; gap: .1rem; flex: 1; }
    .scard__l { font-size: .7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; }
    .scard__v { font-size: 1.05rem; font-weight: 700; color: #111; }
    .scard__v--red { color: #dc2626; }
    .scard__sub { font-size: .7rem; color: #6b7280; }
    .rate-high { color: #dc2626 !important; }
    .rate-mid  { color: #f59e0b !important; }
    .rate-low  { color: #16a34a !important; }

    /* Panels */
    .panel { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
    .panel h3 { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; color: #111; }

    /* Simulator */
    .sim-controls { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; align-items: flex-end; }
    .sim-field { display: flex; flex-direction: column; gap: .25rem; }
    .sim-field label { font-size: .8rem; font-weight: 500; color: #374151; }
    .hint { font-size: .7rem; color: #9ca3af; margin-top: .1rem; }
    .sim-results { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .sim-item { padding: .875rem; border-radius: .375rem; background: #f9fafb; display: flex; flex-direction: column; gap: .1rem; }
    .sim-item--good { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .sim-item--neutral { background: #fffbeb; border: 1px solid #fde68a; }
    .sim-label { font-size: .7rem; color: #6b7280; text-transform: uppercase; }
    .sim-val { font-size: 1.1rem; font-weight: 700; color: #111; }
    .sim-delta { font-size: .72rem; color: #16a34a; }
    .sim-hint { color: #9ca3af; font-size: .875rem; margin: 0; }

    /* Strategy tips */
    .tip { display: flex; gap: .875rem; padding: .875rem; border-radius: .375rem; margin-bottom: .5rem; }
    .tip--pay     { background: #f0fdf4; border-left: 4px solid #22c55e; }
    .tip--invest  { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .tip--neutral { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .tip__icon { font-size: 1.5rem; flex-shrink: 0; }
    .tip strong { display: block; font-size: .9rem; margin-bottom: .2rem; color: #111; }
    .tip p { margin: 0; font-size: .8rem; color: #4b5563; line-height: 1.5; }

    /* Amortization table */
    .atable { width: 100%; border-collapse: collapse; font-size: .8rem; }
    .atable th { background: #f9fafb; padding: .5rem .75rem; text-align: right; color: #6b7280; font-size: .72rem; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
    .atable th:first-child { text-align: left; }
    .atable td { padding: .45rem .75rem; border-top: 1px solid #f3f4f6; text-align: right; }
    .atable td:first-child { text-align: left; color: #6b7280; }
    .red { color: #dc2626; }
    .green { color: #16a34a; }
    .sim-col { background: #f0fdf4; }
    small { display: block; margin-top: .75rem; color: #9ca3af; font-size: .72rem; }

    /* Buttons */
    .btn { padding: .4rem .875rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; transition: opacity .15s; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--outline { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .btn--danger  { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .btn--ghost   { background: none; color: #6b7280; }
    .btn--sm { padding: .25rem .65rem; font-size: .78rem; }

    /* Modal */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal { background: #fff; border-radius: .5rem; padding: 1.5rem; width: 90%; max-width: 640px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal h2 { margin: 0 0 1.25rem; font-size: 1.125rem; }
    .mform { display: flex; flex-direction: column; gap: .875rem; }
    .mform-row { display: flex; gap: .875rem; flex-wrap: wrap; }
    .fg { display: flex; flex-direction: column; gap: .25rem; flex: 1; min-width: 160px; }
    .fg--sm { max-width: 200px; }
    .fg label { font-size: .8rem; font-weight: 500; color: #374151; }
    .fg small { font-size: .7rem; color: #6366f1; min-height: 1rem; }
    .input { padding: .45rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; width: 100%; box-sizing: border-box; }
    .input--sm { max-width: 130px; }
    .input--ta { resize: vertical; min-height: 64px; }
    .mform-actions { display: flex; justify-content: flex-end; gap: .75rem; padding-top: .5rem; border-top: 1px solid #f3f4f6; }

    @media (max-width: 768px) {
      .ds-page { grid-template-columns: 1fr; }
      .sidebar { border-right: none; border-bottom: 1px solid #e5e7eb; max-height: 220px; }
      .sim-results { grid-template-columns: 1fr; }
      .summary-row { flex-direction: column; }
    }
    /* ══ DARK THEME ════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .sidebar { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .ds-main { background: #0d1117 !important; }
    :host-context([data-theme="dark"]) .upsell-card,
    :host-context([data-theme="dark"]) .scard,
    :host-context([data-theme="dark"]) .panel { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .upsell-card h2,
    :host-context([data-theme="dark"]) .panel h3,
    :host-context([data-theme="dark"]) .scard__v,
    :host-context([data-theme="dark"]) .detail__head h1 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .scard__l { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .debt-card { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .debt-card.active,
    :host-context([data-theme="dark"]) .debt-card:hover { border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .debt-card__name { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .debt-card__bar { background: #232d42 !important; }
    :host-context([data-theme="dark"]) .sim-item { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .sim-item--neutral { background: rgba(245,158,11,.1) !important; border-color: rgba(245,158,11,.3) !important; }
    :host-context([data-theme="dark"]) .sim-val { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .tip { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .tip--neutral { background: rgba(245,158,11,.08) !important; border-left-color: #f59e0b !important; }
    :host-context([data-theme="dark"]) .tip strong { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .atable th { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .atable td { border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .btn--outline { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .modal { background: #161c28 !important; }
    :host-context([data-theme="dark"]) input,
    :host-context([data-theme="dark"]) select { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }

  `]
})
export class DebtStrategyComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  plan = inject(PlanService);

  loading     = signal(true);
  debts       = signal<Debt[]>([]);
  selected    = signal<Debt | null>(null);
  showForm    = signal(false);
  saving      = signal(false);
  editingDebt = signal<Debt | null>(null);

  simPayment    = 0;
  benchmarkRate = 0.84; // Selic mensal padrão %

  form: any = this.emptyForm();

  typeOptions = [
    { value: 'mortgage',      label: '🏠 Financiamento Imobiliário' },
    { value: 'car',           label: '🚗 Financiamento Veículo' },
    { value: 'consorcio',     label: '🤝 Consórcio' },
    { value: 'consignado',    label: '💼 Consignado' },
    { value: 'personal_loan', label: '💳 Empréstimo Pessoal' },
    { value: 'other',         label: '📄 Outro' },
  ];

  // ── Computed ────────────────────────────────────────────────────────
  currentMonths = computed(() => {
    const d = this.selected(); if (!d) return 0;
    return calcMonths(d.remaining_balance, d.monthly_rate, d.monthly_payment);
  });
  currentInterest = computed(() => {
    const d = this.selected(); if (!d) return 0;
    return calcInterestTotal(d.remaining_balance, d.monthly_rate, d.monthly_payment);
  });
  simMonths = computed(() => {
    const d = this.selected(); if (!d) return 0;
    return calcMonths(d.remaining_balance, d.monthly_rate, this.simPayment || d.monthly_payment);
  });
  interestSaved = computed(() => {
    const d = this.selected(); if (!d) return 0;
    return Math.max(0, this.currentInterest() -
      calcInterestTotal(d.remaining_balance, d.monthly_rate, this.simPayment || d.monthly_payment));
  });
  investGain = computed(() => {
    const d = this.selected(); if (!d) return 0;
    const extra = (this.simPayment || d.monthly_payment) - d.monthly_payment;
    if (extra <= 0) return 0;
    return fv(extra, this.benchmarkRate / 100, this.simMonths());
  });
  investBetter = computed(() => this.investGain() > this.interestSaved());

  amortRows = computed(() => {
    const d = this.selected(); if (!d) return [];
    return amortTable(d.remaining_balance, d.monthly_rate, d.monthly_payment, 12);
  });
  simAmortRows = computed(() => {
    const d = this.selected(); if (!d || !this.simPayment || this.simPayment <= d.monthly_payment) return [];
    return amortTable(d.remaining_balance, d.monthly_rate, this.simPayment, 12);
  });

  strategy = computed(() => {
    const d = this.selected(); if (!d) return [];
    const r = d.monthly_rate;
    const bench = this.benchmarkRate / 100;
    const tips: { icon: string; title: string; body: string; action: 'pay' | 'invest' | 'neutral' }[] = [];
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (r > 0.02) {
      tips.push({ icon: '🚨', action: 'pay',
        title: 'Taxa muito alta — prioridade máxima',
        body: `Sua taxa de ${(r*100).toFixed(2)}% a.m. (≈${(this.annualRate(d)*100).toFixed(1)}% a.a.) supera qualquer investimento conservador. Quite essa dívida o mais rápido possível antes de investir qualquer valor.` });
    } else if (r > 0.015) {
      tips.push({ icon: '⚠️', action: 'pay',
        title: 'Taxa alta — amortize com prioridade',
        body: `${(r*100).toFixed(2)}% a.m. está acima do CDI. Cada real extra na parcela rende mais do que em renda fixa. Considere aportes mensais para reduzir o saldo devedor.` });
    } else if (r > bench) {
      tips.push({ icon: '📈', action: 'pay',
        title: 'Compensa amortizar mais rápido',
        body: `Sua taxa (${(r*100).toFixed(2)}% a.m.) supera o benchmark configurado (${this.benchmarkRate.toFixed(2)}% a.m.). Pagar parcelas maiores economiza mais do que renderia investindo a diferença.` });
    } else {
      tips.push({ icon: '💰', action: 'invest',
        title: 'Pode valer mais investir a diferença',
        body: `Sua taxa (${(r*100).toFixed(2)}% a.m.) está abaixo do benchmark (${this.benchmarkRate.toFixed(2)}% a.m.). Matematicamente, investir o valor extra pode render mais do que reduzir o prazo da dívida.` });
    }

    if (this.simPayment > d.monthly_payment) {
      const saved = this.interestSaved();
      const gain  = this.investGain();
      const extra = this.simPayment - d.monthly_payment;
      if (saved > gain) {
        tips.push({ icon: '✅', action: 'pay',
          title: `Pagar R$ ${extra.toFixed(0)} a mais vale mais`,
          body: `Economiza ${fmt(saved)} em juros vs. ${fmt(gain)} de rendimento investindo. Diferença de ${fmt(saved - gain)} a favor de quitar mais rápido.` });
      } else {
        tips.push({ icon: '📊', action: 'invest',
          title: `Investir os R$ ${extra.toFixed(0)} extras rende mais`,
          body: `Rendimento projetado de ${fmt(gain)} vs. ${fmt(saved)} economizados em juros. Diferença de ${fmt(gain - saved)} a favor do investimento.` });
      }
    }

    if (this.currentMonths() > 120) {
      tips.push({ icon: '📅', action: 'neutral',
        title: 'Dívida de longo prazo — revise periodicamente',
        body: `Com ${months2text(this.currentMonths())} restantes, renegociar a taxa periodicamente pode economizar mais do que amortizações extras. Verifique se há portabilidade de crédito disponível.` });
    }

    return tips;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit() {
    if (this.plan.loaded()) {
      if (this.plan.isPremium()) this.load();
      else this.loading.set(false);
    } else {
      this.api.get<any>('/plan').subscribe(r => {
        this.plan.plan.set(r.plan ?? 'free');
        this.plan.features.set(r.features ?? []);
        this.plan.loaded.set(true);
        if (this.plan.isPremium()) this.load();
        else this.loading.set(false);
      });
    }
  }

  load() {
    this.api.get<any>('/debts').subscribe(r => { this.debts.set(r.data ?? []); this.loading.set(false); });
  }

  select(d: Debt) {
    this.selected.set(d);
    this.simPayment = d.monthly_payment;
  }

  // ── Form ─────────────────────────────────────────────────────────────
  emptyForm() {
    return {
      name: '', type: 'personal_loan', system: 'price',
      original_amount: null, remaining_balance: null,
      monthly_rate_pct: null, monthly_payment: null,
      remaining_months: null, notes: ''
    };
  }

  openForm(d?: Debt) {
    if (d) {
      this.editingDebt.set(d);
      this.form = { ...d, monthly_rate_pct: +(d.monthly_rate * 100).toFixed(4) };
    } else {
      this.editingDebt.set(null);
      this.form = this.emptyForm();
    }
    this.showForm.set(true);
  }
  closeForm() { this.showForm.set(false); this.editingDebt.set(null); }

  recalcMonths() {
    const b = +this.form.remaining_balance;
    const r = +this.form.monthly_rate_pct / 100;
    const p = +this.form.monthly_payment;
    if (b > 0 && r > 0 && p > 0) {
      const n = calcMonths(b, r, p);
      if (n < 9999) this.form.remaining_months = n;
    }
  }
  calcMonthsHint(): string {
    const b = +this.form.remaining_balance, r = +this.form.monthly_rate_pct / 100, p = +this.form.monthly_payment;
    if (!b || !r || !p) return '';
    const n = calcMonths(b, r, p);
    return n >= 9999 ? '⚠️ Parcela insuficiente para quitar' : `Calculado: ${months2text(n)}`;
  }

  save() {
    this.saving.set(true);
    const payload = {
      ...this.form,
      monthly_rate:      +this.form.monthly_rate_pct / 100,
      original_amount:   +this.form.original_amount || +this.form.remaining_balance,
      remaining_balance: +this.form.remaining_balance,
      monthly_payment:   +this.form.monthly_payment,
      remaining_months:  +this.form.remaining_months || 0,
    };
    delete payload.monthly_rate_pct;

    const req = this.editingDebt()
      ? this.api.put<any>(`/debts/${this.editingDebt()!.id}`, payload)
      : this.api.post<any>('/debts', payload);

    req.subscribe({
      next: () => {
        this.toast.success('Dívida salva!');
        this.closeForm();
        this.load();
        this.saving.set(false);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar');
        this.saving.set(false);
      }
    });
  }

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  remove(d: Debt) {
    this.confirmItem.set({ msg: `Tem certeza que deseja excluir a dívida <strong>${d.name}</strong>?`, action: () => {
      this.api.delete(`/debts/${d.id}`).subscribe(() => {
        this.toast.success('Dívida excluída');
        if (this.selected()?.id === d.id) this.selected.set(null);
        this.load();
      });
    }});
  }

  doDelete() {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  typeLabel(t: string) { return TYPES[t] ?? t; }
  annualRate(d: Debt)  { return Math.pow(1 + d.monthly_rate, 12) - 1; }
  rateClass(d: Debt)   { return d.monthly_rate > 0.015 ? 'rate-high' : d.monthly_rate > 0.005 ? 'rate-mid' : 'rate-low'; }
  debtProgress(d: Debt) {
    if (!d.original_amount) return 50;
    return Math.min(100, (1 - d.remaining_balance / d.original_amount) * 100);
  }
  months2text = months2text;
}
