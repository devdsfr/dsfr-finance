import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { DismissOnBackdropDirective } from '../../shared/directives/dismiss-on-backdrop.directive';
import { BlankZeroDirective } from '../../shared/directives/blank-zero.directive';
import { catchError, of } from 'rxjs';

interface Asset {
  id: string;
  name: string;
  type: string;
  wallet_name: string;
  purchase_value: number;
  market_value: number;
  purchase_date?: string;
  city?: string;
  state?: string;
  address?: string;
  area?: number;
  area_unit: string;
  is_financed: boolean;
  down_payment: number;
  installment_count: number;
  installment_value: number;
  first_due_date?: string;
  seller?: string;
  notes: string;
  paid_count: number;
  paid_value: number;
  remaining_value: number;
  progress_pct: number;
  next_due_date?: string;
  appreciation: number;
  appreciation_pct: number;
  // Consórcio
  credit_letter_value: number;
  is_awarded: boolean;
  awarded_date?: string;
}

const TYPES = [
  { v: 'lote',        label: 'Lote',        icon: '📐' },
  { v: 'terreno',     label: 'Terreno',     icon: '🏞️' },
  { v: 'casa',        label: 'Casa',        icon: '🏠' },
  { v: 'apartamento', label: 'Apartamento', icon: '🏢' },
  { v: 'sitio',       label: 'Sítio/Chácara', icon: '🌳' },
  { v: 'veiculo',     label: 'Veículo',     icon: '🚗' },
  { v: 'consorcio',   label: 'Consórcio',   icon: '🎟️' },
  { v: 'outro',       label: 'Outro',       icon: '📦' },
];

