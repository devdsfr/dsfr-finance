import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

interface Snapshot {
  id?: string;
  month: string;
  wallet_name: string;
  total: number;
  invested: number;
  profit: number;
  capital_gains: number;
  dividends: number;
  income_12m: number;
  variation_pct: number;
  variation_val: number;
  rentability: number;
  notes: string;
}

const EMPTY = (wallet = 'Principal'): Snapshot => ({
  month: new Date().toISOString().slice(0, 7),
  wallet_name: wallet,
  total: 0, invested: 0, profit: 0,
  capital_gains: 0, dividends: 0, income_12m: 0,
  variation_pct: 0, variation_val: 0, rentability: 0, notes: ''
});

@Component({
  selector: 'app-patrimony-evolution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1>Evolução de Patrimônio</h1>
      <p class="subtitle">Acompanhe seus investimentos mês a mês</p>
    </div>
    <button class="btn btn--primary" (click)="openForm()">+ Registrar mês</button>
  </div>

  <!-- ── Wallet tabs ── -->
  @if (wallets().length > 0) {
    <div class="wallet-tabs">
      <button class="wallet-tab" [class.active]="activeWallet() === '__all__'" (click)="activeWallet.set('__all__')">
        Todas as carteiras
      </button>
      @for (w of wallets(); track w) {
        <button class="wallet-tab" [class.active]="activeWallet() === w" (click)="activeWallet.set(w)">
          {{ w }}
        </button>
      }
    </div>
  }

  <!-- ── Summary cards (latest snapshot) ── -->
  @if (latest()) {
    <div class="cards-grid">
      <div class="card card--main">
        <span class="card-label">Patrimônio total</span>
        <span class="card-value">{{ latest()!.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
        @if (growth() !== null) {
          <span class="card-badge" [class.card-badge--pos]="growth()! >= 0" [class.card-badge--neg]="growth()! < 0">
            {{ growth()! >= 0 ? '▲' : '▼' }} {{ growth()! | number:'1.2-2' }}%
          </span>
        }
      </div>
      <div class="card">
        <span class="card-label">Valor investido</span>
        <span class="card-value card-value--sm">{{ latest()!.invested | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
      </div>
      <div class="card">
        <span class="card-label">Lucro total</span>
        <span class="card-value card-value--sm card-value--green">{{ latest()!.profit | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
      </div>
      <div class="card">
        <span class="card-label">Ganho de Capital</span>
        <span class="card-value card-value--sm">{{ latest()!.capital_gains | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
      </div>
      <div class="card">
        <span class="card-label">Dividendos Recebidos</span>
        <span class="card-value card-value--sm card-value--green">{{ latest()!.dividends | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
      </div>
      <div class="card">
        <span class="card-label">Proventos 12M</span>
        <span class="card-value card-value--sm">{{ latest()!.income_12m | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
      </div>
      <div class="card">
        <span class="card-label">Variação mensal</span>
        <span class="card-value card-value--sm" [class.card-value--green]="latest()!.variation_pct >= 0"
              [class.card-value--red]="latest()!.variation_pct < 0">
          {{ latest()!.variation_pct >= 0 ? '+' : '' }}{{ latest()!.variation_pct | number:'1.2-2' }}%
        </span>
        <span class="card-sub">{{ latest()!.variation_val | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
      </div>
      <div class="card">
        <span class="card-label">Rentabilidade total</span>
        <span class="card-value card-value--sm card-value--green">{{ latest()!.rentability | number:'1.2-2' }}%</span>
      </div>
    </div>
  }

  <!-- ── Chart ── -->
  @if (chartData().length >= 2) {
    <div class="chart-card">
      <div class="chart-header">
        <span class="chart-title">Evolução do Patrimônio</span>
        <div class="chart-legend">
          <span class="legend-dot legend-dot--total"></span> Total
          <span class="legend-dot legend-dot--invested"></span> Investido
          <span class="legend-dot legend-dot--profit"></span> Lucro
        </div>
      </div>
      <svg [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" class="chart-svg">
        <!-- Grid lines -->
        @for (y of gridYs(); track y.val) {
          <line [attr.x1]="PAD_L" [attr.x2]="svgW - PAD_R" [attr.y1]="y.py" [attr.y2]="y.py"
                stroke="#f3f4f6" stroke-width="1"/>
          <text [attr.x]="PAD_L - 6" [attr.y]="y.py + 4" text-anchor="end"
                font-size="10" fill="#9ca3af">{{ y.label }}</text>
        }
        <!-- X axis labels -->
        @for (s of chartData(); track s.month; let i = $index) {
          <text [attr.x]="xPos(i)" [attr.y]="svgH - PAD_B + 14"
                text-anchor="middle" font-size="10" fill="#9ca3af">{{ fmtMonth(s.month) }}</text>
        }
        <!-- Area fill total -->
        <defs>
          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2e7736" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#2e7736" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon [attr.points]="areaPoints()" fill="url(#gradTotal)"/>
        <!-- Lines -->
        <polyline [attr.points]="linePoints('invested')" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linejoin="round"/>
        <polyline [attr.points]="linePoints('profit')"   fill="none" stroke="#86efac" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="4 3"/>
        <polyline [attr.points]="linePoints('total')"    fill="none" stroke="#2e7736" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- Dots total -->
        @for (s of chartData(); track s.month; let i = $index) {
          <circle [attr.cx]="xPos(i)" [attr.cy]="yPos(s.total)" r="4"
                  fill="#fff" stroke="#2e7736" stroke-width="2"/>
        }
      </svg>
    </div>
  } @else if (chartData().length === 1) {
    <div class="chart-card chart-card--empty">
      <p>Adicione pelo menos 2 meses para ver o gráfico de evolução 📈</p>
    </div>
  }

  <!-- ── Form modal ── -->
  @if (showForm()) {
    <div class="modal-overlay" (click)="closeForm()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Registrar mês</h2>
          <button class="modal-close" (click)="closeForm()">✕</button>
        </div>

        <!-- Paste mode -->
        <div class="paste-section">
          <label class="paste-label">Cole os dados do app (modo rápido)</label>
          <textarea class="paste-area" [(ngModel)]="pasteText" name="pasteText"
                    placeholder="Cole aqui o texto copiado do app de investimentos...
Ex:
Patrimônio total R$ 10.868,72
Valor investido R$ 10.657,62
Lucro total R$ 673,55
Ganho de Capital R$ 211,09
Dividendos Recebidos R$ 462,46
Proventos Recebidos (12M) R$ 280,96"></textarea>
          <button class="btn btn--outline btn--sm" type="button" (click)="parsePaste()" [disabled]="!pasteText.trim()">
            ⚡ Preencher automaticamente
          </button>
        </div>

        <div class="divider"><span>ou preencha manualmente</span></div>

        <form (ngSubmit)="save()" class="modal-form">
          <div class="form-row">
            <div class="fg">
              <label>Nome da carteira</label>
              <input type="text" [(ngModel)]="form.wallet_name" name="wallet_name" class="input"
                     placeholder="Ex: Daniel, Filho Pedro, Principal..." list="wallet-list" />
              <datalist id="wallet-list">
                @for (w of wallets(); track w) { <option [value]="w">{{ w }}</option> }
              </datalist>
            </div>
            <div class="fg">
              <label>Mês de referência</label>
              <input type="month" [(ngModel)]="form.month" name="month" class="input" required />
            </div>
          </div>
          <div class="form-row">
            <div class="fg">
              <label>Patrimônio total</label>
              <input type="number" step="0.01" [(ngModel)]="form.total" name="total" class="input" />
            </div>
            <div class="fg">
              <label>Valor investido</label>
              <input type="number" step="0.01" [(ngModel)]="form.invested" name="invested" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="fg">
              <label>Lucro total</label>
              <input type="number" step="0.01" [(ngModel)]="form.profit" name="profit" class="input" />
            </div>
            <div class="fg">
              <label>Ganho de Capital</label>
              <input type="number" step="0.01" [(ngModel)]="form.capital_gains" name="capital_gains" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="fg">
              <label>Dividendos Recebidos</label>
              <input type="number" step="0.01" [(ngModel)]="form.dividends" name="dividends" class="input" />
            </div>
            <div class="fg">
              <label>Proventos 12M</label>
              <input type="number" step="0.01" [(ngModel)]="form.income_12m" name="income_12m" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="fg">
              <label>Variação % mensal</label>
              <input type="number" step="0.01" [(ngModel)]="form.variation_pct" name="variation_pct" class="input" placeholder="1.98" />
            </div>
            <div class="fg">
              <label>Variação R$ mensal</label>
              <input type="number" step="0.01" [(ngModel)]="form.variation_val" name="variation_val" class="input" />
            </div>
            <div class="fg">
              <label>Rentabilidade %</label>
              <input type="number" step="0.01" [(ngModel)]="form.rentability" name="rentability" class="input" placeholder="10.93" />
            </div>
          </div>
          <div class="fg">
            <label>Observações</label>
            <input type="text" [(ngModel)]="form.notes" name="notes" class="input"
                   placeholder="Ex: Aporte extra de R$500, ativo X vendido..." />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn--ghost" (click)="closeForm()">Cancelar</button>
            <button type="submit" class="btn btn--primary" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  }

  <!-- ── History table ── -->
  @if (filtered().length > 0) {
    <div class="history-card">
      <h3>Histórico</h3>
      <table class="hist-table">
        <thead>
          <tr>
            <th>Mês</th>
            @if (activeWallet() === '__all__') { <th>Carteira</th> }
            <th>Patrimônio</th>
            <th>Investido</th>
            <th>Lucro</th>
            <th>Dividendos</th>
            <th>Var. %</th>
            <th>Var. R$</th>
            <th>Rentab.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (s of filteredDesc(); track s.month + s.wallet_name; let i = $index) {
            <tr>
              <td class="td-month">{{ fmtMonthLong(s.month) }}</td>
              @if (activeWallet() === '__all__') {
                <td><span class="wallet-badge">{{ s.wallet_name }}</span></td>
              }
              <td>{{ s.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              <td>{{ s.invested | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              <td class="td-green">{{ s.profit | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              <td class="td-green">{{ s.dividends | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              <td>
                <span [class.pos]="s.variation_pct >= 0" [class.neg]="s.variation_pct < 0">
                  {{ s.variation_pct >= 0 ? '+' : '' }}{{ s.variation_pct | number:'1.2-2' }}%
                </span>
              </td>
              <td [class.pos]="s.variation_val >= 0" [class.neg]="s.variation_val < 0">
                {{ s.variation_val | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
              </td>
              <td class="td-green">{{ s.rentability | number:'1.2-2' }}%</td>
              <td>
                <button class="edit-btn" title="Editar" (click)="editSnap(s)">✏️</button>
                <button class="del-btn" title="Excluir" (click)="deleteSnap(s.month, s.wallet_name)">🗑</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  } @else if (!loading()) {
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>Nenhum registro ainda.<br>Clique em <strong>+ Registrar mês</strong> para começar.</p>
    </div>
  }

  <!-- ── Delete confirmation modal ── -->
  @if (confirmDelete()) {
    <div class="modal-overlay" (click)="confirmDelete.set(null)">
      <div class="confirm-modal" (click)="$event.stopPropagation()">
        <div class="confirm-icon">🗑️</div>
        <h3 class="confirm-title">Excluir registro</h3>
        <p class="confirm-msg">
          Tem certeza que deseja excluir o registro de
          <strong>{{ fmtMonthLong(confirmDelete()!.month) }}</strong>
          da carteira <strong>{{ confirmDelete()!.wallet }}</strong>?
        </p>
        <p class="confirm-sub">Essa ação não pode ser desfeita.</p>
        <div class="confirm-actions">
          <button class="btn btn--ghost" (click)="confirmDelete.set(null)">Cancelar</button>
          <button class="btn btn--danger" (click)="confirmDeleteSnap()">Excluir</button>
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: [`
    .page { max-width: 960px; margin: 0 auto; padding-bottom: 3rem; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
    h1 { font-size: 1.6rem; font-weight: 800; color: #111; margin: 0 0 .2rem; }
    .subtitle { color: #6b7280; font-size: .875rem; margin: 0; }
    .btn { padding: .5rem 1.1rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .875rem; font-weight: 600; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--ghost { background: none; color: #374151; border: 1px solid #d1d5db; }
    .btn--outline { background: #fff; color: #2e7736; border: 1.5px solid #2e7736; }
    .btn--danger { background: #ef4444; color: #fff; }
    .btn--danger:hover { background: #dc2626; }
    .btn--sm { padding: .3rem .75rem; font-size: .8rem; }

    /* Wallet tabs */
    .wallet-tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .wallet-tab {
      padding: .35rem .9rem; border-radius: 999px; font-size: .82rem; font-weight: 600;
      border: 1.5px solid #d1d5db; background: #fff; color: #374151; cursor: pointer;
      transition: all .12s;
    }
    .wallet-tab:hover { border-color: #2e7736; color: #2e7736; }
    .wallet-tab.active { background: #2e7736; color: #fff; border-color: #2e7736; }
    .wallet-badge {
      display: inline-block; padding: .15rem .5rem; border-radius: 999px;
      background: #f0fdf4; color: #166534; font-size: .72rem; font-weight: 600;
      border: 1px solid #bbf7d0;
    }

    /* Cards */
    .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .875rem; margin-bottom: 1.25rem; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: .35rem; }
    .card--main { grid-column: span 3; flex-direction: row; align-items: center; gap: 1rem; background: linear-gradient(135deg,#2e7736,#1a4d22); border: none; }
    .card-label { font-size: .75rem; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .card--main .card-label { color: rgba(255,255,255,.75); }
    .card-value { font-size: 1.25rem; font-weight: 800; color: #111; }
    .card--main .card-value { font-size: 1.75rem; color: #fff; }
    .card-value--sm { font-size: 1.05rem; }
    .card-value--green { color: #16a34a; }
    .card-value--red   { color: #ef4444; }
    .card-sub { font-size: .8rem; color: #6b7280; }
    .card-badge { padding: .2rem .6rem; border-radius: 999px; font-size: .78rem; font-weight: 700; margin-left: auto; }
    .card-badge--pos { background: rgba(255,255,255,.2); color: #bbf7d0; }
    .card-badge--neg { background: rgba(239,68,68,.2); color: #fca5a5; }

    /* Chart */
    .chart-card { background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; padding: 1.25rem; margin-bottom: 1.25rem; }
    .chart-card--empty { text-align: center; color: #9ca3af; padding: 2rem; }
    .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .chart-title { font-size: .95rem; font-weight: 700; color: #111; }
    .chart-legend { display: flex; gap: .75rem; font-size: .78rem; color: #6b7280; align-items: center; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 3px; }
    .legend-dot--total { background: #2e7736; }
    .legend-dot--invested { background: #93c5fd; }
    .legend-dot--profit { background: #86efac; }
    .chart-svg { width: 100%; height: auto; display: block; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .modal { background: #fff; border-radius: .75rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
    .modal-header h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
    .modal-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #6b7280; }
    .paste-section { padding: 1rem 1.5rem; background: #f9fafb; }
    .paste-label { display: block; font-size: .8rem; font-weight: 600; color: #374151; margin-bottom: .4rem; }
    .paste-area { width: 100%; min-height: 110px; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .8rem; padding: .5rem; resize: vertical; box-sizing: border-box; font-family: monospace; }
    .divider { text-align: center; position: relative; margin: .75rem 1.5rem; }
    .divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e5e7eb; }
    .divider span { position: relative; background: #fff; padding: 0 .75rem; font-size: .78rem; color: #9ca3af; }
    .modal-form { padding: .75rem 1.5rem 1.5rem; display: flex; flex-direction: column; gap: .75rem; }
    .form-row { display: flex; gap: .75rem; }
    .fg { display: flex; flex-direction: column; gap: .2rem; flex: 1; }
    .fg label { font-size: .8rem; font-weight: 600; color: #374151; }
    .input { padding: .45rem .65rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; width: 100%; box-sizing: border-box; }
    .modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .25rem; }

    /* History */
    .history-card { background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; padding: 1.25rem; }
    .history-card h3 { font-size: .95rem; font-weight: 700; margin: 0 0 1rem; }
    .hist-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .hist-table th { text-align: left; font-size: .72rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; padding: .4rem .5rem; border-bottom: 1px solid #f3f4f6; }
    .hist-table td { padding: .55rem .5rem; border-bottom: 1px solid #f9fafb; color: #374151; }
    .td-month { font-weight: 600; color: #111; }
    .td-green { color: #16a34a; }
    .pos { color: #16a34a; font-weight: 600; }
    .neg { color: #ef4444; font-weight: 600; }
    .dash { color: #d1d5db; }
    .edit-btn, .del-btn { background: none; border: none; cursor: pointer; font-size: .9rem; padding: .1rem .3rem; opacity: .6; }
    .edit-btn:hover, .del-btn:hover { opacity: 1; }

    .empty-state { text-align: center; padding: 3rem 1rem; color: #9ca3af; }
    .empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .empty-state p { font-size: .9rem; line-height: 1.6; }

    /* Delete confirmation modal */
    .confirm-modal {
      background: #fff; border-radius: .875rem; padding: 2rem 1.75rem;
      width: 100%; max-width: 400px; text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
      animation: pop-in .18s ease;
    }
    @keyframes pop-in {
      from { transform: scale(.92); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
    .confirm-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .confirm-title { font-size: 1.1rem; font-weight: 700; color: #111; margin: 0 0 .5rem; }
    .confirm-msg { font-size: .875rem; color: #374151; line-height: 1.55; margin: 0 0 .35rem; }
    .confirm-sub { font-size: .78rem; color: #9ca3af; margin: 0 0 1.5rem; }
    .confirm-actions { display: flex; gap: .75rem; justify-content: center; }

    @media (max-width: 640px) {
      .cards-grid { grid-template-columns: 1fr 1fr; }
      .card--main { grid-column: span 2; }
      .form-row { flex-direction: column; }
    }
  `]
})
export class PatrimonyEvolutionComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  loading  = signal(true);
  saving   = signal(false);
  showForm = signal(false);
  snapshots = signal<Snapshot[]>([]);
  activeWallet = signal<string>('__all__');
  form: Snapshot = EMPTY();
  pasteText = '';
  // Delete confirmation modal
  confirmDelete = signal<{ month: string; wallet: string } | null>(null);

  // Chart constants
  readonly PAD_L = 58; readonly PAD_R = 16; readonly PAD_T = 16; readonly PAD_B = 28;
  readonly svgW  = 800; readonly svgH  = 220;

  // Derived
  wallets = computed(() => [...new Set(this.snapshots().map(s => s.wallet_name))].sort());

  // All individual rows (for history table)
  filtered = computed(() => {
    const w = this.activeWallet();
    const all = this.snapshots();
    if (w === '__all__') return all;
    return all.filter(s => s.wallet_name === w);
  });

  filteredDesc = computed(() => [...this.filtered()].reverse());

  // Consolidated by month: sums all wallets for each month (used by chart + summary cards)
  chartData = computed((): Snapshot[] => {
    const w = this.activeWallet();
    const all = this.snapshots();
    const src = w === '__all__' ? all : all.filter(s => s.wallet_name === w);

    if (w !== '__all__') return [...src].sort((a, b) => a.month.localeCompare(b.month));

    // Aggregate: one entry per month, sum numeric fields across wallets
    const monthMap = new Map<string, Snapshot>();
    [...src].sort((a, b) => a.month.localeCompare(b.month)).forEach(snap => {
      if (!monthMap.has(snap.month)) {
        monthMap.set(snap.month, { ...snap, wallet_name: '__all__' });
      } else {
        const e = monthMap.get(snap.month)!;
        e.total         += snap.total;
        e.invested      += snap.invested;
        e.profit        += snap.profit;
        e.capital_gains += snap.capital_gains;
        e.dividends     += snap.dividends;
        e.income_12m    += snap.income_12m;
        e.variation_val += snap.variation_val;
        // variation_pct and rentability: weighted average by total
        // (simple average for now)
        e.variation_pct  = (e.variation_pct + snap.variation_pct) / 2;
        e.rentability    = (e.rentability + snap.rentability) / 2;
      }
    });
    return [...monthMap.values()];
  });

  latest = computed(() => {
    const s = this.chartData();
    return s.length ? s[s.length - 1] : null;
  });

  growth = computed(() => {
    const s = this.chartData();
    if (s.length < 2) return null;
    const prev = s[s.length - 2].total;
    const curr = s[s.length - 1].total;
    return prev === 0 ? null : ((curr - prev) / prev) * 100;
  });

  snapshotsDesc = computed(() => [...this.snapshots()].reverse());

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.get<any>('/patrimony-snapshots').subscribe(r => {
      this.snapshots.set(r.data ?? []);
      this.loading.set(false);
    });
  }

  openForm() {
    const w = this.activeWallet() === '__all__' ? 'Principal' : this.activeWallet();
    this.form = EMPTY(w);
    this.pasteText = '';
    this.showForm.set(true);
  }
  closeForm() { this.showForm.set(false); this.pasteText = ''; }

  editSnap(s: Snapshot) {
    this.form = { ...s };
    this.pasteText = '';
    this.showForm.set(true);
  }

  parsePaste() {
    const t = this.pasteText;
    const num = (pattern: RegExp): number => {
      const m = t.match(pattern);
      if (!m) return 0;
      return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    };
    this.form.total         = num(/[Pp]atrimônio total\s*R\$\s*([\d.,]+)/);
    this.form.invested      = num(/[Vv]alor investido\s*R\$\s*([\d.,]+)/);
    this.form.profit        = num(/[Ll]ucro total\s*R\$\s*([\d.,]+)/);
    this.form.capital_gains = num(/[Gg]anho de [Cc]apital\s*R\$\s*([\d.,]+)/);
    this.form.dividends     = num(/[Dd]ividendos [Rr]ecebidos\s*R\$\s*([\d.,]+)/);
    this.form.income_12m    = num(/[Pp]roventos [Rr]ecebidos.*?R\$\s*([\d.,]+)/);
    // Variação e rentabilidade — percentual puro (sem R$)
    const pctMatch = (pat: RegExp): number => {
      const m = t.match(pat);
      if (!m) return 0;
      return parseFloat(m[1].replace(',', '.'));
    };
    this.form.variation_pct = pctMatch(/[Vv]aria[çc][aã]o[\s\S]*?([\d]+[.,][\d]+)\s*%/);
    this.form.variation_val = num(/[Vv]aria[çc][aã]o[\s\S]*?%[\s\S]*?R\$\s*([\d.,]+)/);
    this.form.rentability   = pctMatch(/[Rr]entabilidade[\s\S]*?([\d]+[.,][\d]+)\s*%/);
    this.toast.success('Dados preenchidos! Confirme o mês e salve.');
  }

  save() {
    this.saving.set(true);
    const req = this.form.id
      ? this.api.put<any>(`/patrimony-snapshots/${this.form.id}`, this.form)
      : this.api.post<any>('/patrimony-snapshots', this.form);
    req.subscribe({
      next: () => {
        this.toast.success(this.form.id ? 'Atualizado!' : 'Registro salvo!');
        this.load();
        this.closeForm();
        this.saving.set(false);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar');
        this.saving.set(false);
      }
    });
  }

  deleteSnap(month: string, wallet: string) {
    this.confirmDelete.set({ month, wallet });
  }

  confirmDeleteSnap() {
    const d = this.confirmDelete();
    if (!d) return;
    this.api.delete<any>(`/patrimony-snapshots/${d.month}?wallet=${encodeURIComponent(d.wallet)}`).subscribe(() => {
      this.toast.success('Registro removido.');
      this.confirmDelete.set(null);
      this.load();
    });
  }

  // ── Chart helpers ──────────────────────────────────────────────────────────
  private chartBounds() {
    const s = this.chartData();
    const vals = s.map(x => x.total);
    const min = Math.min(...vals) * 0.97;
    const max = Math.max(...vals) * 1.03;
    return { min, max };
  }

  xPos(i: number): number {
    const n = this.chartData().length;
    const w = this.svgW - this.PAD_L - this.PAD_R;
    return this.PAD_L + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  }

  yPos(val: number): number {
    const { min, max } = this.chartBounds();
    const h = this.svgH - this.PAD_T - this.PAD_B;
    return this.PAD_T + h - ((val - min) / (max - min || 1)) * h;
  }

  linePoints(key: keyof Snapshot): string {
    return this.chartData()
      .map((s, i) => `${this.xPos(i)},${this.yPos(s[key] as number)}`)
      .join(' ');
  }

  areaPoints(): string {
    const pts = this.chartData().map((s, i) => `${this.xPos(i)},${this.yPos(s.total)}`).join(' ');
    const n = this.chartData().length;
    const base = this.svgH - this.PAD_B;
    return `${this.PAD_L},${base} ${pts} ${this.xPos(n - 1)},${base}`;
  }

  gridYs() {
    const { min, max } = this.chartBounds();
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = min + (max - min) * (i / steps);
      return {
        val,
        py: this.yPos(val),
        label: val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)
      };
    });
  }

  monthGrowth(i: number): number | null {
    const s = this.snapshotsDesc();
    if (i >= s.length - 1) return null;
    const prev = s[i + 1].total;
    return prev === 0 ? null : ((s[i].total - prev) / prev) * 100;
  }

  fmtMonth(m: string): string {
    const [y, mo] = m.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[+mo - 1]}/${y.slice(2)}`;
  }

  fmtMonthLong(m: string): string {
    const [y, mo] = m.split('-');
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${months[+mo - 1]} ${y}`;
  }
}
