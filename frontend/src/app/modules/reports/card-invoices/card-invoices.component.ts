import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppCurrencyPipe } from '../../../shared/pipes/app-currency.pipe';

// Same asset/hasBg logic as banking component
const ASSET_HAS_BG: Record<string, boolean> = {
  'nubank.svg': true, 'itau.svg': true, 'santander.svg': true, 'bb.svg': true,
};
const CARD_ICON_MAP: Record<string, string> = {
  nubank: 'nubank.svg', inter: 'inter.svg', itau: 'itau.svg', bradesco: 'bradesco.svg',
  santander: 'santander.svg', caixa: 'caixa.svg', bb: 'bb.svg', c6bank: 'c6bank.svg',
  btg: 'btg.svg', xp: 'xp.svg', mercadopago: 'mercadopago.svg', neon: 'neon.svg',
  picpay: 'picpay.svg', sicoob: 'sicoob.svg', sicredi: 'sicredi.svg', stone: 'stone.svg',
};

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

@Component({
  selector: 'app-card-invoices',
  standalone: true,
  imports: [CommonModule, RouterModule, AppCurrencyPipe],
  template: `
<div class="inv-page">

  <!-- Card selector (shown when no card pre-selected from URL) -->
  @if (!cards().length) {
    <div class="loading-msg">Carregando cartões…</div>
  } @else {

    <!-- Card tabs -->
    <div class="card-tabs">
      @for (c of cards(); track c.id) {
        <button class="card-tab" [class.active]="selectedCardId() === c.id" (click)="selectCard(c.id)">
          <div class="tab-icon" [class.tab-icon--bg]="c.hasBg"
               [style.background]="c.hasBg ? 'transparent' : (c.siSlug ? (c.color||'#6366f1') : '#fff')"
               [style.border-color]="(c.hasBg||c.siSlug) ? 'transparent' : '#e5e7eb'">
            @if (c.asset) {
              <img [src]="'assets/banks/' + c.asset" [alt]="c.name"
                   [class.tab-logo--full]="c.hasBg" class="tab-logo" />
            } @else if (c.siSlug) {
              <img [src]="'https://cdn.simpleicons.org/' + c.siSlug + '/ffffff'" [alt]="c.name" class="tab-logo" />
            } @else {
              <span class="tab-initial" [style.background]="c.color||'#6366f1'">{{ c.name[0] }}</span>
            }
          </div>
          <span class="tab-name">{{ c.name }}</span>
        </button>
      }
    </div>

    @if (selectedCard()) {
      <!-- Invoice header -->
      <div class="inv-header">
        <div class="inv-card-info">
          <div class="inv-icon" [class.inv-icon--bg]="selectedCard()!.hasBg"
               [style.background]="selectedCard()!.hasBg ? 'transparent' : (selectedCard()!.siSlug ? (selectedCard()!.color||'#6366f1') : '#fff')"
               [style.border-color]="(selectedCard()!.hasBg||selectedCard()!.siSlug) ? 'transparent' : '#e5e7eb'">
            @if (selectedCard()?.asset) {
              <img [src]="'assets/banks/' + selectedCard()!.asset" [alt]="selectedCard()!.name"
                   [class.inv-logo--full]="selectedCard()!.hasBg" class="inv-logo" />
            } @else if (selectedCard()?.siSlug) {
              <img [src]="'https://cdn.simpleicons.org/' + selectedCard()!.siSlug + '/ffffff'" [alt]="selectedCard()!.name" class="inv-logo" />
            } @else {
              <span style="font-size:1.2rem;color:#fff;font-weight:700">{{ selectedCard()!.name[0] }}</span>
            }
          </div>
          <div>
            <div class="inv-card-name">{{ selectedCard()!.name }}</div>
            <span class="inv-badge" [class.inv-badge--open]="isCurrentMonth()" [class.inv-badge--closed]="!isCurrentMonth()">
              {{ isCurrentMonth() ? 'FATURA ABERTA' : 'FATURA FECHADA' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Month navigation -->
      <div class="month-nav">
        <button class="nav-arrow" (click)="prevMonth()">‹</button>
        <h2 class="month-title">Fatura <strong>{{ monthLabel() }}</strong></h2>
        <button class="nav-arrow" (click)="nextMonth()" [disabled]="!canGoNext()">›</button>
      </div>

      <!-- Summary panels -->
      <div class="inv-summary">
        <div class="sum-panel">
          <div class="sum-label">SALDO MÊS ANTERIOR</div>
          <div class="sum-val">{{ prevTotal() | appCurrency }}</div>
        </div>
        <div class="sum-panel sum-panel--mid">
          <div class="sum-label">VENCIMENTO</div>
          <div class="sum-val sum-val--date">{{ dueLabel() }}</div>
        </div>
        <div class="sum-panel sum-panel--right">
          <div class="sum-label">VALOR DA FATURA</div>
          <div class="sum-val sum-val--total">{{ currentTotal() | appCurrency }}</div>
          @if (isPaid()) {
            <span class="pay-badge pay-badge--paid">PAGA</span>
          } @else if (hasUnpaid()) {
            <span class="pay-badge pay-badge--open">EM ABERTO</span>
          } @else {
            <span class="pay-badge">FECHADA</span>
          }
        </div>
      </div>

      @if (hasUnpaid()) {
        <div class="inv-action">
          <button class="btn-pay" (click)="payInvoice()" [disabled]="payingInvoice()">
            {{ payingInvoice() ? 'Pagando…' : 'Pagar fatura · ' + (currentTotal() | appCurrency) }}
          </button>
        </div>
      } @else if (isPaid()) {
        <div class="inv-action">
          <span class="paid-tag">✓ Fatura paga</span>
        </div>
      }

      <div class="inv-meta">
        <span>Fatura atual: <strong>{{ currentTotal() | appCurrency }}</strong></span>
        @if (selectedCard()!.closing_day) {
          <span>Fechamento: <strong>dia {{ selectedCard()!.closing_day }}</strong></span>
        }
        @if (selectedCard()!.due_day) {
          <span>Vencimento: <strong>dia {{ selectedCard()!.due_day }}</strong></span>
        }
      </div>

      <!-- Transaction list -->
      <div class="txn-section">
        <div class="txn-header">
          <h3>Lançamentos</h3>
          <a [routerLink]="['/transactions']" [queryParams]="{credit_card_id: selectedCardId(), date_from: monthStart(), date_to: monthEnd()}" class="btn-see-all">Ver todos</a>
        </div>
        @if (loadingTxns()) {
          <div class="txn-list">
            @for (i of [1,2,3,4]; track i) {
              <div class="txn-row txn-skel">
                <div class="skel-block" style="width:36px;height:36px;border-radius:50%"></div>
                <div style="flex:1">
                  <div class="skel-block skel-p" style="width:140px"></div>
                  <div class="skel-block skel-p" style="width:80px;margin-top:4px"></div>
                </div>
                <div class="skel-block skel-p" style="width:70px"></div>
              </div>
            }
          </div>
        } @else if (!transactions().length) {
          <div class="txn-empty">Nenhum lançamento neste período.</div>
        } @else {
          <div class="txn-list">
            @for (t of transactions(); track t.id) {
              <div class="txn-row">
                <div class="txn-cat-icon" [style.background]="t.category_color || '#e5e7eb'">
                  {{ t.category_icon || '📋' }}
                </div>
                <div class="txn-info">
                  <div class="txn-desc">{{ t.description }}</div>
                  <div class="txn-date">{{ t.date | date:'dd/MM/yyyy' }} · {{ t.category_name || 'Sem categoria' }}</div>
                </div>
                <div class="txn-amount" [class.txn-expense]="t.type==='expense'" [class.txn-income]="t.type==='income'">
                  {{ t.type === 'expense' ? '-' : '+' }}{{ t.amount | appCurrency }}
                </div>
              </div>
            }
          </div>
        }
      </div>
    }
  }
</div>
  `,
  styles: [`
    .inv-page { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem; }

    /* Card tabs */
    .card-tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .card-tab { display: flex; align-items: center; gap: .5rem; padding: .4rem .85rem .4rem .4rem;
      border: 2px solid #e5e7eb; border-radius: 2rem; background: #fff; cursor: pointer;
      font-size: .82rem; font-weight: 600; color: #374151; transition: all .15s; }
    .card-tab:hover { border-color: #9ca3af; }
    .card-tab.active { border-color: #16a34a; background: #f0fdf4; color: #16a34a; }
    .tab-icon { width: 28px; height: 28px; border-radius: .4rem; display: flex; align-items: center;
      justify-content: center; border: 1.5px solid #e5e7eb; overflow: hidden; flex-shrink: 0; }
    .tab-icon--bg { border-color: transparent; }
    .tab-logo { width: 20px; height: 20px; object-fit: contain; }
    .tab-logo--full { width: 28px; height: 28px; object-fit: cover; border-radius: .4rem; }
    .tab-initial { width: 28px; height: 28px; border-radius: .4rem; display: flex; align-items: center;
      justify-content: center; color: #fff; font-weight: 700; font-size: .75rem; }
    .tab-name { line-height: 1; }

    /* Header */
    .inv-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .inv-card-info { display: flex; align-items: center; gap: .75rem; }
    .inv-icon { width: 52px; height: 52px; border-radius: .6rem; display: flex; align-items: center;
      justify-content: center; border: 1.5px solid #e5e7eb; overflow: hidden; flex-shrink: 0; }
    .inv-icon--bg { border-color: transparent; }
    .inv-logo { width: 36px; height: 36px; object-fit: contain; }
    .inv-logo--full { width: 52px; height: 52px; object-fit: cover; border-radius: .6rem; }
    .inv-card-name { font-size: 1.1rem; font-weight: 700; color: #111; }
    .inv-badge { display: inline-block; padding: .2rem .6rem; border-radius: 1rem; font-size: .7rem;
      font-weight: 700; letter-spacing: .04em; margin-top: .2rem; }
    .inv-badge--open { background: #dcfce7; color: #16a34a; }
    .inv-badge--closed { background: #f3f4f6; color: #6b7280; }

    /* Month nav */
    .month-nav { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
    .month-title { font-size: 1.25rem; font-weight: 400; color: #111; margin: 0; flex: 1; text-align: center; }
    .month-title strong { font-weight: 700; }
    .nav-arrow { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid #e5e7eb;
      background: #fff; font-size: 1.4rem; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #374151; transition: all .12s; line-height: 1; }
    .nav-arrow:hover:not(:disabled) { border-color: #9ca3af; background: #f9fafb; }
    .nav-arrow:disabled { opacity: .35; cursor: not-allowed; }

    /* Summary panels */
    .inv-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
      background: #e5e7eb; border-radius: .75rem; overflow: hidden; margin-bottom: 1rem; }
    .sum-panel { background: #fff; padding: 1.25rem 1.25rem; }
    .sum-panel--mid { border-left: none; }
    .sum-panel--right { border-left: none; }
    .sum-label { font-size: .68rem; font-weight: 700; color: #9ca3af; letter-spacing: .06em; margin-bottom: .35rem; }
    .sum-val { font-size: 1.15rem; font-weight: 700; color: #111; }
    .sum-val--date { font-size: 1.05rem; color: #374151; }
    .sum-val--total { color: #dc2626; }
    .pay-badge { display: inline-block; margin-top: .4rem; padding: .2rem .7rem; border-radius: 1rem;
      font-size: .68rem; font-weight: 700; background: #f3f4f6; color: #6b7280; letter-spacing: .05em; }
    .pay-badge--open { background: #dcfce7; color: #16a34a; }
    .pay-badge--paid { background: #dbeafe; color: #2563eb; }

    /* Pay action */
    .inv-action { margin-bottom: 1.25rem; }
    .btn-pay { width: 100%; padding: .85rem 1.25rem; border: none; border-radius: .6rem;
      background: #16a34a; color: #fff; font-size: .95rem; font-weight: 700; cursor: pointer;
      transition: background .15s; }
    .btn-pay:hover:not(:disabled) { background: #15803d; }
    .btn-pay:disabled { opacity: .6; cursor: not-allowed; }
    .paid-tag { display: inline-flex; align-items: center; gap: .4rem; padding: .6rem 1rem;
      border-radius: .6rem; background: #f0fdf4; color: #16a34a; font-weight: 700; font-size: .9rem; }

    .inv-meta { display: flex; gap: 1.5rem; font-size: .8rem; color: #6b7280; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .inv-meta strong { color: #374151; }

    /* Transactions */
    .txn-section { background: #fff; border-radius: .75rem; border: 1px solid #e5e7eb; overflow: hidden; }
    .txn-header { display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.25rem; border-bottom: 1px solid #f3f4f6; }
    .txn-header h3 { margin: 0; font-size: .95rem; font-weight: 700; color: #111; }
    .btn-see-all { font-size: .78rem; color: #16a34a; font-weight: 600; text-decoration: none; }
    .btn-see-all:hover { text-decoration: underline; }
    .txn-list { }
    .txn-row { display: flex; align-items: center; gap: .875rem; padding: .875rem 1.25rem;
      border-bottom: 1px solid #f9fafb; }
    .txn-row:last-child { border-bottom: none; }
    .txn-skel { gap: .875rem; }
    .txn-cat-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 1rem; flex-shrink: 0; }
    .txn-info { flex: 1; min-width: 0; }
    .txn-desc { font-size: .875rem; font-weight: 600; color: #111; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .txn-date { font-size: .72rem; color: #9ca3af; margin-top: .1rem; }
    .txn-amount { font-size: .9rem; font-weight: 700; white-space: nowrap; }
    .txn-expense { color: #dc2626; }
    .txn-income { color: #16a34a; }
    .txn-empty { text-align: center; color: #9ca3af; padding: 2.5rem; font-size: .875rem; }
    .loading-msg { text-align: center; color: #9ca3af; padding: 3rem; }
    .skel-block { background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: .25rem; }
    .skel-p { height: 14px; display: block; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  `]
})
export class CardInvoicesComponent implements OnInit {
  private api   = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  cards          = signal<any[]>([]);
  selectedCardId = signal('');
  invoices       = signal<any[]>([]);
  transactions   = signal<any[]>([]);
  loadingTxns    = signal(false);
  payingInvoice  = signal(false);