/** Campos numéricos começam nulos para o input aparecer vazio, não com "0". */
const emptyForm = () => ({
  name: '', type: 'lote', wallet_name: 'Principal',
  purchase_value: null as number | null,
  market_value: null as number | null,
  purchase_date: new Date().toISOString().slice(0, 10),
  city: '', state: '', address: '',
  area: null as number | null, area_unit: 'm2',
  is_financed: false,
  down_payment: null as number | null,
  installment_count: null as number | null,
  installment_value: null as number | null,
  first_due_date: '', seller: '', notes: '', generate_installments: true,
  // Consórcio
  credit_letter_value: null as number | null,
  is_awarded: false,
  awarded_date: '',
});

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe, DismissOnBackdropDirective, BlankZeroDirective],
  template: `
<div class="assets">

  <!-- Resumo -->
  @if (list().length > 0) {
    <div class="kpis">
      <div class="kpi">
        <span class="kpi__lbl">Propriedades</span>
        <span class="kpi__val">{{ list().length }}</span>
      </div>
      <div class="kpi">
        <span class="kpi__lbl">Valor de mercado</span>
        <span class="kpi__val">{{ totalMarket() | appCurrency }}</span>
      </div>
      <div class="kpi">
        <span class="kpi__lbl">Valorização</span>
        <span class="kpi__val" [class.pos]="totalAppreciation() > 0" [class.neg]="totalAppreciation() < 0">
          {{ totalAppreciation() | appCurrency }}
        </span>
      </div>
      <div class="kpi">
        <span class="kpi__lbl">Falta pagar</span>
        <span class="kpi__val neg">{{ totalRemaining() | appCurrency }}</span>
      </div>
    </div>
  }

  <div class="bar">
    <span class="bar__title">Meus bens e propriedades</span>
    <button class="btn btn--primary" (click)="openForm()">+ Adicionar propriedade</button>
  </div>

  @if (loading()) {
    <p class="muted">Carregando…</p>
  } @else if (list().length === 0) {
    <div class="empty">
      <span class="empty__icon">🏞️</span>
      <p>Nenhuma propriedade cadastrada.</p>
      <p class="muted">Cadastre lotes, terrenos e imóveis para acompanhar valorização e parcelamento.</p>
    </div>
  }

  <div class="grid">
    @for (a of list(); track a.id) {
      <div class="card">
        <div class="card__head">
          <span class="card__icon">{{ iconFor(a.type) }}</span>
          <div class="card__id">
            <span class="card__name">{{ a.name }}</span>
            <span class="card__meta">
              {{ labelFor(a.type) }}
              @if (a.city) { · {{ a.city }}@if (a.state) {/{{ a.state }}} }
              @if (a.area) { · {{ a.area }} {{ a.area_unit === 'm2' ? 'm²' : a.area_unit }} }
            </span>
          </div>
          <button class="icon-btn" title="Excluir" (click)="confirmDelete.set(a)">🗑</button>
        </div>

        @if (a.type === 'consorcio') {
          <div class="values">
            <div class="val">
              <span class="val__lbl">Carta de crédito</span>
              <span class="val__num">{{ a.credit_letter_value | appCurrency }}</span>
            </div>
            <div class="val">
              <span class="val__lbl">Já paguei</span>
              <span class="val__num">{{ a.paid_value | appCurrency }}</span>
            </div>
            <div class="val">
              <span class="val__lbl">Situação</span>
              <span class="val__num" [class.pos]="a.is_awarded">
                {{ a.is_awarded ? '🎉 Contemplado' : 'Aguardando' }}
              </span>
            </div>
          </div>
        } @else {
          <div class="values">
            <div class="val">
              <span class="val__lbl">Comprei por</span>
              <span class="val__num">{{ a.purchase_value | appCurrency }}</span>
            </div>
            <div class="val">
              <span class="val__lbl">Vale hoje</span>
              <span class="val__num">{{ a.market_value | appCurrency }}</span>
            </div>
            <div class="val">
              <span class="val__lbl">Valorização</span>
              <span class="val__num" [class.pos]="a.appreciation > 0" [class.neg]="a.appreciation < 0">
                {{ a.appreciation | appCurrency }}
                @if (a.purchase_value > 0) {
                  <small>({{ a.appreciation_pct * 100 | number:'1.0-1' }}%)</small>
                }
              </span>
            </div>
          </div>
        }

        @if (a.is_financed && a.installment_count > 0) {
          <div class="progress">
            <div class="progress__head">
              <span>
                {{ a.type === 'consorcio' ? 'Consórcio' : 'Parcelamento' }}:
                {{ a.paid_count }}/{{ a.installment_count }} pagas
              </span>
              <span>{{ a.progress_pct * 100 | number:'1.0-0' }}%</span>
            </div>
            <div class="progress__track">
              <div class="progress__fill" [style.width.%]="a.progress_pct * 100"></div>
            </div>
            <div class="progress__foot">
              <span>Falta {{ a.remaining_value | appCurrency }}</span>
              @if (a.next_due_date) {
                <span>Próxima: {{ a.next_due_date | date:'dd/MM/yyyy':'UTC' }}</span>
              } @else {
                <span class="pos">Quitado 🎉</span>
              }
            </div>
          </div>
        }

        <div class="card__actions">
          @if (a.type !== 'consorcio') {
            <button class="link-btn" (click)="openValuation(a)">Atualizar valor</button>
          }
          @if (a.is_financed) {
            <button class="link-btn" (click)="toggleInstallments(a)">
              {{ openInstallments() === a.id ? 'Ocultar parcelas' : 'Ver parcelas' }}
            </button>
          }
        </div>

        @if (openInstallments() === a.id) {
          <div class="inst">
            @for (p of installments(); track p.id) {
              <div class="inst__row" [class.inst__row--paid]="p.paid">
                <span>{{ p.number }}/{{ p.total }}</span>
                <span>{{ p.date | date:'dd/MM/yyyy':'UTC' }}</span>
                <span>{{ p.amount | appCurrency }}</span>
                <span class="inst__status">{{ p.paid ? '✅ paga' : 'em aberto' }}</span>
              </div>
            }
            @if (installments().length === 0) { <p class="muted">Nenhuma parcela gerada.</p> }
          </div>
        }
      </div>
    }
  </div>
</div>

<!-- ── Formulário ── -->
@if (formOpen()) {
  <div class="overlay" appDismissOnBackdrop (backdropDismiss)="formOpen.set(false)">
    <div class="modal">
      <h2>Nova propriedade</h2>

      <div class="row">
        <div class="fg fg--grow">
          <label>Nome *</label>
          <input class="input" [(ngModel)]="form.name" placeholder="Ex: Lote 14 — Residencial Aroeira" />
        </div>
        <div class="fg">
          <label>Tipo</label>
          <select class="input" [(ngModel)]="form.type">
            @for (t of types; track t.v) { <option [value]="t.v">{{ t.icon }} {{ t.label }}</option> }
          </select>
        </div>
      </div>

      @if (isConsorcio()) {
        <p class="hint hint--box">
          🎟️ No consórcio você ainda não tem o bem — tem um direito. Enquanto não for
          contemplado, o patrimônio mostra o quanto você já pagou, que é o que voltaria
          se desistisse. Ao marcar como contemplado, passa a valer a carta de crédito.
        </p>
        <div class="row">
          <div class="fg">
            <label>Valor da carta de crédito (R$)</label>
            <input class="input" type="number" appBlankZero placeholder="0,00" [(ngModel)]="form.credit_letter_value" />
          </div>
          <div class="fg">
            <label>Data da adesão</label>
            <input class="input" type="date" [(ngModel)]="form.purchase_date" />
          </div>
        </div>
      } @else {
        <div class="row">
          <div class="fg">
            <label>Valor de compra (R$)</label>
            <input class="input" type="number" appBlankZero placeholder="0,00" [(ngModel)]="form.purchase_value" />
          </div>
          <div class="fg">
            <label>Valor de mercado hoje (R$)</label>
            <input class="input" type="number" appBlankZero [(ngModel)]="form.market_value"
                   placeholder="igual ao de compra" />
          </div>
          <div class="fg">
            <label>Data da compra</label>
            <input class="input" type="date" [(ngModel)]="form.purchase_date" />
          </div>
        </div>
      }

      @if (!isConsorcio()) {
        <div class="row">
          <div class="fg"><label>Cidade</label><input class="input" [(ngModel)]="form.city" /></div>
          <div class="fg fg--sm"><label>UF</label><input class="input" maxlength="2" [(ngModel)]="form.state" /></div>
          <div class="fg"><label>Área</label><input class="input" type="number" appBlankZero placeholder="0" [(ngModel)]="form.area" /></div>
          <div class="fg fg--sm">
            <label>Unidade</label>
            <select class="input" [(ngModel)]="form.area_unit">
              <option value="m2">m²</option>
              <option value="hectare">hectare</option>
              <option value="alqueire">alqueire</option>
            </select>
          </div>
        </div>

        <div class="fg">
          <label>Endereço / referência</label>
          <input class="input" [(ngModel)]="form.address" placeholder="Quadra, rua, ponto de referência…" />
        </div>

        <!-- Parcelamento -->
        <label class="check">
          <input type="checkbox" [(ngModel)]="form.is_financed" />
          <span>Comprei parcelado</span>
        </label>
      }

      @if (form.is_financed || isConsorcio()) {
        <div class="row">
          @if (!isConsorcio()) {
            <div class="fg"><label>Entrada (R$)</label><input class="input" type="number" appBlankZero placeholder="0,00" [(ngModel)]="form.down_payment" /></div>
          }
          <div class="fg">
            <label>{{ isConsorcio() ? 'Prazo (meses)' : 'Nº de parcelas' }}</label>
            <input class="input" type="number" appBlankZero placeholder="Ex: 48" [(ngModel)]="form.installment_count" />
          </div>
          <div class="fg"><label>Valor da parcela (R$)</label><input class="input" type="number" appBlankZero placeholder="0,00" [(ngModel)]="form.installment_value" /></div>
          <div class="fg">
            <label>{{ isConsorcio() ? '1ª parcela' : '1º vencimento' }}</label>
            <input class="input" type="date" [(ngModel)]="form.first_due_date" />
          </div>
        </div>
        <div class="row">
          <div class="fg fg--grow">
            <label>{{ isConsorcio() ? 'Administradora' : 'Vendedor / loteadora' }}</label>
            <input class="input" [(ngModel)]="form.seller" />
          </div>
        </div>

        @if (isConsorcio()) {
          <label class="check">
            <input type="checkbox" [(ngModel)]="form.is_awarded" />
            <span>Já fui contemplado</span>
          </label>
          @if (form.is_awarded) {
            <div class="row">
              <div class="fg"><label>Data da contemplação</label><input class="input" type="date" [(ngModel)]="form.awarded_date" /></div>
            </div>
          }
        }
        <label class="check">
          <input type="checkbox" [(ngModel)]="form.generate_installments" />
          <span>Gerar as parcelas como contas a pagar</span>
        </label>
        @if (form.generate_installments && form.installment_count > 0) {
          <p class="hint">
            Vou criar {{ form.installment_count }} lançamento(s) de
            {{ form.installment_value | appCurrency }}. Eles aparecem em Compromissos,
            entram na Previsão e pesam no Termômetro.
          </p>
        }
      }

      <div class="foot">
        <button class="btn btn--ghost" (click)="formOpen.set(false)">Cancelar</button>
        <button class="btn btn--primary" [disabled]="!form.name || saving()" (click)="save()">
          {{ saving() ? 'Salvando…' : 'Salvar' }}
        </button>
      </div>
    </div>
  </div>
}

<!-- ── Reavaliação ── -->
@if (valuationFor(); as a) {
  <div class="overlay" appDismissOnBackdrop (backdropDismiss)="valuationFor.set(null)">
    <div class="modal modal--sm">
      <h2>Atualizar valor</h2>
      <p class="hint">{{ a.name }} · comprado por {{ a.purchase_value | appCurrency }}</p>
      <div class="fg"><label>Quanto vale hoje (R$)</label><input class="input" type="number" appBlankZero placeholder="0,00" [(ngModel)]="valuationValue" /></div>
      <div class="fg"><label>Data</label><input class="input" type="date" [(ngModel)]="valuationDate" /></div>
      <div class="fg"><label>Observação</label><input class="input" [(ngModel)]="valuationNote" placeholder="Ex: avaliação da imobiliária" /></div>
      <div class="foot">
        <button class="btn btn--ghost" (click)="valuationFor.set(null)">Cancelar</button>
        <button class="btn btn--primary" (click)="saveValuation()">Salvar</button>
      </div>
    </div>
  </div>
}

<!-- ── Confirmar exclusão ── -->
@if (confirmDelete(); as a) {
  <div class="overlay" appDismissOnBackdrop (backdropDismiss)="confirmDelete.set(null)">
    <div class="modal modal--sm">
      <h2>Excluir propriedade</h2>
      <p class="hint">
        Remover <strong>{{ a.name }}</strong>? As parcelas ainda não pagas serão apagadas.
        As já pagas continuam no histórico, porque representam dinheiro que saiu.
      </p>
      <div class="foot">
        <button class="btn btn--ghost" (click)="confirmDelete.set(null)">Cancelar</button>
        <button class="btn btn--danger" (click)="remove(a)">Excluir</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    .kpis { display: flex; flex-wrap: wrap; gap: 1.75rem; padding: 1rem 1.25rem; background: #fff;
      border-radius: .6rem; box-shadow: 0 1px 4px rgba(0,0,0,.06); margin-bottom: 1.25rem; }
    .kpi { display: flex; flex-direction: column; gap: .1rem; }
    .kpi__lbl { font-size: .7rem; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: .02em; }
    .kpi__val { font-size: 1.15rem; font-weight: 700; color: #111; }
    .pos { color: #16a34a; } .neg { color: #dc2626; }

    .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .bar__title { font-size: .95rem; font-weight: 700; color: #111; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
    .card { background: #fff; border-radius: .7rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.1rem; }
    .card__head { display: flex; align-items: flex-start; gap: .7rem; margin-bottom: .9rem; }
    .card__icon { font-size: 1.6rem; }
    .card__id { flex: 1; display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
    .card__name { font-size: .95rem; font-weight: 700; color: #111; }
    .card__meta { font-size: .74rem; color: #9ca3af; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: .9rem; opacity: .5; }
    .icon-btn:hover { opacity: 1; }

    .values { display: flex; gap: 1.25rem; flex-wrap: wrap; padding-bottom: .85rem; border-bottom: 1px solid #f3f4f6; }
    .val { display: flex; flex-direction: column; gap: .05rem; }
    .val__lbl { font-size: .68rem; text-transform: uppercase; color: #9ca3af; font-weight: 600; }
    .val__num { font-size: .9rem; font-weight: 700; color: #111; }
    .val__num small { font-weight: 500; font-size: .72rem; }

    .progress { margin-top: .85rem; }
    .progress__head, .progress__foot { display: flex; justify-content: space-between; font-size: .74rem; color: #6b7280; }
    .progress__head { margin-bottom: .3rem; font-weight: 600; }
    .progress__foot { margin-top: .3rem; }
    .progress__track { height: 8px; background: #f3f4f6; border-radius: 9999px; overflow: hidden; }
    .progress__fill { height: 100%; background: #2e7736; border-radius: 9999px; transition: width .3s; }

    .card__actions { display: flex; gap: 1rem; margin-top: .9rem; }
    .link-btn { background: none; border: none; color: #2e7736; font-size: .78rem; font-weight: 600; cursor: pointer; padding: 0; }

    .inst { margin-top: .8rem; border-top: 1px solid #f3f4f6; padding-top: .6rem; max-height: 230px; overflow-y: auto; }
    .inst__row { display: grid; grid-template-columns: 52px 1fr 1fr 80px; gap: .4rem;
      font-size: .76rem; color: #374151; padding: .3rem 0; border-bottom: 1px solid #f9fafb; }
    .inst__row--paid { opacity: .55; }
    .inst__status { text-align: right; }

    .empty { text-align: center; padding: 2.5rem 1rem; }
    .empty__icon { font-size: 2.2rem; display: block; margin-bottom: .5rem; }
    .empty p { margin: .2rem 0; color: #111; font-size: .9rem; }
    .muted { color: #9ca3af; font-size: .82rem; }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 700;
      display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .modal { background: #fff; border-radius: .75rem; padding: 1.6rem; width: 100%;
      max-width: 700px; max-height: 90vh; overflow-y: auto; }
    .modal--sm { max-width: 420px; }
    .modal h2 { font-size: 1.05rem; color: #111; margin: 0 0 1rem; }
    .row { display: flex; flex-wrap: wrap; gap: .8rem; margin-bottom: .8rem; }
    .fg { display: flex; flex-direction: column; gap: .25rem; min-width: 130px; flex: 1; margin-bottom: .5rem; }
    .fg--grow { flex: 3; } .fg--sm { max-width: 110px; }
    .fg label { font-size: .74rem; font-weight: 600; color: #374151; }
    .input { padding: .45rem .7rem; border: 1px solid #d1d5db; border-radius: .35rem;
      font-size: .85rem; width: 100%; background: #fff; color: #111; }
    .check { display: flex; align-items: center; gap: .45rem; font-size: .84rem; color: #374151;
      margin: .5rem 0; cursor: pointer; }
    .hint { font-size: .78rem; color: #6b7280; margin: .3rem 0 .8rem; line-height: 1.5; }
    .hint--box { background: #f5f3ff; border-left: 3px solid #8b5cf6; border-radius: .35rem;
      padding: .7rem .85rem; margin-bottom: 1rem; }
    :host-context([data-theme="dark"]) .hint--box { background: rgba(139,92,246,.12) !important; border-left-color: #a78bfa !important; }
    .foot { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1rem; }
    .btn { border-radius: .35rem; padding: .5rem 1.2rem; font-size: .85rem; font-weight: 600; cursor: pointer; }
    .btn--primary { background: #2e7736; color: #fff; border: none; }
    .btn--primary:disabled { opacity: .45; cursor: default; }
    .btn--ghost { background: none; border: 1px solid #d1d5db; color: #374151; }
    .btn--danger { background: #dc2626; color: #fff; border: none; }

    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .kpis,
    :host-context([data-theme="dark"]) .card,
    :host-context([data-theme="dark"]) .modal { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .kpi__val,
    :host-context([data-theme="dark"]) .bar__title,
    :host-context([data-theme="dark"]) .card__name,
    :host-context([data-theme="dark"]) .val__num,
    :host-context([data-theme="dark"]) .modal h2,
    :host-context([data-theme="dark"]) .empty p { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .kpi__lbl,
    :host-context([data-theme="dark"]) .card__meta,
    :host-context([data-theme="dark"]) .val__lbl,
    :host-context([data-theme="dark"]) .muted,
    :host-context([data-theme="dark"]) .hint,
    :host-context([data-theme="dark"]) .progress__head,
    :host-context([data-theme="dark"]) .progress__foot { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .fg label,
    :host-context([data-theme="dark"]) .check,
    :host-context([data-theme="dark"]) .inst__row { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .input { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .values,
    :host-context([data-theme="dark"]) .inst { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .inst__row { border-bottom-color: #1e2638 !important; }
    :host-context([data-theme="dark"]) .progress__track { background: #232d42 !important; }
    :host-context([data-theme="dark"]) .progress__fill { background: #4ade80 !important; }
    :host-context([data-theme="dark"]) .link-btn { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .pos { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .neg { color: #f87171 !important; }
    :host-context([data-theme="dark"]) .btn--ghost { border-color: #232d42 !important; color: #c5cdd9 !important; }
  `]
})
export class AssetsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly types = TYPES;

  list    = signal<Asset[]>([]);
  loading = signal(true);
  saving  = signal(false);

  formOpen         = signal(false);
  confirmDelete    = signal<Asset | null>(null);
  valuationFor     = signal<Asset | null>(null);
  openInstallments = signal<string | null>(null);
  installments     = signal<any[]>([]);

  form = emptyForm();
  valuationValue: number | null = null;
  valuationDate  = new Date().toISOString().slice(0, 10);
  valuationNote  = '';

  totalMarket       = computed(() => this.list().reduce((s, a) => s + a.market_value, 0));
  totalAppreciation = computed(() => this.list().reduce((s, a) => s + a.appreciation, 0));
  totalRemaining    = computed(() => this.list().reduce((s, a) => s + a.remaining_value, 0));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<any>('/assets').pipe(catchError(() => of({ data: [] })))
      .subscribe(r => { this.list.set(r.data ?? []); this.loading.set(false); });
  }

  /** Consórcio tem regras próprias: não há bem até a contemplação. */
  isConsorcio(): boolean { return this.form.type === 'consorcio'; }

  iconFor(t: string)  { return TYPES.find(x => x.v === t)?.icon ?? '📦'; }
  labelFor(t: string) { return TYPES.find(x => x.v === t)?.label ?? 'Outro'; }

  openForm(): void {
    this.form = emptyForm();
    this.formOpen.set(true);
  }

  save(): void {
    if (!this.form.name) return;
    this.saving.set(true);
    this.api.post<any>('/assets', this.form).pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.saving.set(false);
        if (!res) { this.toast.error('Não foi possível salvar.'); return; }
        const n = res.installments_created ?? 0;
        this.toast.success(n > 0 ? `Propriedade salva e ${n} parcela(s) gerada(s).` : 'Propriedade salva.');
        this.formOpen.set(false);
        this.load();
      });
  }

  openValuation(a: Asset): void {
    this.valuationFor.set(a);
    this.valuationValue = a.market_value;
    this.valuationDate = new Date().toISOString().slice(0, 10);
    this.valuationNote = '';
  }

  saveValuation(): void {
    const a = this.valuationFor();
    if (!a || !this.valuationValue) return;
    this.api.post<any>(`/assets/${a.id}/valuation`, {
      value: this.valuationValue, date: this.valuationDate, note: this.valuationNote,
    }).pipe(catchError(() => of(null))).subscribe(res => {
      if (!res) { this.toast.error('Não foi possível atualizar.'); return; }
      this.toast.success('Valor atualizado.');
      this.valuationFor.set(null);
      this.load();
    });
  }

  toggleInstallments(a: Asset): void {
    if (this.openInstallments() === a.id) { this.openInstallments.set(null); return; }
    this.openInstallments.set(a.id);
    this.api.get<any>(`/assets/${a.id}/installments`).pipe(catchError(() => of({ data: [] })))
      .subscribe(r => this.installments.set(r.data ?? []));
  }

  remove(a: Asset): void {
    this.api.delete<any>(`/assets/${a.id}`).pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.confirmDelete.set(null);
        if (!res) { this.toast.error('Não foi possível excluir.'); return; }
        this.toast.success('Propriedade removida.');
        this.load();
      });
  }
}
