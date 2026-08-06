import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';

interface MonthRow {
  month: string;        // YYYY-MM
  label: string;
  income: number;       // entradas previstas (a receber)
  expense: number;      // saídas previstas (a pagar + parcelas de dívida)
  net: number;          // income - expense
  running: number;      // saldo projetado acumulado
}

const PT_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, RouterModule, AppCurrencyPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Previsão Financeira</h1>
          <p class="sub">Projeção dos próximos meses a partir dos compromissos já cadastrados.</p>
        </div>
        <div class="range">
          @for (h of horizons; track h) {
            <button class="range-btn" [class.range-btn--active]="months() === h" (click)="setMonths(h)">{{ h }}m</button>
          }
          <span class="tabs">
            <button class="tab" [class.tab--active]="view() === 'chart'" (click)="view.set('chart')">Gráfico</button>
            <button class="tab" [class.tab--active]="view() === 'table'" (click)="view.set('table')">Tabela</button>
          </span>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpis">
        <div class="kpi">
          <span class="kpi__l">Saldo atual</span>
          <span class="kpi__v">{{ startBalance() | appCurrency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi__l">Total entradas previstas</span>
          <span class="kpi__v kpi__v--rec">{{ totalIncome() | appCurrency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi__l">Total saídas previstas</span>
          <span class="kpi__v kpi__v--pay">{{ totalExpense() | appCurrency }}</span>
        </div>
        <div class="kpi" [class.kpi--alert]="finalBalance() < 0">
          <span class="kpi__l">Saldo projetado ({{ monthsLabel() }})</span>
          <span class="kpi__v" [class.kpi__v--pay]="finalBalance() < 0" [class.kpi__v--rec]="finalBalance() >= 0">{{ finalBalance() | appCurrency }}</span>
        </div>
      </div>

      @if (loading()) {
        <div class="skel-block"></div>
      } @else if (rows().length === 0) {
        <div class="card empty">Sem compromissos futuros cadastrados para projetar.</div>
      } @else if (view() === 'chart') {
        <!-- Gráfico -->
        <div class="card">
          <div class="legend">
            <span><i class="lg lg--rec"></i> Entradas</span>
            <span><i class="lg lg--pay"></i> Saídas</span>
            <span><i class="lg lg--line"></i> Saldo projetado</span>
          </div>
          <svg class="chart" [attr.viewBox]="'0 0 ' + CW + ' ' + CH" preserveAspectRatio="none">
            <!-- linha zero -->
            <line [attr.x1]="PAD_L" [attr.y1]="yZero()" [attr.x2]="CW - PAD_R" [attr.y2]="yZero()" stroke="currentColor" stroke-opacity=".25" stroke-width="1" stroke-dasharray="3 3"/>
            <!-- barras -->
            @for (b of bars(); track b.month) {
              <rect [attr.x]="b.incX" [attr.y]="b.incY" [attr.width]="b.w" [attr.height]="b.incH" fill="#16a34a" rx="2" opacity=".85"/>
              <rect [attr.x]="b.expX" [attr.y]="b.expY" [attr.width]="b.w" [attr.height]="b.expH" fill="#dc2626" rx="2" opacity=".85"/>
            }
            <!-- linha do saldo -->
            <polyline [attr.points]="linePoints()" fill="none" stroke="#2e7736" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            @for (p of lineDots(); track p.x) { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" fill="#2e7736"/> }
            <!-- labels x -->
            @for (l of xLabels(); track l.x) { <text [attr.x]="l.x" [attr.y]="CH - 6" text-anchor="middle" class="axis">{{ l.label }}</text> }
          </svg>
        </div>
      } @else {
        <!-- Tabela -->
        <div class="card">
          <table class="ftable">
            <thead>
              <tr><th class="left">Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th><th>Saldo projetado</th></tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.month) {
                <tr>
                  <td class="left">{{ r.label }}</td>
                  <td class="num rec">{{ r.income | appCurrency }}</td>
                  <td class="num pay">{{ r.expense | appCurrency }}</td>
                  <td class="num" [class.rec]="r.net >= 0" [class.pay]="r.net < 0">{{ r.net >= 0 ? '+' : '' }}{{ r.net | appCurrency }}</td>
                  <td class="num bold" [class.pay]="r.running < 0">{{ r.running | appCurrency }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <p class="note">Projeção determinística: soma o que já está cadastrado (contas a pagar/receber futuras, lançamentos recorrentes e parcelas de dívidas). Gastos variáveis não lançados não entram — a saída real tende a ser maior.</p>
    </div>
  `,
  styles: [`
    .page { max-width: 1000px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .page-header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }
    .sub { color: #6b7280; font-size: .85rem; margin: .2rem 0 0; max-width: 460px; }
    .range { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
    .range-btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 9999px; padding: .3rem .7rem; font-size: .78rem; font-weight: 600; color: #6b7280; cursor: pointer; }
    .range-btn--active { background: #2e7736; color: #fff; border-color: #2e7736; }
    .tabs { display: inline-flex; margin-left: .5rem; border: 1px solid #e5e7eb; border-radius: 9999px; overflow: hidden; }
    .tab { border: none; background: #fff; padding: .3rem .8rem; font-size: .78rem; font-weight: 600; color: #6b7280; cursor: pointer; }
    .tab--active { background: #1a2035; color: #fff; }

    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .875rem; margin-bottom: 1.25rem; }
    .kpi { background: #fff; border-radius: .6rem; padding: .9rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); display: flex; flex-direction: column; gap: .25rem; }
    .kpi--alert { border: 1px solid #fecaca; }
    .kpi__l { font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; color: #9ca3af; }
    .kpi__v { font-size: 1.2rem; font-weight: 700; color: #111; }
    .kpi__v--pay { color: #dc2626; }
    .kpi__v--rec { color: #16a34a; }

    .card { background: #fff; border-radius: .75rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.25rem; margin-bottom: 1rem; }
    .empty { text-align: center; color: #9ca3af; font-size: .9rem; padding: 2.5rem; }

    .legend { display: flex; gap: 1.25rem; margin-bottom: .85rem; flex-wrap: wrap; }
    .legend span { display: inline-flex; align-items: center; gap: .4rem; font-size: .75rem; color: #6b7280; }
    .lg { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    .lg--rec { background: #16a34a; }
    .lg--pay { background: #dc2626; }
    .lg--line { width: 16px; height: 3px; border-radius: 2px; background: #2e7736; }
    .chart { width: 100%; height: 300px; color: #6b7280; display: block; }
    .axis { font-size: 9px; fill: currentColor; opacity: .8; }

    .ftable { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .ftable th { background: #f9fafb; padding: .55rem .75rem; text-align: right; color: #6b7280; font-size: .72rem; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
    .ftable th.left, .ftable td.left { text-align: left; }
    .ftable td { padding: .55rem .75rem; border-top: 1px solid #f3f4f6; text-align: right; color: #374151; }
    .ftable td.num { font-variant-numeric: tabular-nums; }
    .ftable .rec { color: #16a34a; }
    .ftable .pay { color: #dc2626; }
    .ftable .bold { font-weight: 700; color: #111; }

    .note { font-size: .75rem; color: #9ca3af; line-height: 1.5; margin: .5rem 0 0; }

    .skel-block { height: 300px; background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: .75rem; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .card,
    :host-context([data-theme="dark"]) .kpi { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .kpi--alert { border-color: rgba(220,38,38,.35) !important; }
    :host-context([data-theme="dark"]) .page-header h1,
    :host-context([data-theme="dark"]) .kpi__v,
    :host-context([data-theme="dark"]) .ftable .bold { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sub, :host-context([data-theme="dark"]) .kpi__l,
    :host-context([data-theme="dark"]) .legend span, :host-context([data-theme="dark"]) .note { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .range-btn, :host-context([data-theme="dark"]) .tab { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .range-btn--active { background: #2e7736 !important; color: #fff !important; border-color: #2e7736 !important; }
    :host-context([data-theme="dark"]) .tab--active { background: #4ade80 !important; color: #0d1117 !important; }
    :host-context([data-theme="dark"]) .chart { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .ftable th { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .ftable td { border-color: #232d42 !important; color: #c5cdd9 !important; }
  `]
})
export class ForecastComponent implements OnInit {
  private api = inject(ApiService);

  horizons = [3, 6, 12];
  months = signal(6);
  view = signal<'chart' | 'table'>('chart');
  loading = signal(true);

  startBalance = signal(0);
  rows = signal<MonthRow[]>([]);

  monthsLabel = computed(() => this.rows().length ? this.rows()[this.rows().length - 1].label : '');
  totalIncome  = computed(() => this.rows().reduce((s, r) => s + r.income, 0));
  totalExpense = computed(() => this.rows().reduce((s, r) => s + r.expense, 0));
  finalBalance = computed(() => this.rows().length ? this.rows()[this.rows().length - 1].running : this.startBalance());

  ngOnInit() { this.load(); }
  setMonths(n: number) { this.months.set(n); this.load(); }

  private load() {
    this.loading.set(true);
    const now = new Date();
    const startY = now.getFullYear(), startM = now.getMonth(); // 0-based
    const from = `${startY}-${String(startM + 1).padStart(2, '0')}-01`;
    const endDate = new Date(startY, startM + this.months(), 0);
    const to = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    forkJoin({
      accounts: this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] }))),
      pay:      this.api.get<any>(`/transactions?type=expense&paid=false&date_from=${from}&date_to=${to}&limit=1000`).pipe(catchError(() => of({ data: [] }))),
      receive:  this.api.get<any>(`/transactions?type=income&paid=false&date_from=${from}&date_to=${to}&limit=1000`).pipe(catchError(() => of({ data: [] }))),
      debts:    this.api.get<any>('/debts').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(res => {
      const balance = (res.accounts.data ?? []).reduce((s: number, a: any) => s + (a.balance ?? 0), 0);
      this.startBalance.set(balance);

      // Índice mês → { income, expense }
      const buckets = new Map<string, { income: number; expense: number }>();
      const keyFor = (i: number) => {
        const d = new Date(startY, startM + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };
      for (let i = 0; i < this.months(); i++) buckets.set(keyFor(i), { income: 0, expense: 0 });

      const add = (arr: any[], field: 'income' | 'expense') => {
        for (const t of arr) {
          const mk = (t.date ?? '').slice(0, 7);
          const b = buckets.get(mk);
          if (b) b[field] += Math.abs(t.amount ?? 0);
        }
      };
      add(res.receive.data ?? [], 'income');
      add(res.pay.data ?? [], 'expense');

      // Parcelas de dívidas: soma monthly_payment nos próximos min(months, remaining) meses.
      const debts: any[] = res.debts.data ?? [];
      for (let i = 0; i < this.months(); i++) {
        const b = buckets.get(keyFor(i))!;
        for (const d of debts) {
          if ((d.remaining_months ?? 0) > i) b.expense += (d.monthly_payment ?? 0);
        }
      }

      // Monta linhas com saldo acumulado.
      let running = balance;
      const out: MonthRow[] = [];
      for (let i = 0; i < this.months(); i++) {
        const key = keyFor(i);
        const b = buckets.get(key)!;
        const net = b.income - b.expense;
        running += net;
        const [yy, mm] = key.split('-').map(Number);
        out.push({ month: key, label: `${PT_FULL[mm - 1]} ${yy}`, income: b.income, expense: b.expense, net, running });
      }
      this.rows.set(out);
      this.loading.set(false);
    });
  }

  // ── Geometria do gráfico ──────────────────────────────────────────────
  readonly CW = 760; readonly CH = 300;
  readonly PAD_L = 40; readonly PAD_R = 12; readonly PAD_T = 14; readonly PAD_B = 24;

  private bounds = computed(() => {
    const vals: number[] = [];
    for (const r of this.rows()) { vals.push(r.income, r.expense, r.running); }
    vals.push(this.startBalance(), 0);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    return { min, max: max === min ? max + 1 : max };
  });

  private yFor(v: number): number {
    const { min, max } = this.bounds();
    const usable = this.CH - this.PAD_T - this.PAD_B;
    return this.PAD_T + usable - ((v - min) / (max - min)) * usable;
  }
  yZero(): number { return this.yFor(0); }

  private slotW(): number {
    const n = Math.max(this.rows().length, 1);
    return (this.CW - this.PAD_L - this.PAD_R) / n;
  }

  bars = computed(() => {
    const slot = this.slotW();
    const bw = Math.min(18, slot * 0.28);
    const zero = this.yZero();
    return this.rows().map((r, i) => {
      const cx = this.PAD_L + slot * i + slot / 2;
      const incY = this.yFor(r.income);
      const expY = this.yFor(r.expense);
      return {
        month: r.month, w: bw,
        incX: cx - bw - 2, incY, incH: Math.max(0, zero - incY),
        expX: cx + 2, expY, expH: Math.max(0, zero - expY),
      };
    });
  });

  private linePts = computed(() => {
    const slot = this.slotW();
    return this.rows().map((r, i) => ({ x: this.PAD_L + slot * i + slot / 2, y: this.yFor(r.running) }));
  });
  linePoints = computed(() => this.linePts().map(p => `${p.x},${p.y}`).join(' '));
  lineDots = computed(() => this.linePts());

  xLabels = computed(() => {
    const slot = this.slotW();
    const step = this.rows().length > 8 ? 2 : 1;
    return this.rows()
      .map((r, i) => ({ i, x: this.PAD_L + slot * i + slot / 2, label: PT_ABBR[Number(r.month.split('-')[1]) - 1] }))
      .filter((_, i) => i % step === 0);
  });
}
