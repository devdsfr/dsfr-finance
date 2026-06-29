import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

const ACCOUNT_TYPES = [
  { value: 'checking',  label: 'Conta Corrente' },
  { value: 'savings',   label: 'Poupança' },
  { value: 'cash',      label: 'Dinheiro' },
  { value: 'investment',label: 'Investimento' },
  { value: 'other',     label: 'Outro' },
];

const CARD_BRANDS = [
  { value: 'visa',       label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo',        label: 'Elo' },
  { value: 'amex',       label: 'Amex' },
  { value: 'hipercard',  label: 'Hipercard' },
  { value: 'other',      label: 'Outro' },
];

const COLORS = ['#111827','#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#0891b2','#db2777'];

// Logos bancários: Simple Icons CDN (vector SVG, sem API key)
// Logo helpers — Simple Icons (SVG, vetorial) tem prioridade;
// Clearbit Logo API (PNG 128px) para os demais (muito melhor que Google Favicon).
// onLogoError no template cai para Google Favicon como último recurso.
const SI = (slug: string, color = '000000') =>
  `https://cdn.simpleicons.org/${slug}/${color}`;
const CL = (domain: string) =>
  `https://logo.clearbit.com/${domain}`;
const GF = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// Mapa domain→logo para normalizar URLs antigas salvas no BD
const DOMAIN_TO_LOGO: Record<string, string> = {
  'nubank.com.br':         SI('nubank',       '8a05be'),
  'bancointer.com.br':     SI('inter',        'ff7000'),
  'inter.co':              SI('inter',        'ff7000'),
  'itau.com.br':           CL('itau.com.br'),
  'bradesco.com.br':       CL('bradesco.com.br'),
  'santander.com.br':      SI('santander',    'ec0000'),
  'caixa.gov.br':          CL('caixa.gov.br'),
  'bb.com.br':             CL('bb.com.br'),
  'c6bank.com.br':         CL('c6bank.com.br'),
  'btgpactual.com':        CL('btgpactual.com'),
  'xpi.com.br':            CL('xpi.com.br'),
  'mercadopago.com.br':    SI('mercadopago',  '009ee3'),
  'picpay.com':            SI('picpay',       '21c25e'),
  'sicoob.com.br':         CL('sicoob.com.br'),
  'sicredi.com.br':        CL('sicredi.com.br'),
  'neon.com.br':           CL('neon.com.br'),
  'carrefour.com.br':      CL('carrefour.com.br'),
  'mercadolivre.com.br':   SI('mercadolivre', '009ee3'),
  'amex.com.br':           SI('americanexpress','2e77bc'),
  'visa.com':              SI('visa',         '1a1f71'),
  'mastercard.com':        SI('mastercard',   'eb001b'),
};

const BANK_PRESETS = [
  { name: 'Nubank',          color: '#8a05be', logo: SI('nubank','8a05be'),        fallback: GF('nubank.com.br') },
  { name: 'Inter',           color: '#ff7000', logo: SI('inter','ff7000'),         fallback: CL('inter.co') },
  { name: 'Itaú',            color: '#003d8f', logo: CL('itau.com.br'),            fallback: GF('itau.com.br') },
  { name: 'Bradesco',        color: '#cc092f', logo: CL('bradesco.com.br'),        fallback: GF('bradesco.com.br') },
  { name: 'Santander',       color: '#ec0000', logo: SI('santander','ec0000'),     fallback: CL('santander.com.br') },
  { name: 'Caixa',           color: '#005ca9', logo: CL('caixa.gov.br'),           fallback: GF('caixa.gov.br') },
  { name: 'Banco do Brasil', color: '#f9dd16', logo: CL('bb.com.br'),              fallback: GF('bb.com.br') },
  { name: 'C6 Bank',         color: '#242424', logo: CL('c6bank.com.br'),          fallback: GF('c6bank.com.br') },
  { name: 'BTG',             color: '#002060', logo: CL('btgpactual.com'),         fallback: GF('btgpactual.com') },
  { name: 'XP',              color: '#111111', logo: CL('xpi.com.br'),             fallback: GF('xpi.com.br') },
  { name: 'Mercado Pago',    color: '#009ee3', logo: SI('mercadopago','009ee3'),   fallback: CL('mercadopago.com.br') },
  { name: 'Mercado Livre',   color: '#009ee3', logo: SI('mercadolivre','009ee3'),  fallback: CL('mercadolivre.com.br') },
  { name: 'PicPay',          color: '#21c25e', logo: SI('picpay','21c25e'),        fallback: GF('picpay.com') },
  { name: 'Sicoob',          color: '#007a3d', logo: CL('sicoob.com.br'),          fallback: GF('sicoob.com.br') },
  { name: 'Sicredi',         color: '#009a44', logo: CL('sicredi.com.br'),         fallback: GF('sicredi.com.br') },
  { name: 'Neon',            color: '#1b1c8a', logo: CL('neon.com.br'),            fallback: GF('neon.com.br') },
  { name: 'Carrefour',       color: '#004a97', logo: CL('carrefour.com.br'),       fallback: GF('carrefour.com.br') },
  { name: 'Visa',            color: '#1a1f71', logo: SI('visa','1a1f71'),          fallback: '' },
  { name: 'Mastercard',      color: '#eb001b', logo: SI('mastercard','eb001b'),    fallback: '' },
  { name: 'American Express',color: '#2e77bc', logo: SI('americanexpress','2e77bc'), fallback: '' },
  { name: 'Outro',           color: '#6b7280', logo: '',                           fallback: '' },
];

@Component({
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule, FormsModule, MoneyMaskDirective, ConfirmModalComponent],
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

            <!-- Bank presets -->
            <div class="form-group" style="margin-bottom:1rem">
              <label>Escolher banco</label>
              <div class="preset-grid">
                @for (b of bankPresets; track b.name) {
                  <button type="button" class="preset-btn"
                          [class.selected]="acc.logo === b.logo"
                          (click)="applyBankPreset(acc, b)"
                          [title]="b.name">
                    @if (b.logo) {
                      <div class="preset-icon-wrap">
                        <img [src]="b.logo" [alt]="b.name" class="preset-logo"
                             (error)="onLogoError($event, b.color, b.name, b.fallback)" />
                      </div>
                    } @else {
                      <div class="preset-initial" [style.background]="b.color">{{ b.name[0] }}</div>
                    }
                    <span class="preset-label">{{ b.name }}</span>
                  </button>
                }
              </div>
            </div>

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
                <input [(ngModel)]="acc.balance" name="balance" type="text" inputmode="decimal" appMoneyMask class="input" placeholder="0,00" />
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
                @if (a.logo) {
                  <div class="item-icon" [style.border-color]="a.color ?? '#111'">
                    <img [src]="a.logo" [alt]="a.name" class="icon-logo"
                         (error)="onLogoError($event, a.color ?? '#111', a.name)" />
                  </div>
                } @else {
                  <div class="item-icon item-icon--wallet" [style.background]="a.color ?? '#6b7280'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="60%" height="60%">
                      <rect x="2" y="7" width="20" height="14" rx="2"/>
                      <path d="M16 3H4a2 2 0 0 0-2 2v2"/>
                      <path d="M22 12h-4a2 2 0 0 0 0 4h4"/>
                    </svg>
                  </div>
                }
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

            <!-- Bank presets -->
            <div class="form-group" style="margin-bottom:1rem">
              <label>Escolher banco</label>
              <div class="preset-grid">
                @for (b of bankPresets; track b.name) {
                  <button type="button" class="preset-btn"
                          [class.selected]="card.logo === b.logo"
                          (click)="applyBankPreset(card, b)"
                          [title]="b.name">
                    @if (b.logo) {
                      <div class="preset-icon-wrap">
                        <img [src]="b.logo" [alt]="b.name" class="preset-logo"
                             (error)="onLogoError($event, b.color, b.name, b.fallback)" />
                      </div>
                    } @else {
                      <div class="preset-initial" [style.background]="b.color">{{ b.name[0] }}</div>
                    }
                    <span class="preset-label">{{ b.name }}</span>
                  </button>
                }
              </div>
            </div>

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
                <input [(ngModel)]="card.limit" name="limit" type="text" inputmode="decimal" appMoneyMask class="input" placeholder="0,00" />
              </div>
              <div class="form-group">
                <label>Dia de fechamento</label>
                <input [(ngModel)]="card.closing_day" name="closing_day" type="number" min="1" max="31" class="input" placeholder="1–31" />
              </div>
              <div class="form-group">
                <label>Dia de vencimento</label>
                <input [(ngModel)]="card.due_day" name="due_day" type="number" min="1" max="31" class="input" placeholder="1–31" />
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
                @if (c.logo) {
                  <div class="item-icon item-icon--card" [style.border-color]="c.color ?? '#6366f1'">
                    <img [src]="c.logo" [alt]="c.name" class="icon-logo"
                         (error)="onLogoError($event, c.color ?? '#6366f1', c.name)" />
                  </div>
                } @else {
                  <div class="item-icon item-icon--card item-icon--wallet" [style.background]="c.color ?? '#6366f1'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="60%" height="60%">
                      <rect x="2" y="5" width="20" height="14" rx="2"/>
                      <line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                  </div>
                }
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

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      (confirmed)="doDelete()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
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
    .form-actions { display: flex; gap: .75rem; justify-content: flex-end; padding-top: .5rem; border-top: 1px solid #f3f4f6; margin-top: .5rem; }

    /* Bank preset grid */
    .preset-grid { display: flex; flex-wrap: wrap; gap: .5rem; padding-top: .25rem; }
    .preset-btn {
      display: flex; flex-direction: column; align-items: center; gap: .25rem;
      width: 68px; padding: .5rem .25rem; border-radius: .5rem;
      border: 2px solid transparent; background: #f9fafb; cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .preset-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
    .preset-btn.selected { border-color: #2e7736; background: #f0fdf4; }
    .preset-icon-wrap {
      width: 40px; height: 40px; border-radius: 50%;
      background: #fff; border: 1px solid #e5e7eb;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .preset-logo { width: 32px; height: 32px; object-fit: contain; display: block; }
    .preset-initial { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 1rem; }
    .preset-label { font-size: .6rem; color: #6b7280; text-align: center; line-height: 1.2; max-width: 60px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

    /* Card list */
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
      color: #fff; font-weight: 700; font-size: 1.2rem; flex-shrink: 0;
      overflow: hidden; background: #fff;
      border: 2.5px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .item-icon--card { border-radius: .5rem; }
    .icon-logo { width: 70%; height: 70%; object-fit: contain; display: block; }
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
  readonly bankPresets = BANK_PRESETS;

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  ngOnInit() {
    this.loadAccounts();
    this.loadCards();
  }

  private inferLogo(name: string, logo: string): string {
    if (logo) return logo;
    const n = name.toLowerCase();
    if (n.includes('nubank'))                                       return SI('nubank','8a05be');
    if (n.includes('inter'))                                        return GF('inter.co');
    if (n.includes('itaú') || n.includes('itau'))                  return GF('itau.com.br');
    if (n.includes('bradesco'))                                     return GF('bradesco.com.br');
    if (n.includes('santander'))                                    return GF('santander.com.br');
    if (n.includes('caixa'))                                        return GF('caixa.gov.br');
    if (n.includes('brasil') || n.includes(' bb'))                  return GF('bb.com.br');
    if (n.includes('c6'))                                           return GF('c6bank.com.br');
    if (n.includes('btg'))                                          return GF('btgpactual.com');
    if (n.includes('xp'))                                           return GF('xpi.com.br');
    if (n.includes('mercado pago') || n.includes('mercadopago'))    return SI('mercadopago','009ee3');
    if (n.includes('picpay'))                                       return SI('picpay','21c25e');
    if (n.includes('sicoob'))                                       return GF('sicoob.com.br');
    if (n.includes('sicredi'))                                      return GF('sicredi.com.br');
    if (n.includes('neon'))                                         return GF('neon.com.br');
    if (n.includes('carrefour'))                                    return GF('carrefour.com.br');
    if (n.includes('mercado livre') || n.includes('mercadolivre')) return GF('mercadolivre.com.br');
    return '';
  }
  normalizeLogo(logo: string): string {
    if (!logo) return '';
    // Old Clearbit: logo.clearbit.com/domain
    let m = logo.match(/logo\.clearbit\.com\/([^?/]+)/);
    if (m) return DOMAIN_TO_LOGO[m[1]] ?? GF(m[1]);
    // Old Apple Touch Icon: domain/apple-touch-icon.png
    m = logo.match(/https?:\/\/([^/]+)\/apple-touch-icon/);
    if (m) {
      const domain = m[1].replace(/^www\./, '');
      return DOMAIN_TO_LOGO[domain] ?? GF(domain);
    }
    // Old Google favicon sz=128/256 → upgrade to SI if available
    m = logo.match(/favicons\?domain=([^&]+)/);
    if (m) return DOMAIN_TO_LOGO[m[1]] ?? GF(m[1]);
    return logo;
  }

  loadAccounts() {
    this.loadingAccs.set(true);
    this.api.get<any>('/accounts').subscribe(r => {
      const data = (r.data ?? []).map((a: any) => ({ ...a, logo: this.inferLogo(a.name, this.normalizeLogo(a.logo)) }));
      this.accounts.set(data);
      this.loadingAccs.set(false);
    });
  }

  loadCards() {
    this.loadingCards.set(true);
    this.api.get<any>('/credit-cards').subscribe(r => {
      const data = (r.data ?? []).map((c: any) => ({ ...c, logo: this.inferLogo(c.name, this.normalizeLogo(c.logo)) }));
      this.cards.set(data);
      this.loadingCards.set(false);
    });
  }

  applyBankPreset(obj: any, bank: typeof BANK_PRESETS[0]) {
    if (bank.name !== 'Outro') obj.name = bank.name;
    obj.color = bank.color;
    obj.logo  = bank.logo;
  }

  onLogoError(event: Event, color: string, name: string, fallback?: string) {
    const img = event.target as HTMLImageElement;
    // First failure: try GF fallback if available and not yet tried
    if (fallback && !img.dataset['triedFallback']) {
      img.dataset['triedFallback'] = '1';
      img.src = fallback;
      return;
    }
    // Final fallback: show initial letter on brand-color circle
    const parent = img.parentElement!;
    img.style.display = 'none';
    parent.style.background = color;
    parent.style.border = 'none';
    parent.textContent = name[0];
    parent.style.color = '#fff';
    parent.style.fontWeight = '700';
    parent.style.fontSize = '1.2rem';
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.justifyContent = 'center';
  }

  // ── Accounts ──
  openAccForm() {
    this.editingAcc = null;
    this.acc = { name: '', type: 'checking', balance: 0, color: '#111827', logo: '' };
    this.accForm = true;
  }
  editAcc(a: any) { this.editingAcc = a; this.acc = { ...a }; this.accForm = true; }
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
    this.confirmItem.set({ msg: `Tem certeza que deseja excluir a conta <strong>${a.name}</strong>?`, action: () => {
      this.api.delete(`/accounts/${a.id}`).subscribe({
        next: () => { this.toast.show('Conta excluída.', 'success'); this.loadAccounts(); },
        error: () => this.toast.show('Erro ao excluir.', 'error'),
      });
    }});
  }
  accTypeLabel(v: string) { return ACCOUNT_TYPES.find(t => t.value === v)?.label ?? v; }

  // ── Cards ──
  openCardForm() {
    this.editingCard = null;
    this.card = { name: '', brand: 'visa', limit: 0, closing_day: null, due_day: null, color: '#111827', logo: '' };
    this.cardForm = true;
  }
  editCard(c: any) { this.editingCard = c; this.card = { ...c }; this.cardForm = true; }
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
  doDelete(): void {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }

  deleteCard(c: any) {
    this.confirmItem.set({ msg: `Tem certeza que deseja excluir o cartão <strong>${c.name}</strong>?`, action: () => {
      this.api.delete(`/credit-cards/${c.id}`).subscribe({
        next: () => { this.toast.show('Cartão excluído.', 'success'); this.loadCards(); },
        error: () => this.toast.show('Erro ao excluir.', 'error'),
         });
    }});
  }
}
