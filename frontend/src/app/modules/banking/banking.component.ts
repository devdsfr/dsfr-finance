import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-currency.pipe';

const SI = (slug: string, color = '000000') => `https://cdn.simpleicons.org/${slug}/${color}`;
const CL = (domain: string) => `https://logo.clearbit.com/${domain}`;
const GF = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

const DOMAIN_TO_LOGO: Record<string, string> = {
  'nubank.com.br': SI('nubank','8a05be'), 'bancointer.com.br': SI('inter','ff7000'),
  'inter.co': SI('inter','ff7000'), 'itau.com.br': CL('itau.com.br'),
  'bradesco.com.br': CL('bradesco.com.br'), 'santander.com.br': SI('santander','ec0000'),
  'caixa.gov.br': CL('caixa.gov.br'), 'bb.com.br': CL('bb.com.br'),
  'c6bank.com.br': CL('c6bank.com.br'), 'btgpactual.com': CL('btgpactual.com'),
  'xpi.com.br': CL('xpi.com.br'), 'mercadopago.com.br': SI('mercadopago','009ee3'),
  'picpay.com': SI('picpay','21c25e'), 'sicoob.com.br': CL('sicoob.com.br'),
  'sicredi.com.br': CL('sicredi.com.br'), 'neon.com.br': CL('neon.com.br'),
  'carrefour.com.br': CL('carrefour.com.br'), 'mercadolivre.com.br': SI('mercadolivre','009ee3'),
};

const BANK_PRESETS = [
  { name: 'Nubank',           color: '#8a05be', logo: SI('nubank','8a05be'),         fallback: GF('nubank.com.br') },
  { name: 'Inter',            color: '#ff7000', logo: SI('inter','ff7000'),           fallback: CL('inter.co') },
  { name: 'Itaú',             color: '#003d8f', logo: CL('itau.com.br'),              fallback: GF('itau.com.br') },
  { name: 'Bradesco',         color: '#cc092f', logo: CL('bradesco.com.br'),          fallback: GF('bradesco.com.br') },
  { name: 'Santander',        color: '#ec0000', logo: SI('santander','ec0000'),       fallback: CL('santander.com.br') },
  { name: 'Caixa',            color: '#005ca9', logo: CL('caixa.gov.br'),             fallback: GF('caixa.gov.br') },
  { name: 'Banco do Brasil',  color: '#f9dd16', logo: CL('bb.com.br'),                fallback: GF('bb.com.br') },
  { name: 'C6 Bank',          color: '#242424', logo: CL('c6bank.com.br'),            fallback: GF('c6bank.com.br') },
  { name: 'BTG',              color: '#002060', logo: CL('btgpactual.com'),           fallback: GF('btgpactual.com') },
  { name: 'XP',               color: '#111111', logo: CL('xpi.com.br'),               fallback: GF('xpi.com.br') },
  { name: 'Mercado Pago',     color: '#009ee3', logo: SI('mercadopago','009ee3'),     fallback: CL('mercadopago.com.br') },
  { name: 'Mercado Livre',    color: '#009ee3', logo: SI('mercadolivre','009ee3'),    fallback: CL('mercadolivre.com.br') },
  { name: 'PicPay',           color: '#21c25e', logo: SI('picpay','21c25e'),          fallback: GF('picpay.com') },
  { name: 'Sicoob',           color: '#007a3d', logo: CL('sicoob.com.br'),            fallback: GF('sicoob.com.br') },
  { name: 'Sicredi',          color: '#009a44', logo: CL('sicredi.com.br'),           fallback: GF('sicredi.com.br') },
  { name: 'Neon',             color: '#1b1c8a', logo: CL('neon.com.br'),              fallback: GF('neon.com.br') },
  { name: 'Carrefour',        color: '#004a97', logo: CL('carrefour.com.br'),         fallback: GF('carrefour.com.br') },
  { name: 'Visa',             color: '#1a1f71', logo: SI('visa','1a1f71'),            fallback: '' },
  { name: 'Mastercard',       color: '#eb001b', logo: SI('mastercard','eb001b'),      fallback: '' },
  { name: 'American Express', color: '#2e77bc', logo: SI('americanexpress','2e77bc'), fallback: '' },
  { name: 'Outro',            color: '#6b7280', logo: '',                             fallback: '' },
];

const ACCOUNT_TYPES = [
  { value: 'checking',   label: 'Conta Corrente' },
  { value: 'savings',    label: 'Poupança' },
  { value: 'investment', label: 'Investimento' },
  { value: 'wallet',     label: 'Carteira' },
  { value: 'other',      label: 'Outro' },
];

