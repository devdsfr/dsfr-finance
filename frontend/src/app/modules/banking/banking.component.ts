import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

const ACCOUNT_TYPES = [
  { value: 'checking',  label: 'Conta Corrente' },
  { value: 'savings',   label: 'Poupança' },
  { value: 'cash',      label: 'Dinheiro' },
  { value: 'investment',label: 'Investimento' },
  { value: 'other',     label: 'Outro' },
];

const CARD_BRANDS = [
  { value: 'visa',       label: 'Visa',        color: '#1a1f71' },
  { value: 'mastercard', label: 'Mastercard',   color: '#eb001b' },
  { value: 'elo',        label: 'Elo',          color: '#ffcb05' },
  { value: 'amex',       label: 'Amex',         color: '#2e77bc' },
  { value: 'hipercard',  label: 'Hipercard',    color: '#b3093c' },
  { value: 'other',      label: 'Outro',        color: '#6b7280' },
];

const COLORS = ['#111827','#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#0891b2','#db2777'];

const ACC_EMOJIS  = ['🏦','🏧','💰','💵','🐷','📈','💼','🏠','🌟','💎','🎯','🔐'];
const CARD_EMOJIS = ['💳','✈️','🛍️','🍔','⛽','🎮','📱','🏥','🎓','🛒','🌐','💡'];