  // Unpaid expense transactions that compose the current invoice
  unpaidTxns = computed(() => this.transactions().filter(t => t.type === 'expense' && !t.paid));
  hasUnpaid  = computed(() => this.unpaidTxns().length > 0);
  isPaid     = computed(() => this.currentTotal() > 0 && !this.hasUnpaid());

  // current month index within invoices array
  monthIdx = signal(0);

  selectedCard = computed(() => this.cards().find(c => c.id === this.selectedCardId()) ?? null);

  currentMonth = computed(() => {
    const list = this.invoices();
    return list[this.monthIdx()] ?? null;
  });

  currentTotal = computed(() => Math.abs(this.currentMonth()?.total ?? 0));
  prevTotal    = computed(() => {
    const list = this.invoices();
    const next = list[this.monthIdx() + 1];
    return next ? Math.abs(next.total) : 0;
  });

  monthLabel = computed(() => {
    const m = this.currentMonth();
    if (!m) return '';
    const [year, month] = m.month.split('-');
    return `${PT_MONTHS[parseInt(month) - 1]} ${year}`;
  });

  monthStart = computed(() => {
    const m = this.currentMonth();
    return m ? `${m.month}-01` : '';
  });

  monthEnd = computed(() => {
    const m = this.currentMonth();
    if (!m) return '';
    const [year, month] = m.month.split('-').map(Number);
    const last = new Date(year, month, 0).getDate();
    return `${m.month}-${String(last).padStart(2,'0')}`;
  });