const CARD_BRANDS = [
  { value: 'visa',      label: 'Visa' },
  { value: 'mastercard',label: 'Mastercard' },
  { value: 'elo',       label: 'Elo' },
  { value: 'amex',      label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'other',     label: 'Outro' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

@Component({
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MoneyMaskDirective, ConfirmModalComponent, AppCurrencyPipe],
  template: `
<div class="settings-layout">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-group">
      <a routerLink="/categories" class="sidebar-link">Categorias</a>
      <a class="sidebar-link" [class.active]="section() === 'accounts'" (click)="section.set('accounts'); view.set('list')">
        @if (section() === 'accounts') { <span class="bullet">●</span> } Contas
      </a>
      <a class="sidebar-link" [class.active]="section() === 'cards'" (click)="section.set('cards'); view.set('list')">
        @if (section() === 'cards') { <span class="bullet">●</span> } Cartões de crédito
      </a>
    </div>
    <hr class="sidebar-hr"/>
    <div class="sidebar-group">
      <a routerLink="/account"      class="sidebar-link">Preferências</a>
      <a routerLink="/plan"         class="sidebar-link">Plano</a>
      <a routerLink="/alert-config" class="sidebar-link">Alertas</a>
      <a routerLink="/activity"     class="sidebar-link">Atividades</a>
    </div>
  </aside>

  <!-- Main content -->
  <main class="main-content">

    <!-- ── ACCOUNTS LIST ── -->
    @if (section() === 'accounts' && view() === 'list') {
      <div class="content-card">
        <div class="content-head">
          <h1 class="content-title">Contas</h1>
          <button class="btn-add" (click)="openAccForm()">⊕ Nova conta</button>
        </div>
        @if (accounts().length === 0 && !loadingAccs()) {
          <div class="empty">Nenhuma conta cadastrada.</div>
        }
        <div class="flat-list">
          @for (a of accounts(); track a.id) {
            <div class="flat-item" (click)="showAccDetail(a)">
              <div class="flat-icon" [style.background]="a.logo ? 'transparent' : (a.color ?? '#6b7280')"
                   [style.border-color]="a.logo ? (a.color ?? '#e5e7eb') : 'transparent'">
                @if (a.logo) {
                  <img [src]="a.logo" [alt]="a.name" class="flat-logo"
                       (error)="onLogoError($event, a.color ?? '#6b7280', a.name, a.fallback)" />
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="55%" height="55%">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H4a2 2 0 0 0-2 2v2"/>
                    <path d="M22 12h-4a2 2 0 0 0 0 4h4"/>
                  </svg>
                }
              </div>
              <div class="flat-info">
                <span class="flat-name">{{ a.name }}</span>
                <span class="flat-sub">Conta manual</span>
              </div>
              <div class="flat-balance">{{ a.balance | appCurrency }}</div>
              <span class="flat-chevron">›</span>
            </div>
          }
        </div>
      </div>
    }

    <!-- ── ACCOUNT DETAIL ── -->
    @if (section() === 'accounts' && view() === 'detail') {
      <div class="content-card">
        <div class="detail-head">
          <button class="btn-back" (click)="view.set('list')">← Voltar</button>
          <div class="detail-actions">
            <button class="btn-link btn-link--green" (click)="editAcc(selectedAcc())">Editar</button>
            <button class="btn-link btn-link--red" (click)="archiveAcc(selectedAcc())">Arquivar</button>
          </div>
        </div>
        <div class="detail-hero">
          <div class="detail-icon" [style.background]="selectedAcc()?.logo ? 'transparent' : (selectedAcc()?.color ?? '#6b7280')"
               [style.border-color]="selectedAcc()?.color ?? '#e5e7eb'">
            @if (selectedAcc()?.logo) {
              <img [src]="selectedAcc()!.logo" [alt]="selectedAcc()!.name" class="flat-logo" />
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="55%" height="55%">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H4a2 2 0 0 0-2 2v2"/>
                <path d="M22 12h-4a2 2 0 0 0 0 4h4"/>
              </svg>
            }
          </div>
          <div>
            <div class="detail-name">{{ selectedAcc()?.name }}</div>
            <div class="flat-sub">Conta manual</div>
          </div>
        </div>
        <div class="balance-row">
          <span class="balance-val">{{ selectedAcc()?.balance | appCurrency }}</span>
          <button class="btn-link btn-link--blue" (click)="openAdjust()">Ajustar saldo</button>
        </div>
        <div class="action-cards">
          <a routerLink="/transactions" [queryParams]="{account_id: selectedAcc()?.id}" class="action-card">
            <span class="action-icon">☰</span> Ver Lançamentos
          </a>
          <a routerLink="/reports" class="action-card">
            <span class="action-icon">📊</span> Relatórios
          </a>
        </div>
      </div>
    }

    <!-- ── CARDS LIST ── -->
    @if (section() === 'cards' && view() === 'list') {
      <div class="content-card">
        <div class="content-head">
          <h1 class="content-title">Cartões de Crédito</h1>
          <button class="btn-add" (click)="openCardForm()">⊕ Adicionar cartão</button>
        </div>
        @if (cards().length === 0 && !loadingCards()) {
          <div class="empty">Nenhum cartão cadastrado.</div>
        }
        <div class="flat-list">
          @for (c of cards(); track c.id) {
            <div class="flat-item" (click)="showCardDetail(c)">
              <div class="flat-icon flat-icon--card" [style.background]="c.logo ? 'transparent' : (c.color ?? '#6366f1')"
                   [style.border-color]="c.logo ? (c.color ?? '#e5e7eb') : 'transparent'">
                @if (c.logo) {
                  <img [src]="c.logo" [alt]="c.name" class="flat-logo"
                       (error)="onLogoError($event, c.color ?? '#6366f1', c.name, c.fallback)" />
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="55%" height="55%">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                }
              </div>
              <div class="flat-info">
                <span class="flat-name">{{ c.name }}</span>
                <span class="flat-sub">Cartão manual</span>
              </div>
              <span class="flat-chevron">›</span>
            </div>
          }
        </div>
      </div>
    }

    <!-- ── CARD DETAIL ── -->
    @if (section() === 'cards' && view() === 'detail') {
      <div class="content-card">
        <div class="detail-head">
          <button class="btn-back" (click)="view.set('list')">← Voltar</button>
          <div class="detail-actions">
            <button class="btn-link btn-link--green" (click)="editCard(selectedCard())">Editar</button>
            <button class="btn-link btn-link--red" (click)="archiveCard(selectedCard())">Arquivar</button>
          </div>
        </div>
        <div class="detail-hero">
          <div class="flat-icon flat-icon--card" [style.background]="selectedCard()?.logo ? 'transparent' : (selectedCard()?.color ?? '#6366f1')"
               [style.border-color]="selectedCard()?.color ?? '#e5e7eb'">
            @if (selectedCard()?.logo) {
              <img [src]="selectedCard()!.logo" [alt]="selectedCard()!.name" class="flat-logo" />
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="55%" height="55%">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            }
          </div>
          <div>
            <div class="detail-name">{{ selectedCard()?.name }}</div>
            <div class="flat-sub">
              @if (selectedCard()?.closing_day) { Fecha dia {{ selectedCard()!.closing_day }} / }
              @if (selectedCard()?.due_day) { Vence dia {{ selectedCard()!.due_day }} }
              @if (!selectedCard()?.closing_day && !selectedCard()?.due_day) { Cartão manual }
            </div>
          </div>
        </div>
        <div class="invoice-current">
          <div class="invoice-current__label">Fatura atual</div>
          <div class="invoice-current__value">{{ currentInvoice() | appCurrency }}</div>
          @if (selectedCard()?.limit) {
            <div class="invoice-limit">Limite disponível {{ (selectedCard()!.limit - currentInvoice()) | appCurrency }}</div>
          }
        </div>
        <div class="invoices-section">
          <h3 class="invoices-title">Todas as faturas</h3>
          <hr/>
          @if (loadingInvoices()) {
            <div class="empty">Carregando...</div>
          } @else if (invoices().length === 0) {
            <div class="empty">Nenhuma fatura encontrada.</div>
          } @else {
            @for (inv of invoices(); track inv.month) {
              <a class="invoice-row" routerLink="/reports/card-invoices" [queryParams]="{card_id: selectedCard()?.id, month: inv.month}">
                <span class="inv-month">{{ formatInvMonth(inv.month) }}</span>
                <span class="inv-badge" [class]="invBadge(inv)">{{ invStatus(inv) }}</span>
                <span class="inv-val">{{ inv.expense | appCurrency }}</span>
              </a>
            }
          }
        </div>
      </div>
    }
  </main>
</div>

<!-- ── FORM MODAL (Conta / Cartão) ── -->
@if (formOpen()) {
  <div class="modal-overlay" (click)="closeForm()">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-head">
        <h2>{{ formTitle() }}</h2>
        <button class="modal-close" (click)="closeForm()">✕</button>
      </div>

      @if (formMode() === 'account') {
        <!-- ACCOUNT FORM -->
        <div class="form-group">
          <label>Escolher banco</label>
          <div class="preset-grid">
            @for (b of bankPresets; track b.name) {
              <button type="button" class="preset-btn" [class.selected]="acc.logo === b.logo"
                      (click)="applyPreset(acc, b)" [title]="b.name">
                @if (b.logo) {
                  <div class="preset-wrap"><img [src]="b.logo" [alt]="b.name" class="preset-logo"
                       (error)="onLogoError($event, b.color, b.name, b.fallback)"/></div>
                } @else {
                  <div class="preset-initial" [style.background]="b.color">{{ b.name[0] }}</div>
                }
                <span class="preset-label">{{ b.name }}</span>
              </button>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex1">
            <label>Nome da conta</label>
            <input [(ngModel)]="acc.name" class="input" placeholder="Ex: Nubank, Conta Principal…" />
            <span class="input-hint">Dê um nome para identificar esta conta</span>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select [(ngModel)]="acc.type" class="input">
              @for (t of accTypes; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label>Saldo inicial</label>
            <input [(ngModel)]="acc.balance" type="text" inputmode="decimal" appMoneyMask class="input" placeholder="0,00" />
          </div>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" [(ngModel)]="acc.exclude_from_total" />
          Não somar no Saldo Geral
        </label>
        <div class="modal-foot">
          @if (editingAcc) {
            <button class="btn-archive" (click)="archiveAcc(editingAcc)">Arquivar conta</button>
          }
          <button class="btn-save" [disabled]="!acc.name" (click)="saveAcc()">
            {{ editingAcc ? 'Salvar' : 'Adicionar conta' }}
          </button>
        </div>
      }

      @if (formMode() === 'card') {
        <!-- CARD FORM -->
        <div class="form-group">
          <label>Escolher banco</label>
          <div class="preset-grid">
            @for (b of bankPresets; track b.name) {
              <button type="button" class="preset-btn" [class.selected]="card.logo === b.logo"
                      (click)="applyPreset(card, b)" [title]="b.name">
                @if (b.logo) {
                  <div class="preset-wrap"><img [src]="b.logo" [alt]="b.name" class="preset-logo"
                       (error)="onLogoError($event, b.color, b.name, b.fallback)"/></div>
                } @else {
                  <div class="preset-initial" [style.background]="b.color">{{ b.name[0] }}</div>
                }
                <span class="preset-label">{{ b.name }}</span>
              </button>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex1">
            <label>Nome do cartão</label>
            <input [(ngModel)]="card.name" class="input" placeholder="Ex: Nubank, Inter…" />
            <span class="input-hint">Dê um nome para identificar este cartão</span>
          </div>
          <div class="form-group">
            <label>Limite (R$)</label>
            <input [(ngModel)]="card.limit" type="text" inputmode="decimal" appMoneyMask class="input" placeholder="0,00" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fecha dia</label>
            <select [(ngModel)]="card.closing_day" class="input">
              <option [value]="null">--</option>
              @for (d of days; track d) { <option [value]="d">{{ d }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label>Vence dia</label>
            <select [(ngModel)]="card.due_day" class="input">
              <option [value]="null">--</option>
              @for (d of days; track d) { <option [value]="d">{{ d }}</option> }
            </select>
          </div>
          <div class="form-group flex1">
            <label>Conta de pagamento padrão</label>
            <select [(ngModel)]="card.account_id" class="input">
              <option [value]="null">Nenhuma</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
            </select>
          </div>
        </div>
        <div class="modal-foot">
          @if (editingCard) {
            <button class="btn-archive" (click)="archiveCard(editingCard)">Arquivar cartão</button>
          }
          <button class="btn-save" [disabled]="!card.name" (click)="saveCard()">
            {{ editingCard ? 'Salvar' : 'Adicionar cartão' }}
          </button>
        </div>
      }
    </div>
  </div>
}

<!-- ── ADJUST BALANCE MODAL ── -->
@if (adjustOpen()) {
  <div class="modal-overlay" (click)="adjustOpen.set(false)">
    <div class="modal modal--sm" (click)="$event.stopPropagation()">
      <div class="modal-head">
        <h2>Ajustar saldo</h2>
        <button class="modal-close" (click)="adjustOpen.set(false)">✕</button>
      </div>
      <div class="adjust-body">
        <div class="detail-icon" [style.background]="selectedAcc()?.color ?? '#6b7280'">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="55%" height="55%">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H4a2 2 0 0 0-2 2v2"/>
            <path d="M22 12h-4a2 2 0 0 0 0 4h4"/>
          </svg>
        </div>
        <div class="detail-name">{{ selectedAcc()?.name }}</div>
        <p class="adjust-hint">Defina o novo saldo da sua conta</p>
        <input [(ngModel)]="adjustBalance" type="text" inputmode="decimal" appMoneyMask class="input input--center" placeholder="0,00" />
        <p class="adjust-hint">Digite − para saldo negativo</p>
      </div>
      <div class="modal-foot modal-foot--center">
        <button class="btn-save" (click)="saveAdjust()">✓ Confirmar</button>
      </div>
    </div>
  </div>
}

<app-confirm-modal
  [visible]="!!confirmItem()"
  [message]="confirmItem() ? confirmItem()!.msg : ''"
  (confirmed)="doConfirm()"
  (cancelled)="confirmItem.set(null)">
</app-confirm-modal>
  `,
  styles: [`
* { box-sizing: border-box; }
.settings-layout { display: flex; gap: 0; min-height: calc(100vh - 52px); align-items: flex-start; }

/* Sidebar */
.sidebar { width: 200px; flex-shrink: 0; padding: 1.5rem 0; }
.sidebar-group { display: flex; flex-direction: column; }
.sidebar-link {
  display: flex; align-items: center; gap: .35rem;
  padding: .5rem 1rem; color: #374151; font-size: .875rem;
  text-decoration: none; cursor: pointer; border-radius: .375rem;
  transition: background .12s;
}
.sidebar-link:hover { background: #f3f4f6; }
.sidebar-link.active { color: #2e7736; font-weight: 600; }
.bullet { color: #2e7736; font-size: .6rem; }
.sidebar-hr { border: none; border-top: 1px solid #e5e7eb; margin: .75rem 1rem; }

/* Main content */
.main-content { flex: 1; min-width: 0; }
.content-card { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.75rem; }
.content-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.content-title { font-size: 1.35rem; font-weight: 700; color: #111; margin: 0; }
.btn-add {
  display: flex; align-items: center; gap: .35rem;
  background: #d1fae5; color: #065f46; border: none; border-radius: 9999px;
  padding: .45rem 1.1rem; font-size: .82rem; font-weight: 600; cursor: pointer;
  transition: background .15s;
}
.btn-add:hover { background: #a7f3d0; }

/* Flat list */
.flat-list { display: flex; flex-direction: column; }
.flat-item {
  display: flex; align-items: center; gap: .875rem;
  padding: .875rem 0; border-bottom: 1px solid #f3f4f6; cursor: pointer;
  transition: background .12s; border-radius: .375rem; padding-left: .5rem; padding-right: .5rem;
}
.flat-item:last-child { border-bottom: none; }
.flat-item:hover { background: #f9fafb; }
.flat-icon {
  width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #e5e7eb; overflow: hidden;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.flat-icon--card { border-radius: .6rem; }
.flat-logo { width: 70%; height: 70%; object-fit: contain; display: block; }
.flat-info { flex: 1; display: flex; flex-direction: column; gap: .1rem; }
.flat-name { font-size: .92rem; font-weight: 600; color: #111; }
.flat-sub { font-size: .75rem; color: #9ca3af; }
.flat-balance { font-size: .95rem; font-weight: 700; color: #2563eb; white-space: nowrap; }
.flat-chevron { color: #d1d5db; font-size: 1.2rem; font-weight: 300; }

/* Detail view */
.detail-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.btn-back { background: none; border: none; color: #2e7736; font-size: .875rem; font-weight: 600; cursor: pointer; padding: 0; }
.detail-actions { display: flex; gap: 1rem; }
.btn-link { background: none; border: none; font-size: .875rem; font-weight: 600; cursor: pointer; padding: 0; }
.btn-link--green { color: #2e7736; }
.btn-link--red   { color: #ef4444; }
.btn-link--blue  { color: #2563eb; }
.detail-hero { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.detail-icon {
  width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #e5e7eb; overflow: hidden; background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.1);
}
.detail-name { font-size: 1.1rem; font-weight: 700; color: #111; }
.balance-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: .5rem; }
.balance-val { font-size: 1.5rem; font-weight: 700; color: #111; }
.action-cards { display: flex; gap: 1rem; flex-wrap: wrap; }
.action-card {
  flex: 1; min-width: 140px; padding: 1rem; border: 1px solid #e5e7eb; border-radius: .5rem;
  text-decoration: none; color: #374151; font-size: .875rem; font-weight: 500;
  display: flex; align-items: center; gap: .5rem; background: #fff;
  transition: border-color .15s, box-shadow .15s;
}
.action-card:hover { border-color: #2e7736; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.action-icon { font-size: 1rem; }

/* Card detail / invoices */
.invoice-current { padding: 1rem; background: #f9fafb; border-left: 3px solid #2e7736; border-radius: .375rem; margin-bottom: 1.5rem; }
.invoice-current__label { font-size: .72rem; color: #9ca3af; text-transform: uppercase; font-weight: 600; margin-bottom: .25rem; }
.invoice-current__value { font-size: 1.35rem; font-weight: 700; color: #111; }
.invoice-limit { font-size: .75rem; color: #9ca3af; margin-top: .25rem; }
.invoices-section hr { border: none; border-top: 1px solid #e5e7eb; margin: .5rem 0 .75rem; }
.invoices-title { font-size: 1rem; font-weight: 700; color: #111; margin: 0 0 .5rem; }
.invoice-row {
  display: flex; align-items: center; gap: 1rem; padding: .75rem 0;
  border-bottom: 1px solid #f3f4f6; text-decoration: none; color: #374151;
  transition: background .12s; border-radius: .375rem; padding-left: .5rem;
}
.invoice-row:last-child { border-bottom: none; }
.invoice-row:hover { background: #f9fafb; }
.inv-month { flex: 1; font-size: .875rem; font-weight: 500; color: #374151; }
.inv-badge { font-size: .65rem; font-weight: 700; padding: .2rem .6rem; border-radius: 9999px; text-transform: uppercase; }
.inv-badge--paid   { background: #d1fae5; color: #065f46; }
.inv-badge--closed { background: #f3f4f6; color: #6b7280; }
.inv-badge--current{ background: #dbeafe; color: #1d4ed8; }
.inv-val { font-size: .875rem; font-weight: 600; color: #374151; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 600;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.modal {
  background: #fff; border-radius: .75rem; box-shadow: 0 16px 48px rgba(0,0,0,.2);
  width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 1.75rem;
}
.modal--sm { max-width: 380px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.modal-head h2 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #111; }
.modal-close { background: none; border: none; font-size: 1.2rem; color: #9ca3af; cursor: pointer; padding: 0; line-height: 1; }
.modal-close:hover { color: #374151; }
.modal-foot { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid #f3f4f6; margin-top: 1rem; }
.modal-foot--center { justify-content: center; }
.btn-save {
  background: #2e7736; color: #fff; border: none; border-radius: .375rem;
  padding: .55rem 1.5rem; font-size: .875rem; font-weight: 600; cursor: pointer;
}
.btn-save:disabled { opacity: .45; cursor: default; }
.btn-save:not(:disabled):hover { background: #235c29; }
.btn-archive { background: none; border: none; color: #ef4444; font-size: .8rem; font-weight: 600; cursor: pointer; }

/* Form */
.form-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
.form-group { display: flex; flex-direction: column; gap: .3rem; min-width: 140px; }
.flex1 { flex: 1; }
label { font-size: .78rem; font-weight: 500; color: #374151; }
.input { padding: .45rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; width: 100%; }
.input:focus { outline: none; border-color: #2e7736; box-shadow: 0 0 0 3px rgba(46,119,54,.1); }
.input--center { text-align: center; font-size: 1.25rem; font-weight: 600; }
.input-hint { font-size: .72rem; color: #9ca3af; }
.checkbox-row { display: flex; align-items: center; gap: .5rem; font-size: .82rem; color: #374151; margin: .5rem 0 1rem; cursor: pointer; }

/* Preset grid */
.preset-grid { display: flex; flex-wrap: wrap; gap: .5rem; padding: .25rem 0 .75rem; }
.preset-btn {
  display: flex; flex-direction: column; align-items: center; gap: .25rem;
  width: 64px; padding: .4rem .2rem; border-radius: .5rem;
  border: 2px solid transparent; background: #f9fafb; cursor: pointer;
}
.preset-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
.preset-btn.selected { border-color: #2e7736; background: #f0fdf4; }
.preset-wrap {
  width: 38px; height: 38px; border-radius: 50%; background: #fff;
  border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.preset-logo { width: 28px; height: 28px; object-fit: contain; }
.preset-initial { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: .95rem; }
.preset-label { font-size: .58rem; color: #6b7280; text-align: center; max-width: 58px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* Adjust balance */
.adjust-body { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: .5rem 0 1rem; }
.adjust-hint { font-size: .8rem; color: #9ca3af; margin: 0; text-align: center; }

.empty { text-align: center; color: #9ca3af; padding: 2.5rem 1rem; }
  `]
})
export class BankingComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  accounts      = signal<any[]>([]);
  cards         = signal<any[]>([]);
  loadingAccs   = signal(true);
  loadingCards  = signal(true);
  loadingInvoices = signal(false);
  invoices      = signal<any[]>([]);

  section  = signal<'accounts' | 'cards'>('accounts');
  view     = signal<'list' | 'detail'>('list');
  selectedAcc  = signal<any>(null);
  selectedCard = signal<any>(null);

  formOpen = signal(false);
  formMode = signal<'account' | 'card'>('account');
  adjustOpen = signal(false);
  adjustBalance = '';

  editingAcc:  any = null;
  editingCard: any = null;
  acc:  any = {};
  card: any = {};

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  readonly bankPresets = BANK_PRESETS;
  readonly accTypes    = ACCOUNT_TYPES;
  readonly days        = DAYS;

  formTitle() {
    if (this.formMode() === 'account') return this.editingAcc ? 'Editar conta' : 'Nova conta manual';
    return this.editingCard ? 'Editar cartão' : 'Novo cartão manual';
  }

  ngOnInit() { this.loadAccounts(); this.loadCards(); }

  private inferLogo(name: string, logo: string): string {
    if (logo) return logo;
    const n = name.toLowerCase();
    if (n.includes('nubank'))                                       return SI('nubank','8a05be');
    if (n.includes('inter'))                                        return SI('inter','ff7000');
    if (n.includes('itaú') || n.includes('itau'))                  return CL('itau.com.br');
    if (n.includes('bradesco'))                                     return CL('bradesco.com.br');
    if (n.includes('santander'))                                    return SI('santander','ec0000');
    if (n.includes('caixa'))                                        return CL('caixa.gov.br');
    if (n.includes('brasil') || n.includes(' bb'))                  return CL('bb.com.br');
    if (n.includes('c6'))                                           return CL('c6bank.com.br');
    if (n.includes('btg'))                                          return CL('btgpactual.com');
    if (n.includes('mercado pago') || n.includes('mercadopago'))   return SI('mercadopago','009ee3');
    if (n.includes('picpay'))                                       return SI('picpay','21c25e');
    if (n.includes('sicoob'))                                       return CL('sicoob.com.br');
    if (n.includes('sicredi'))                                      return CL('sicredi.com.br');
    if (n.includes('neon'))                                         return CL('neon.com.br');
    if (n.includes('carrefour'))                                    return CL('carrefour.com.br');
    if (n.includes('mercado livre') || n.includes('mercadolivre')) return SI('mercadolivre','009ee3');
    return '';
  }

  normalizeLogo(logo: string): string {
    if (!logo) return '';
    let m = logo.match(/logo\.clearbit\.com\/([^?/]+)/);
    if (m) return DOMAIN_TO_LOGO[m[1]] ?? GF(m[1]);
    m = logo.match(/https?:\/\/([^/]+)\/apple-touch-icon/);
    if (m) { const d = m[1].replace(/^www\./, ''); return DOMAIN_TO_LOGO[d] ?? GF(d); }
    m = logo.match(/favicons\?domain=([^&]+)/);
    if (m) return DOMAIN_TO_LOGO[m[1]] ?? GF(m[1]);
    return logo;
  }

  private map(r: any) { return (r.data ?? []).map((x: any) => ({ ...x, logo: this.inferLogo(x.name, this.normalizeLogo(x.logo)) })); }

  loadAccounts() { this.loadingAccs.set(true); this.api.get<any>('/accounts').subscribe(r => { this.accounts.set(this.map(r)); this.loadingAccs.set(false); }); }
  loadCards()    { this.loadingCards.set(true); this.api.get<any>('/credit-cards').subscribe(r => { this.cards.set(this.map(r)); this.loadingCards.set(false); }); }

  showAccDetail(a: any) { this.selectedAcc.set(a); this.section.set('accounts'); this.view.set('detail'); }
  showCardDetail(c: any) {
    this.selectedCard.set(c); this.section.set('cards'); this.view.set('detail');
    this.loadingInvoices.set(true); this.invoices.set([]);
    this.api.get<any>(`/reports/cards/${c.id}/invoices`).subscribe({
      next: r => { this.invoices.set(r.data ?? []); this.loadingInvoices.set(false); },
      error: () => this.loadingInvoices.set(false),
    });
  }

  currentInvoice() { const inv = this.invoices(); const cur = inv[inv.length - 1]; return cur?.expense ?? 0; }

  formatInvMonth(m: string) {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[+mo - 1]} ${y}`;
  }
  invStatus(inv: any): string {
    const now = new Date();
    const [y, m] = inv.month.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
    if (isCurrentMonth) return 'ATUAL';
    if (inv.expense === 0 && inv.income === 0) return 'SEM MOVIMENTO';
    return inv.net < 0 ? 'PAGA' : 'FECHADA';
  }
  invBadge(inv: any): string {
    const s = this.invStatus(inv);
    if (s === 'ATUAL') return 'inv-badge inv-badge--current';
    if (s === 'PAGA')  return 'inv-badge inv-badge--paid';
    return 'inv-badge inv-badge--closed';
  }

  applyPreset(obj: any, b: typeof BANK_PRESETS[0]) {
    if (b.name !== 'Outro') obj.name = b.name;
    obj.color = b.color; obj.logo = b.logo; obj.fallback = b.fallback;
  }

  onLogoError(event: Event, color: string, name: string, fallback?: string) {
    const img = event.target as HTMLImageElement;
    if (fallback && !img.dataset['triedFallback']) { img.dataset['triedFallback'] = '1'; img.src = fallback; return; }
    const p = img.parentElement!;
    img.style.display = 'none'; p.style.background = color; p.style.border = 'none';
    p.textContent = name[0]; p.style.color = '#fff'; p.style.fontWeight = '700';
    p.style.fontSize = '1.1rem'; p.style.display = 'flex'; p.style.alignItems = 'center'; p.style.justifyContent = 'center';
  }

  // ── Account CRUD ──
  openAccForm() { this.editingAcc = null; this.acc = { name: '', type: 'checking', balance: 0, color: '#6b7280', logo: '', exclude_from_total: false }; this.formMode.set('account'); this.formOpen.set(true); }
  editAcc(a: any) { this.editingAcc = a; this.acc = { ...a }; this.formMode.set('account'); this.formOpen.set(true); }
  saveAcc() {
    const obs = this.editingAcc ? this.api.put(`/accounts/${this.editingAcc.id}`, this.acc) : this.api.post('/accounts', this.acc);
    obs.subscribe({ next: () => { this.toast.show('Conta salva!', 'success'); this.closeForm(); this.loadAccounts(); }, error: () => this.toast.show('Erro.', 'error') });
  }
  archiveAcc(a: any) {
    this.closeForm();
    this.confirmItem.set({ msg: `Arquivar a conta <strong>${a.name}</strong>? Ela não aparecerá mais na lista.`, action: () => {
      this.api.put(`/accounts/${a.id}`, { ...a, is_active: false }).subscribe({ next: () => { this.toast.show('Conta arquivada.', 'success'); this.view.set('list'); this.loadAccounts(); }, error: () => this.toast.show('Erro.', 'error') });
    }});
  }

  // ── Card CRUD ──
  openCardForm() { this.editingCard = null; this.card = { name: '', limit: 0, closing_day: null, due_day: null, account_id: null, color: '#6b7280', logo: '' }; this.formMode.set('card'); this.formOpen.set(true); }
  editCard(c: any) { this.editingCard = c; this.card = { ...c }; this.formMode.set('card'); this.formOpen.set(true); }
  saveCard() {
    const obs = this.editingCard ? this.api.put(`/credit-cards/${this.editingCard.id}`, this.card) : this.api.post('/credit-cards', this.card);
    obs.subscribe({ next: () => { this.toast.show('Cartão salvo!', 'success'); this.closeForm(); this.loadCards(); }, error: () => this.toast.show('Erro.', 'error') });
  }
  archiveCard(c: any) {
    this.closeForm();
    this.confirmItem.set({ msg: `Arquivar o cartão <strong>${c.name}</strong>? Ele não aparecerá mais na lista.`, action: () => {
      this.api.put(`/credit-cards/${c.id}`, { ...c, is_active: false }).subscribe({ next: () => { this.toast.show('Cartão arquivado.', 'success'); this.view.set('list'); this.loadCards(); }, error: () => this.toast.show('Erro.', 'error') });
    }});
  }

  closeForm() { this.formOpen.set(false); }

  openAdjust() { this.adjustBalance = ''; this.adjustOpen.set(true); }
  saveAdjust() {
    const val = parseFloat(this.adjustBalance.replace(/\./g,'').replace(',','.'));
    const a = this.selectedAcc();
    this.api.put(`/accounts/${a.id}`, { ...a, balance: val }).subscribe({
      next: () => { this.toast.show('Saldo ajustado!', 'success'); this.adjustOpen.set(false); const updated = { ...a, balance: val }; this.selectedAcc.set(updated); this.loadAccounts(); },
      error: () => this.toast.show('Erro ao ajustar.', 'error'),
    });
  }

  doConfirm() { const item = this.confirmItem(); this.confirmItem.set(null); item?.action(); }
}