@Component({
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>Contas & Cartões</h1>
    </div>

    <!-- ── CONTAS ──────────────────────────────────────────────── -->
    <section class="section">
      <div class="section-head">
        <h2>Contas</h2>
        <button class="btn btn--primary btn--sm" (click)="openAccForm()">+ Nova conta</button>
      </div>

      @if (accForm) {
        <div class="form-card">
          <h3>{{ editingAcc ? 'Editar conta' : 'Nova conta' }}</h3>
          <form (ngSubmit)="saveAcc()" #af="ngForm">
            <div class="form-row">
              <div class="form-group">
                <label>Nome</label>
                <input [(ngModel)]="acc.name" name="name" class="input" required placeholder="Ex: Nubank, Itaú…" />
              </div>
              <div class="form-group">
                <label>Tipo</label>
                <select [(ngModel)]="acc.type" name="type" class="input">
                  @for (t of accTypes; track t.value) {
                    <option [value]="t.value">{{ t.label }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Saldo inicial (R$)</label>
                <input [(ngModel)]="acc.balance" name="balance" type="number" step="0.01" class="input" placeholder="0,00" />
              </div>
              <div class="form-group">
                <label>Ícone</label>
                <div class="emoji-row">
                  @for (e of accEmojis; track e) {
                    <button type="button" class="emoji-btn"
                            [class.selected]="acc.icon === e"
                            (click)="acc.icon = e">{{ e }}</button>
                  }
                </div>
              </div>
              <div class="form-group">
                <label>Cor</label>
                <div class="color-row">
                  @for (c of colors; track c) {
                    <button type="button" class="color-swatch"
                            [style.background]="c"
                            [class.selected]="acc.color === c"
                            (click)="acc.color = c"></button>
                  }
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn--ghost" (click)="cancelAcc()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="!acc.name">Salvar</button>
            </div>
          </form>
        </div>
      }

      @if (loadingAccs()) {
        <div class="list-grid">
          @for (i of [1,2,3]; track i) {
            <div class="item-card">
              <div class="skel-block skel-h3 skel-w-40" style="margin-bottom:.5rem"></div>
              <div class="skel-block skel-p skel-w-60"></div>
            </div>
          }
        </div>
      } @else if (accounts().length === 0) {
        <div class="empty-state">Nenhuma conta cadastrada.</div>
      } @else {
        <div class="list-grid">
          @for (a of accounts(); track a.id) {
            <div class="item-card">
              <div class="item-card__top">
                <div class="item-icon" [style.background]="a.color ?? '#111'">{{ a.icon || a.name[0] }}</div>
                <div class="item-info">
                  <span class="item-name">{{ a.name }}</span>
                  <span class="item-sub">{{ accTypeLabel(a.type) }}</span>
                </div>
              </div>
              <div class="item-balance">{{ a.balance | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</div>
              <div class="item-actions">
                <button class="btn btn--ghost btn--sm" (click)="editAcc(a)">✎ Editar</button>
                <button class="btn btn--danger btn--sm" (click)="deleteAcc(a)">✕</button>
              </div>
            </div>
          }
        </div>
      }
    </section>

    <!-- ── CARTÕES ─────────────────────────────────────────────── -->
    <section class="section">
      <div class="section-head">
        <h2>Cartões de Crédito</h2>
        <button class="btn btn--primary btn--sm" (click)="openCardForm()">+ Novo cartão</button>
      </div>

      @if (cardForm) {
        <div class="form-card">
          <h3>{{ editingCard ? 'Editar cartão' : 'Novo cartão' }}</h3>
          <form (ngSubmit)="saveCard()" #cf="ngForm">
            <div class="form-row">
              <div class="form-group">
                <label>Nome</label>
                <input [(ngModel)]="card.name" name="name" class="input" required placeholder="Ex: Nubank, Inter…" />
              </div>
              <div class="form-group">
                <label>Bandeira</label>
                <select [(ngModel)]="card.brand" name="brand" class="input">
                  @for (b of cardBrands; track b.value) {
                    <option [value]="b.value">{{ b.label }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Limite (R$)</label>
                <input [(ngModel)]="card.limit" name="limit" type="number" step="0.01" class="input" placeholder="0,00" />
              </div>
              <div class="form-group">
                <label>Dia de fechamento</label>
                <input [(ngModel)]="card.closing_day" name="closing_day" type="number" min="1" max="31" class="input" placeholder="1–31" />
              </div>
              <div class="form-group">
                <label>Dia de vencimento</label>
                <input [(ngModel)]="card.due_day" name="due_day" type="number" min="1" max="31" class="input" placeholder="1–31" />
              </div>
              <div class="form-group">
                <label>Ícone</label>
                <div class="emoji-row">
                  @for (e of cardEmojis; track e) {
                    <button type="button" class="emoji-btn"
                            [class.selected]="card.icon === e"
                            (click)="card.icon = e">{{ e }}</button>
                  }
                </div>
              </div>
              <div class="form-group">
                <label>Cor</label>
                <div class="color-row">
                  @for (c of colors; track c) {
                    <button type="button" class="color-swatch"
                            [style.background]="c"
                            [class.selected]="card.color === c"
                            (click)="card.color = c"></button>
                  }
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn--ghost" (click)="cancelCard()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="!card.name">Salvar</button>
            </div>
          </form>
        </div>
      }

      @if (loadingCards()) {
        <div class="list-grid">
          @for (i of [1,2,3]; track i) {
            <div class="item-card">
              <div class="skel-block skel-h3 skel-w-40" style="margin-bottom:.5rem"></div>
              <div class="skel-block skel-p skel-w-60"></div>
            </div>
          }
        </div>
      } @else if (cards().length === 0) {
        <div class="empty-state">Nenhum cartão cadastrado.</div>
      } @else {
        <div class="list-grid">
          @for (c of cards(); track c.id) {
            <div class="item-card">
              <div class="item-card__top">
                <div class="item-icon item-icon--card" [style.background]="c.color ?? '#6366f1'">{{ c.icon || c.name[0] }}</div>
                <div class="item-info">
                  <span class="item-name">{{ c.name }}</span>
                  <span class="item-sub">{{ brandLabel(c.brand) }}</span>
                </div>
              </div>
              <div class="item-limits">
                <div>
                  <span class="lim-label">Limite</span>
                  <span class="lim-val">{{ c.limit | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                </div>
                @if (c.closing_day) {
                  <div>
                    <span class="lim-label">Fechamento</span>
                    <span class="lim-val">Dia {{ c.closing_day }}</span>
                  </div>
                }
                @if (c.due_day) {
                  <div>
                    <span class="lim-label">Vencimento</span>
                    <span class="lim-val">Dia {{ c.due_day }}</span>
                  </div>
                }
              </div>
              <div class="item-actions">
                <button class="btn btn--ghost btn--sm" (click)="editCard(c)">✎ Editar</button>
                <button class="btn btn--danger btn--sm" (click)="deleteCard(c)">✕</button>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .page-header { margin-bottom: 1.5rem; }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; color: #111; margin: 0; }

    .section { margin-bottom: 2.5rem; }
    .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-head h2 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #111; }

    .form-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.5rem; margin-bottom: 1rem; }
    .form-card h3 { margin: 0 0 1.25rem; font-size: 1rem; font-weight: 700; color: #111; }
    .form-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
    .form-group { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: .3rem; }
    label { font-size: .8rem; font-weight: 500; color: #374151; }
    .input { padding: .45rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; width: 100%; box-sizing: border-box; }
    .input:focus { outline: none; border-color: #2e7736; box-shadow: 0 0 0 3px rgba(46,119,54,.1); }
    .color-row { display: flex; gap: .35rem; flex-wrap: wrap; padding-top: .25rem; }
    .color-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform .1s; }
    .color-swatch:hover { transform: scale(1.15); }
    .color-swatch.selected { border-color: #111; transform: scale(1.15); }
    .emoji-row { display: flex; gap: .25rem; flex-wrap: wrap; padding-top: .25rem; }
    .emoji-btn { width: 34px; height: 34px; border-radius: .375rem; border: 2px solid transparent; background: #f3f4f6; cursor: pointer; font-size: 1.1rem; line-height: 1; display: flex; align-items: center; justify-content: center; transition: transform .1s, border-color .1s; }
    .emoji-btn:hover { transform: scale(1.15); background: #e5e7eb; }
    .emoji-btn.selected { border-color: #2e7736; background: #dcfce7; transform: scale(1.1); }
    .form-actions { display: flex; gap: .75rem; justify-content: flex-end; padding-top: .5rem; border-top: 1px solid #f3f4f6; margin-top: .5rem; }

    .list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .item-card {
      background: #fff; border-radius: .5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      padding: 1.25rem;
      display: flex; flex-direction: column; gap: .75rem;
    }
    .item-card__top { display: flex; align-items: center; gap: .75rem; }
    .item-icon {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 1.35rem; flex-shrink: 0;
    }
    .item-icon--card { border-radius: .5rem; }
    .item-info { display: flex; flex-direction: column; }
    .item-name { font-size: .95rem; font-weight: 700; color: #111; }
    .item-sub { font-size: .75rem; color: #9ca3af; }
    .item-balance { font-size: 1.25rem; font-weight: 700; color: #2563eb; }
    .item-limits { display: flex; gap: 1rem; flex-wrap: wrap; }
    .item-limits > div { display: flex; flex-direction: column; }
    .lim-label { font-size: .7rem; color: #9ca3af; }
    .lim-val { font-size: .875rem; font-weight: 600; color: #111; }
    .item-actions { display: flex; gap: .5rem; padding-top: .5rem; border-top: 1px solid #f3f4f6; }

    .btn { padding: .4rem .9rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--primary:hover { background: #235c29; }
    .btn--primary:disabled { opacity: .5; cursor: default; }
    .btn--ghost { background: none; border: 1px solid #d1d5db; color: #374151; }
    .btn--ghost:hover { border-color: #2e7736; color: #2e7736; }
    .btn--danger { background: none; color: #ef4444; border: 1px solid transparent; }
    .btn--danger:hover { background: #fef2f2; }
    .btn--sm { padding: .25rem .6rem; font-size: .78rem; }

    .empty-state { text-align: center; color: #9ca3af; padding: 2.5rem; background: #fff; border-radius: .5rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
  `]
})
export class BankingComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  accounts = signal<any[]>([]);
  cards    = signal<any[]>([]);
  loadingAccs  = signal(true);
  loadingCards = signal(true);

  accForm   = false;
  cardForm  = false;
  editingAcc:  any = null;
  editingCard: any = null;

  acc:  any = {};
  card: any = {};

  readonly accTypes   = ACCOUNT_TYPES;
  readonly cardBrands = CARD_BRANDS;
  readonly colors     = COLORS;
  readonly accEmojis  = ACC_EMOJIS;
  readonly cardEmojis = CARD_EMOJIS;

  ngOnInit() {
    this.loadAccounts();
    this.loadCards();
  }

  loadAccounts() {
    this.loadingAccs.set(true);
    this.api.get<any>('/accounts').subscribe(r => { this.accounts.set(r.data ?? []); this.loadingAccs.set(false); });
  }

  loadCards() {
    this.loadingCards.set(true);
    this.api.get<any>('/credit-cards').subscribe(r => { this.cards.set(r.data ?? []); this.loadingCards.set(false); });
  }

  // ── Accounts ──
  openAccForm() {
    this.editingAcc = null;
    this.acc = { name: '', type: 'checking', balance: 0, color: COLORS[0], icon: '' };
    this.accForm = true;
  }
  editAcc(a: any) {
    this.editingAcc = a;
    this.acc = { ...a };
    this.accForm = true;
  }
  cancelAcc() { this.accForm = false; }
  saveAcc() {
    const obs = this.editingAcc
      ? this.api.put(`/accounts/${this.editingAcc.id}`, this.acc)
      : this.api.post('/accounts', this.acc);
    obs.subscribe({
      next: () => { this.toast.show('Conta salva!', 'success'); this.accForm = false; this.loadAccounts(); },
      error: () => this.toast.show('Erro ao salvar conta.', 'error'),
    });
  }
  deleteAcc(a: any) {
    if (!confirm(`Excluir a conta "${a.name}"?`)) return;
    this.api.delete(`/accounts/${a.id}`).subscribe({
      next: () => { this.toast.show('Conta excluída.', 'success'); this.loadAccounts(); },
      error: () => this.toast.show('Erro ao excluir.', 'error'),
    });
  }
  accTypeLabel(v: string) { return ACCOUNT_TYPES.find(t => t.value === v)?.label ?? v; }

  // ── Cards ──
  openCardForm() {
    this.editingCard = null;
    this.card = { name: '', brand: 'visa', limit: 0, closing_day: null, due_day: null, color: COLORS[1], icon: '' };
    this.cardForm = true;
  }
  editCard(c: any) {
    this.editingCard = c;
    this.card = { ...c };
    this.cardForm = true;
  }
  cancelCard() { this.cardForm = false; }
  saveCard() {
    const obs = this.editingCard
      ? this.api.put(`/credit-cards/${this.editingCard.id}`, this.card)
      : this.api.post('/credit-cards', this.card);
    obs.subscribe({
      next: () => { this.toast.show('Cartão salvo!', 'success'); this.cardForm = false; this.loadCards(); },
      error: () => this.toast.show('Erro ao salvar cartão.', 'error'),
    });
  }
  deleteCard(c: any) {
    if (!confirm(`Excluir o cartão "${c.name}"?`)) return;
    this.api.delete(`/credit-cards/${c.id}`).subscribe({
      next: () => { this.toast.show('Cartão excluído.', 'success'); this.loadCards(); },
      error: () => this.toast.show('Erro ao excluir.', 'error'),
    });
  }
  brandLabel(v: string) { return CARD_BRANDS.find(b => b.value === v)?.label ?? v; }
}