  isCurrentMonth = computed(() => {
    const m = this.currentMonth();
    if (!m) return false;
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return m.month === cur;
  });

  dueLabel = computed(() => {
    const card = this.selectedCard();
    const m    = this.currentMonth();
    if (!card || !m) return '--';
    const [year, month] = m.month.split('-').map(Number);
    // due is in the month AFTER closing
    const dueMonth = month === 12 ? 1 : month + 1;
    const dueYear  = month === 12 ? year + 1 : year;
    const day = card.due_day || '--';
    return `${String(day).padStart(2,'0')}/${String(dueMonth).padStart(2,'0')}/${String(dueYear).slice(-2)}`;
  });

  canGoNext = computed(() => this.monthIdx() < this.invoices().length - 1);

  ngOnInit() {
    this.api.get<any>('/credit-cards').subscribe(r => {
      const raw: any[] = r.data ?? [];
      this.cards.set(raw.map(c => this.mapCard(c)));
    });

    this.route.queryParams.subscribe(p => {
      if (p['card_id']) {
        this.selectCard(p['card_id'], p['month']);
      }
    });
  }

  selectCard(id: string, month?: string) {
    this.selectedCardId.set(id);
    this.invoices.set([]);
    this.monthIdx.set(0);
    this.transactions.set([]);

    this.api.get<any>(`/reports/cards/${id}/invoices`).subscribe(r => {
      const raw: any[] = r.data ?? [];
      const list = raw.map(inv => ({
        month: inv.month,
        total: inv.expense ?? inv.total ?? 0,
        count: Math.round(inv.net ?? inv.count ?? 0),
      }));

      // Ensure current month always exists at index 0
      const now = new Date();
      const curMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      if (!list.find(i => i.month === curMonth)) {
        list.unshift({ month: curMonth, total: 0, count: 0 });
      }
      list.sort((a, b) => b.month.localeCompare(a.month));
      this.invoices.set(list);

      // Navigate to the requested month if provided
      if (month) {
        const idx = list.findIndex(i => i.month === month);
        this.monthIdx.set(idx >= 0 ? idx : 0);
      }
      this.loadTransactions();
    });
  }

