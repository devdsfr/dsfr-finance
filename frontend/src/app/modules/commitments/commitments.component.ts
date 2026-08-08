import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';

interface Commitment {
  id: string;
  description: string;
  amount: number;
  date: string;            // YYYY-MM-DD
  kind: 'pay' | 'receive';
  status: 'overdue' | 'today' | 'upcoming';
  paid: boolean;
}

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK = ['D','S','T','Q','Q','S','S'];

@Component({
  selector: 'app-commitments',
  standalone: true,
  imports: [CommonModule, RouterModule, AppCurrencyPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Compromissos</h1>
          <p class="sub">Tudo que vence no período, num lugar só.</p>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpis">
        <div class="kpi">
          <span class="kpi__l">A pagar no mês</span>
          <span class="kpi__v kpi__v--pay">{{ totalPay() | appCurrency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi__l">A receber no mês</span>
          <span class="kpi__v kpi__v--rec">{{ totalReceive() | appCurrency }}</span>
        </div>
        <div class="kpi" [class.kpi--alert]="overdueTotal() > 0">
          <span class="kpi__l">Em atraso</span>
          <span class="kpi__v kpi__v--overdue">{{ overdueTotal() | appCurrency }}</span>
          <span class="kpi__sub">{{ overdueItems().length }} {{ overdueItems().length === 1 ? 'conta' : 'contas' }}</span>
        </div>
        @if (debtMonthly() > 0) {
          <div class="kpi">
            <span class="kpi__l">Parcelas de dívidas</span>
            <span class="kpi__v kpi__v--pay">{{ debtMonthly() | appCurrency }}</span>
            <span class="kpi__sub">por mês (não incluídas no calendário)</span>
          </div>
        }
      </div>

      <!-- Month nav -->
      <div class="month-nav">
        <button class="nav-arrow" (click)="changeMonth(-1)">‹</button>
        <h2>{{ monthLabel() }}</h2>
        <button class="nav-arrow" (click)="changeMonth(1)">›</button>
      </div>

      @if (loading()) {
        <div class="skel-wrap">@for (i of [1,2,3]; track i) { <div class="skel-block"></div> }</div>
      } @else {
        <div class="cal-grid">
          <!-- Calendário -->
          <div class="card cal-card">
            <div class="cal-weekdays">
              @for (w of week; track $index) { <span>{{ w }}</span> }
            </div>
            <div class="cal-days">
              @for (cell of calendarCells(); track $index) {
                @if (cell) {
                  <button class="cal-day"
                          [class.cal-day--today]="cell.isToday"
                          [class.cal-day--sel]="cell.date === selectedDay()"
                          [class.cal-day--has]="cell.items.length > 0"
                          (click)="selectDay(cell.date)">
                    <span class="cal-day__num">{{ cell.day }}</span>
                    @if (cell.items.length > 0) {
                      <span class="cal-dots">
                        @if (cell.hasOverdue) { <i class="dot dot--overdue"></i> }
                        @else if (cell.hasToday) { <i class="dot dot--today"></i> }
                        @else { <i class="dot dot--upcoming"></i> }
                      </span>
                    }
                  </button>
                } @else {
                  <span class="cal-empty"></span>
                }
              }
            </div>
            <div class="cal-legend">
              <span><i class="dot dot--overdue"></i> Atrasado</span>
              <span><i class="dot dot--today"></i> Vence hoje</span>
              <span><i class="dot dot--upcoming"></i> A vencer</span>
            </div>
          </div>

          <!-- Lista -->
          <div class="card list-card">
            <div class="list-head">
              <h3>{{ selectedDay() ? dayLabel(selectedDay()) : 'Todos do mês' }}</h3>
              @if (selectedDay()) {
                <button class="clear-day" (click)="selectedDay.set('')">ver o mês todo</button>
              }
            </div>

            @if (visibleItems().length === 0) {
              <div class="empty">Nenhum compromisso neste período. 🎉</div>
            } @else {
              @for (grp of groupedVisible(); track grp.key) {
                <div class="grp">
                  <div class="grp__label" [class]="'grp__label--' + grp.key">{{ grp.title }}</div>
                  @for (it of grp.items; track it.id) {
                    <div class="row" [class.row--rec]="it.kind === 'receive'">
                      <span class="row__bar" [class]="'row__bar--' + it.status"></span>
                      <div class="row__info">
                        <span class="row__desc">{{ it.description }}</span>
                        <span class="row__date">{{ it.date | date:'dd/MM/yyyy':'UTC' }}</span>
                      </div>
                      <span class="row__amt" [class.row__amt--rec]="it.kind === 'receive'">
                        {{ it.kind === 'receive' ? '+' : '-' }}{{ it.amount | appCurrency }}
                      </span>
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 1000px; margin: 0 auto; }
    .page-header { margin-bottom: 1.25rem; }
    .page-header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }
    .sub { color: #6b7280; font-size: .85rem; margin: .2rem 0 0; }

    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .875rem; margin-bottom: 1.25rem; }
    .kpi { background: #fff; border-radius: .6rem; padding: .9rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); display: flex; flex-direction: column; gap: .25rem; }
    .kpi--alert { border: 1px solid #fecaca; background: #fef2f2; }
    .kpi__l { font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; color: #9ca3af; }
    .kpi__v { font-size: 1.2rem; font-weight: 700; }
    .kpi__v--pay { color: #dc2626; }
    .kpi__v--rec { color: #16a34a; }
    .kpi__v--overdue { color: #b91c1c; }
    .kpi__sub { font-size: .7rem; color: #9ca3af; }

    .month-nav { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; justify-content: center; }
    .month-nav h2 { font-size: 1.1rem; font-weight: 700; color: #111; margin: 0; min-width: 170px; text-align: center; }
    .nav-arrow { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid #e5e7eb; background: #fff; font-size: 1.3rem; cursor: pointer; color: #374151; line-height: 1; }
    .nav-arrow:hover { border-color: #2e7736; color: #2e7736; }

    .cal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .card { background: #fff; border-radius: .75rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.1rem; }

    .cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 6px; }
    .cal-weekdays span { text-align: center; font-size: .68rem; font-weight: 700; color: #9ca3af; }
    .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .cal-day { position: relative; aspect-ratio: 1; border: 1px solid transparent; border-radius: .45rem; background: #f9fafb; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: all .12s; }
    .cal-day:hover { background: #f0fdf4; }
    .cal-day--has { background: #fff; border-color: #e5e7eb; font-weight: 700; }
    .cal-day--today { border-color: #2e7736; }
    .cal-day--sel { background: #2e7736; }
    .cal-day--sel .cal-day__num { color: #fff; }
    .cal-day__num { font-size: .82rem; color: #374151; }
    .cal-empty { aspect-ratio: 1; }
    .cal-dots { display: flex; gap: 2px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .dot--overdue { background: #dc2626; }
    .dot--today { background: #f59e0b; }
    .dot--upcoming { background: #16a34a; }
    .cal-legend { display: flex; gap: 1rem; margin-top: .85rem; flex-wrap: wrap; }
    .cal-legend span { display: inline-flex; align-items: center; gap: .35rem; font-size: .72rem; color: #6b7280; }

    .list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
    .list-head h3 { font-size: .95rem; font-weight: 700; color: #111; margin: 0; }
    .clear-day { background: none; border: none; color: #2e7736; font-size: .76rem; cursor: pointer; font-weight: 600; }
    .clear-day:hover { text-decoration: underline; }
    .empty { text-align: center; color: #9ca3af; font-size: .875rem; padding: 2rem 1rem; }

    .grp { margin-bottom: .85rem; }
    .grp__label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: .25rem 0; }
    .grp__label--overdue { color: #dc2626; }
    .grp__label--today { color: #d97706; }
    .grp__label--upcoming { color: #6b7280; }
    .row { display: flex; align-items: center; gap: .7rem; padding: .55rem 0; border-top: 1px solid #f3f4f6; }
    .row__bar { width: 3px; align-self: stretch; border-radius: 2px; background: #d1d5db; flex-shrink: 0; }
    .row__bar--overdue { background: #dc2626; }
    .row__bar--today { background: #f59e0b; }
    .row__bar--upcoming { background: #22c55e; }
    .row__info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .row__desc { font-size: .85rem; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row__date { font-size: .72rem; color: #9ca3af; }
    .row__amt { font-size: .88rem; font-weight: 700; color: #dc2626; white-space: nowrap; }
    .row__amt--rec { color: #16a34a; }

    .skel-wrap { display: flex; flex-direction: column; gap: .5rem; }
    .skel-block { height: 120px; background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: .6rem; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    @media (max-width: 720px) { .cal-grid { grid-template-columns: 1fr; } }


    /* ══ DARK THEME (auto) ══ */
    :host-context([data-theme="dark"]) .page-header h1 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sub { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .kpi { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .kpi__l { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .kpi__sub { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .month-nav h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .nav-arrow { color: #e2e8f5 !important; background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .card { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .cal-weekdays span { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .cal-day { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .cal-day--has { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .cal-day__num { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .cal-legend span { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .list-head h3 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .empty { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .row { border-top-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .row__desc { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .row__date { color: #8393ad !important; }
  `]
})
export class CommitmentsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  week = WEEK;
  loading = signal(true);
  items = signal<Commitment[]>([]);
  debtMonthly = signal(0);

  year  = signal(new Date().getFullYear());
  month = signal(new Date().getMonth() + 1); // 1-12
  selectedDay = signal<string>('');

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  monthLabel = computed(() => `${PT_MONTHS[this.month() - 1]} ${this.year()}`);

  totalPay     = computed(() => this.items().filter(i => i.kind === 'pay').reduce((s, i) => s + i.amount, 0));
  totalReceive = computed(() => this.items().filter(i => i.kind === 'receive').reduce((s, i) => s + i.amount, 0));
  overdueItems = computed(() => this.items().filter(i => i.status === 'overdue'));
  overdueTotal = computed(() => this.overdueItems().reduce((s, i) => s + i.amount, 0));

  /** Itens do dia selecionado, ou todos do mês. */
  visibleItems = computed(() => {
    const d = this.selectedDay();
    const list = d ? this.items().filter(i => i.date === d) : this.items();
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  });

  groupedVisible = computed(() => {
    const order: { key: Commitment['status']; title: string }[] = [
      { key: 'overdue',  title: 'Atrasados' },
      { key: 'today',    title: 'Vencem hoje' },
      { key: 'upcoming', title: 'A vencer' },
    ];
    return order
      .map(o => ({ ...o, items: this.visibleItems().filter(i => i.status === o.key) }))
      .filter(g => g.items.length > 0);
  });

  /** Células do calendário: null = espaço vazio antes do dia 1. */
  calendarCells = computed(() => {
    const y = this.year(), m = this.month();
    const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0=domingo
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = this.todayStr();
    const cells: ({ day: number; date: string; isToday: boolean; items: Commitment[]; hasOverdue: boolean; hasToday: boolean } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayItems = this.items().filter(i => i.date === date);
      cells.push({
        day: d, date, isToday: date === today, items: dayItems,
        hasOverdue: dayItems.some(i => i.status === 'overdue'),
        hasToday: dayItems.some(i => i.status === 'today'),
      });
    }
    return cells;
  });

  ngOnInit() { this.load(); }

  changeMonth(delta: number) {
    let m = this.month() + delta, y = this.year();
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    this.month.set(m); this.year.set(y);
    this.selectedDay.set('');
    this.load();
  }

  selectDay(date: string) {
    this.selectedDay.set(this.selectedDay() === date ? '' : date);
  }

  dayLabel(date: string): string {
    const [, , d] = date.split('-');
    return `Dia ${Number(d)} de ${PT_MONTHS[this.month() - 1]}`;
  }

  private load() {
    this.loading.set(true);
    const y = this.year(), m = String(this.month()).padStart(2, '0');
    const from = `${y}-${m}-01`;
    const to = `${y}-${m}-${String(new Date(this.year(), this.month(), 0).getDate()).padStart(2, '0')}`;
    const today = this.todayStr();

    forkJoin({
      pay:     this.api.get<any>(`/transactions?type=expense&paid=false&date_from=${from}&date_to=${to}&limit=200`).pipe(catchError(() => of({ data: [] }))),
      receive: this.api.get<any>(`/transactions?type=income&paid=false&date_from=${from}&date_to=${to}&limit=200`).pipe(catchError(() => of({ data: [] }))),
      debts:   this.api.get<any>('/debts').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(res => {
      const mkStatus = (date: string): Commitment['status'] =>
        date < today ? 'overdue' : date === today ? 'today' : 'upcoming';

      const map = (arr: any[], kind: 'pay' | 'receive'): Commitment[] =>
        arr.map(t => {
          const date = (t.date ?? '').slice(0, 10);
          return { id: t.id, description: t.description, amount: Math.abs(t.amount ?? 0), date, kind, status: mkStatus(date), paid: !!t.paid };
        });

      const all = [...map(res.pay.data ?? [], 'pay'), ...map(res.receive.data ?? [], 'receive')];
      this.items.set(all);

      const debts: any[] = res.debts.data ?? [];
      this.debtMonthly.set(debts.reduce((s, d) => s + (d.remaining_months > 0 ? (d.monthly_payment ?? 0) : 0), 0));

      this.loading.set(false);
    });
  }
}