  prevMonth() {
    if (this.monthIdx() < this.invoices().length - 1) {
      this.monthIdx.update(i => i + 1);
      this.loadTransactions();
    }
  }

  payInvoice() {
    const unpaid = this.unpaidTxns();
    if (!unpaid.length || this.payingInvoice()) return;
    this.payingInvoice.set(true);
    forkJoin(
      unpaid.map(t =>
        this.api.patch<any>(`/transactions/${t.id}/pay`, {}).pipe(catchError(() => of(null)))
      )
    ).subscribe({
      next: (results: any[]) => {
        const failed = results.filter(r => r === null).length;
        this.payingInvoice.set(false);
        if (failed === 0) {
          this.toast.success('Fatura paga com sucesso!');
        } else {
          this.toast.error(`${failed} lançamento(s) não puderam ser pagos.`);
        }
        this.loadTransactions();
      },
      error: () => {
        this.payingInvoice.set(false);
        this.toast.error('Erro ao pagar a fatura.');
      },
    });
  }

  nextMonth() {
    if (this.canGoNext()) {
      this.monthIdx.update(i => i - 1);
      this.loadTransactions();
    }
  }

  loadTransactions() {
    const start = this.monthStart();
    const end   = this.monthEnd();
    const id    = this.selectedCardId();
    if (!start || !id) return;

    this.loadingTxns.set(true);
    this.transactions.set([]);

    this.api.get<any>(`/transactions?credit_card_id=${id}&date_from=${start}&date_to=${end}&limit=50`).subscribe({
      next: (r: any) => {
        this.transactions.set(r.data ?? []);
        this.loadingTxns.set(false);
      },
      error: () => this.loadingTxns.set(false),
    });
  }

  private mapCard(c: any) {
    const rawIcon = c.icon || '';
    const isAsset = rawIcon.endsWith('.svg');
    // Try to match SI slug from old DB values or direct asset name
    const asset   = isAsset ? rawIcon : (CARD_ICON_MAP[rawIcon] ?? this.inferAsset(c.name));
    const siSlug  = (!asset && rawIcon && !isAsset) ? rawIcon : (!asset ? this.inferSiSlug(c.name) : '');
    const hasBg   = asset ? (ASSET_HAS_BG[asset] ?? false) : false;
    return { ...c, asset, siSlug, hasBg };
  }

  private inferAsset(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('nubank'))    return 'nubank.svg';
    if (n.includes('inter'))     return 'inter.svg';
    if (n.includes('itaú') || n.includes('itau')) return 'itau.svg';
    if (n.includes('bradesco'))  return 'bradesco.svg';
    if (n.includes('santander')) return 'santander.svg';
    if (n.includes('caixa'))     return 'caixa.svg';
    if (n.includes('brasil'))    return 'bb.svg';
    if (n.includes('c6'))        return 'c6bank.svg';
    if (n.includes('btg'))       return 'btg.svg';
    if (n.includes('mercado pago') || n.includes('mercadopago')) return 'mercadopago.svg';
    if (n.includes('picpay'))    return 'picpay.svg';
    if (n.includes('sicoob'))    return 'sicoob.svg';
    if (n.includes('sicredi'))   return 'sicredi.svg';
    if (n.includes('neon'))      return 'neon.svg';
    if (n.includes('stone'))     return 'stone.svg';
    if (n.includes('xp'))        return 'xp.svg';
    return '';
  }

  private inferSiSlug(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('mercado livre')) return 'mercadolibre';
    if (n.includes('visa'))          return 'visa';
    if (n.includes('mastercard'))    return 'mastercard';
    if (n.includes('amex') || n.includes('american express')) return 'americanexpress';
    return '';
  }
}
