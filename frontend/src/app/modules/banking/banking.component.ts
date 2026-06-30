import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';

// asset: local SVG in assets/banks/ (hasBg = SVG already has a background color)
// siSlug: Simple Icons CDN fallback for banks without local SVG
// hasBg true  → show SVG full-size as rounded square (built-in background)
// hasBg false → show SVG on white background with border
const BANK_PRESETS = [
  { name: 'Nubank',           color: '#8a05be', asset: 'nubank.svg',      hasBg: true,  siSlug: '' },
  { name: 'Inter',            color: '#ff7000', asset: 'inter.svg',       hasBg: false, siSlug: '' },
  { name: 'Itaú',             color: '#003d8f', asset: 'itau.svg',        hasBg: true,  siSlug: '' },
  { name: 'Bradesco',         color: '#cc092f', asset: 'bradesco.svg',    hasBg: false, siSlug: '' },
  { name: 'Santander',        color: '#ec0000', asset: 'santander.svg',   hasBg: true,  siSlug: '' },
  { name: 'Caixa',            color: '#005ca9', asset: 'caixa.svg',       hasBg: false, siSlug: '' },
  { name: 'Banco do Brasil',  color: '#f9dd16', asset: 'bb.svg',          hasBg: true,  siSlug: '' },
  { name: 'C6 Bank',          color: '#242424', asset: 'c6bank.svg',      hasBg: false, siSlug: '' },
  { name: 'BTG',              color: '#002060', asset: 'btg.svg',         hasBg: false, siSlug: '' },
  { name: 'XP',               color: '#111111', asset: 'xp.svg',          hasBg: false, siSlug: '' },
  { name: 'Mercado Pago',     color: '#009ee3', asset: 'mercadopago.svg', hasBg: false, siSlug: '' },
  { name: 'Mercado Livre',    color: '#ffe600', asset: '',                hasBg: false, siSlug: 'mercadolibre' },
  { name: 'PicPay',           color: '#21c25e', asset: 'picpay.svg',      hasBg: false, siSlug: '' },
  { name: 'Sicoob',           color: '#007a3d', asset: 'sicoob.svg',      hasBg: false, siSlug: '' },
  { name: 'Sicredi',          color: '#009a44', asset: 'sicredi.svg',     hasBg: false, siSlug: '' },
  { name: 'Neon',             color: '#7900df', asset: 'neon.svg',        hasBg: false, siSlug: '' },
  { name: 'Stone',            color: '#00a868', asset: 'stone.svg',       hasBg: false, siSlug: '' },
  { name: 'PagBank',          color: '#f5a700', asset: 'pagbank.svg',     hasBg: false, siSlug: '' },
  { name: 'Visa',             color: '#1a1f71', asset: '',                hasBg: false, siSlug: 'visa' },
  { name: 'Mastercard',       color: '#eb001b', asset: '',                hasBg: false, siSlug: 'mastercard' },
  { name: 'American Express', color: '#2e77bc', asset: '',                hasBg: false, siSlug: 'americanexpress' },
  { name: 'Outro',            color: '#6b7280', asset: '',                hasBg: false, siSlug: '', emoji: '💳' },
];

// Used when loading cards from DB to determine if asset has built-in bg
const ASSET_HAS_BG: Record<string, boolean> = {
  'nubank.svg': true, 'itau.svg': true, 'santander.svg': true, 'bb.svg': true,
};

const ACCOUNT_ICON_PRESETS = [
  { name: 'Carteira',     color: '#10b981', emoji: '👛' },
  { name: 'Banco',        color: '#3b82f6', emoji: '🏦' },
  { name: 'Poupança',     color: '#f59e0b', emoji: '🐷' },
  { name: 'Dinheiro',     color: '#22c55e', emoji: '💵' },
  { name: 'Investimento', color: '#8b5cf6', emoji: '📈' },
  { name: 'Cofre',        color: '#64748b', emoji: '🏛️' },
  { name: 'Empresa',      color: '#0ea5e9', emoji: '🏢' },
  { name: 'Cartão',       color: '#ec4899', emoji: '💳' },
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

const DAYS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31];

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
          <button class="btn-add" (click)="openAccForm()">👛 Nova conta</button>
        </div>
        @if (accounts().length === 0 && !loadingAccs()) {
          <div class="empty">Nenhuma conta cadastrada.</div>
        }
        <div class="flat-list">
          @for (a of accounts(); track a.id) {
            <div class="flat-item" (click)="showAccDetail(a)">
              <div class="flat-icon">
                @if (a.logo) {
                  <img [src]="a.logo" [alt]="a.name" class="flat-logo"
                       (error)="onLogoError($event, a.color || '#6b7280', a.name)" />
                } @else if (a.emoji) {
                  <div class="emoji-circle" [style.background]="a.color || '#6b7280'">{{ a.emoji }}</div>
                } @else {
                  <div class="emoji-circle" [style.background]="a.color || '#6b7280'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="60%" height="60%">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H4a2 2 0 0 0-2 2v2"/>
                      <path d="M22 12h-4a2 2 0 0 0 0 4h4"/>
                    </svg>
                  </div>
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
            <button class="btn-link btn-link--red" (click)="archiveAcc(selectedAcc())">Excluir</button>
          </div>
        </div>
        <div class="detail-hero">
          <div class="detail-icon">
            @if (selectedAcc()?.logo) {
              <img [src]="selectedAcc()!.logo" [alt]="selectedAcc()!.name" class="flat-logo" />
            } @else if (selectedAcc()?.emoji) {
              <div class="emoji-circle emoji-circle--lg" [style.background]="selectedAcc()!.color || '#6b7280'">{{ selectedAcc()!.emoji }}</div>
            } @else {
              <div class="emoji-circle emoji-circle--lg" [style.background]="selectedAcc()!.color || '#6b7280'">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="60%" height="60%">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H4a2 2 0 0 0-2 2v2"/>
                  <path d="M22 12h-4a2 2 0 0 0 0 4h4"/>
                </svg>
              </div>
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
              <div class="flat-icon flat-icon--card"
                   [class.flat-icon--hasbg]="c.hasBg"
                   [style.background]="c.hasBg ? 'transparent' : (c.siSlug ? (c.color||'#6366f1') : '#fff')"
                   [style.border-color]="(c.hasBg || c.siSlug) ? 'transparent' : '#e5e7eb'">
                @if (c.asset) {
                  <img [src]="'assets/banks/' + c.asset" [alt]="c.name"
                       [class.flat-logo--full]="c.hasBg" [class.flat-logo]="!c.hasBg" />
                } @else if (c.siSlug) {
                  <img [src]="'https://cdn.simpleicons.org/' + c.siSlug + '/ffffff'" [alt]="c.name" class="flat-logo"
                       (error)="onSiError($event)" />
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
            <button class="btn-link btn-link--red" (click)="archiveCard(selectedCard())">Excluir</button>
          </div>
        </div>
        <div class="detail-hero">
          <div class="flat-icon flat-icon--card"
               [class.flat-icon--hasbg]="selectedCard()?.hasBg"
               [style.background]="selectedCard()?.hasBg ? 'transparent' : (selectedCard()?.siSlug ? (selectedCard()?.color||'#6366f1') : '#fff')"
               [style.border-color]="(selectedCard()?.hasBg || selectedCard()?.siSlug) ? 'transparent' : '#e5e7eb'">
            @if (selectedCard()?.asset) {
              <img [src]="'assets/banks/' + selectedCard()!.asset" [alt]="selectedCard()!.name"
                   [class.flat-logo--full]="selectedCard()?.hasBg" [class.flat-logo]="!selectedCard()?.hasBg" />
            } @else if (selectedCard()?.siSlug) {
              <img [src]="'https://cdn.simpleicons.org/' + selectedCard()!.siSlug + '/ffffff'" [alt]="selectedCard()!.name" class="flat-logo" (error)="onSiError($event)" />
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
          <label>Tipo de ícone</label>
          <div class="preset-grid">
            @for (p of accountIconPresets; track p.name) {
              <button type="button" class="preset-btn" [class.selected]="acc.color === p.color && !acc.logo"
                      (click)="applyIconPreset(acc, p)" [title]="p.name">
                <div class="preset-emoji" [style.background]="p.color">{{ p.emoji }}</div>
                <span class="preset-label">{{ p.name }}</span>
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
              <button type="button" class="preset-btn" [class.selected]="card.asset === b.asset && card.color === b.color"
                      (click)="applyPreset(card, b)" [title]="b.name">
                @if (b.asset) {
                  <div class="preset-wrap" [class.preset-wrap--bg]="b.hasBg" [style.background]="b.hasBg ? 'transparent' : '#fff'">
                    <img [src]="'assets/banks/' + b.asset" [alt]="b.name"
                         [class.preset-logo--full]="b.hasBg" [class.preset-logo]="!b.hasBg" />
                  </div>
                } @else if (b.siSlug) {
                  <div class="preset-wrap" [style.background]="b.color">
                    <img [src]="'https://cdn.simpleicons.org/' + b.siSlug + '/ffffff'" [alt]="b.name" class="preset-logo" (error)="onSiError($event)" />
                  </div>
                } @else {
                  <div class="preset-initial" [style.background]="b.color">{{ b['emoji'] || b.name[0] }}</div>
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
            <input [(ngModel)]="card.limit_amount" type="text" inputmode="decimal" appMoneyMask class="input" placeholder="0,00" />
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
        <div class="detail-icon" [style.background]="selectedAcc()?.color || '#6b7280'">
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
.flat-logo--full { width: 100%; height: 100%; object-fit: cover; border-radius: .6rem; display: block; }
.emoji-circle {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem; line-height: 1; flex-shrink: 0;
}
.emoji-circle--lg { width: 42px; height: 42px; font-size: 1.5rem; }
.preset-emoji { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
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
  width: 38px; height: 38px; border-radius: 50%; background: #fff; overflow: hidden;
  border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.preset-logo { width: 28px; height: 28px; object-fit: contain; }
.preset-logo--full { width: 38px; height: 38px; object-fit: cover; border-radius: 50%; display: block; }
.preset-wrap--bg { border-radius: 50%; overflow: hidden; }
.preset-initial { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: .95rem; }
.preset-label { font-size: .58rem; color: #6b7280; text-align: center; max-width: 58px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* Adjust balance */
.adjust-body { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: .5rem 0 1rem; }
.adjust-hint { font-size: .8rem; color: #9ca3af; margin: 0; text-align: center; }

.empty { text-align: center; color: #9ca3af; padding: 2.5rem 1rem; }
  `]
})
export class BankingComponent implements OnInit {
  private api: ApiService     = inject(ApiService);
  private toast: ToastService = inject(ToastService);

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

  readonly bankPresets        = BANK_PRESETS;
  readonly accountIconPresets = ACCOUNT_ICON_PRESETS;
  readonly accTypes           = ACCOUNT_TYPES;
  readonly days               = DAYS;

  formTitle() {
    if (this.formMode() === 'account') return this.editingAcc ? 'Editar conta' : 'Nova conta manual';
    return this.editingCard ? 'Editar cartão' : 'Novo cartão manual';
  }

  ngOnInit() { this.loadAccounts(); this.loadCards(); }

  // Maps accounts: icon column = emoji, logo column = clearbit URL
  private mapAccounts(r: any) {
    return (r.data ?? []).map((x: any) => ({
      ...x,
      color: x.color || '#6b7280',
      emoji: x.icon  || '',
      logo:  this.inferAccLogo(x.name, x.logo || ''),
    }));
  }

  // Maps cards: icon column is either an asset filename (*.svg) or a SI slug
  private mapCards(r: any) {
    return (r.data ?? []).map((x: any) => {
      const rawIcon = x.icon || this.inferCardIcon(x.name);
      const isAsset = rawIcon.endsWith('.svg');
      const asset   = isAsset ? rawIcon : '';
      const siSlug  = isAsset ? '' : rawIcon;
      const hasBg   = isAsset ? (ASSET_HAS_BG[rawIcon] ?? false) : false;
      return { ...x, color: x.color || '#6366f1', asset, siSlug, hasBg };
    });
  }

  // For accounts: infer logo from stored logo column or account name
  private inferAccLogo(name: string, logo: string): string {
    if (logo && logo.startsWith('http')) return logo;
    return '';
  }

  // Infer icon from card name: returns asset filename or SI slug
  private inferCardIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('nubank'))                                       return 'nubank.svg';
    if (n.includes('inter'))                                        return 'inter.svg';
    if (n.includes('itaú') || n.includes('itau'))                  return 'itau.svg';
    if (n.includes('bradesco'))                                     return 'bradesco.svg';
    if (n.includes('santander'))                                    return 'santander.svg';
    if (n.includes('banco do brasil') || n.includes('brasil'))     return 'bb.svg';
    if (n.includes('c6'))                                           return 'c6bank.svg';
    if (n.includes('btg'))                                          return 'btg.svg';
    if (n.includes('caixa'))                                        return 'caixa.svg';
    if (n.includes('mercado pago') || n.includes('mercadopago'))   return 'mercadopago.svg';
    if (n.includes('picpay'))                                       return 'picpay.svg';
    if (n.includes('sicoob'))                                       return 'sicoob.svg';
    if (n.includes('sicredi'))                                      return 'sicredi.svg';
    if (n.includes('neon'))                                         return 'neon.svg';
    if (n.includes('stone'))                                        return 'stone.svg';
    if (n.includes('pagbank') || n.includes('pagseguro'))          return 'pagbank.svg';
    if (n.includes('xp'))                                           return 'xp.svg';
    if (n.includes('mercado livre') || n.includes('mercadolivre')) return 'mercadolibre'; // SI slug
    if (n.includes('visa'))                                         return 'visa';         // SI slug
    if (n.includes('mastercard'))                                   return 'mastercard';   // SI slug
    if (n.includes('american express') || n.includes('amex'))      return 'americanexpress'; // SI slug
    return '';
  }

  loadAccounts() { this.loadingAccs.set(true); this.api.get<any>('/accounts').subscribe((r: any) => { this.accounts.set(this.mapAccounts(r)); this.loadingAccs.set(false); }); }
  loadCards()    { this.loadingCards.set(true); this.api.get<any>('/credit-cards').subscribe((r: any) => { this.cards.set(this.mapCards(r)); this.loadingCards.set(false); }); }

  showAccDetail(a: any) { this.selectedAcc.set(a); this.section.set('accounts'); this.view.set('detail'); }
  showCardDetail(c: any) {
    this.selectedCard.set(c); this.section.set('cards'); this.view.set('detail');
    this.loadingInvoices.set(true); this.invoices.set([]);
    this.api.get<any>(`/reports/cards/${c.id}/invoices`).subscribe({
      next: (r: any) => { this.invoices.set(r.data ?? []); this.loadingInvoices.set(false); },
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
    obj.color = b.color; obj.asset = b.asset; obj.hasBg = b.hasBg; obj.siSlug = b.siSlug; obj.emoji = '';
  }

  applyIconPreset(obj: any, p: typeof ACCOUNT_ICON_PRESETS[0]) {
    obj.color = p.color; obj.logo = ''; obj.emoji = p.emoji;
  }

  onLogoError(event: Event, color: string, name: string) {
    const img = event.target as HTMLImageElement;
    const p = img.parentElement!;
    img.style.display = 'none'; p.style.background = color; p.style.border = 'none';
    p.textContent = name[0]; p.style.color = '#fff'; p.style.fontWeight = '700';
    p.style.fontSize = '1.1rem'; p.style.display = 'flex'; p.style.alignItems = 'center'; p.style.justifyContent = 'center';
  }

  // Fallback for Simple Icons: show first letter of the bank name on colored bg
  onSiError(event: Event) {
    const img = event.target as HTMLImageElement;
    const p = img.parentElement!;
    const initial = (img.alt || '?')[0].toUpperCase();
    img.style.display = 'none';
    p.innerHTML = `<span style="color:#fff;font-weight:700;font-size:1.1rem;line-height:1">${initial}</span>`;
  }

  // ── Account CRUD ──
  openAccForm() { this.editingAcc = null; this.acc = { name: '', type: 'checking', balance: 0, color: '#6b7280', logo: '', exclude_from_total: false }; this.formMode.set('account'); this.formOpen.set(true); }
  editAcc(a: any) { this.editingAcc = a; this.acc = { ...a }; this.formMode.set('account'); this.formOpen.set(true); }
  saveAcc() {
    const payload = { name: this.acc.name, type: this.acc.type, balance: this.acc.balance || 0, currency: this.acc.currency || 'BRL', color: this.acc.color || '', icon: this.acc.emoji || '', logo: this.acc.logo || '' };
    const obs = this.editingAcc ? this.api.put(`/accounts/${this.editingAcc.id}`, payload) : this.api.post('/accounts', payload);
    obs.subscribe({ next: () => { this.toast.show('Conta salva!', 'success'); this.closeForm(); this.loadAccounts(); }, error: (e: any) => this.toast.show(e?.error?.error || 'Erro ao salvar conta.', 'error') });
  }
  archiveAcc(a: any) {
    this.closeForm();
    this.confirmItem.set({ msg: `Excluir a conta <strong>${a.name}</strong>? Essa ação não pode ser desfeita.`, action: () => {
      this.api.delete<any>(`/accounts/${a.id}`).subscribe({ next: () => { this.toast.show('Conta excluída.', 'success'); this.view.set('list'); this.loadAccounts(); }, error: () => this.toast.show('Erro ao excluir.', 'error') });
    }});
  }

  // ── Card CRUD ──
  openCardForm() { this.editingCard = null; this.card = { name: '', limit_amount: 0, closing_day: null, due_day: null, account_id: null, color: '#6b7280', asset: '', hasBg: false, siSlug: '' }; this.formMode.set('card'); this.formOpen.set(true); }
  editCard(c: any) { this.editingCard = c; this.card = { ...c }; this.formMode.set('card'); this.formOpen.set(true); }
  saveCard() {
    const payload = { name: this.card.name, limit_amount: Number(this.card.limit_amount) || 0, closing_day: Number(this.card.closing_day) || 0, due_day: Number(this.card.due_day) || 0, color: this.card.color || '', icon: this.card.asset || this.card.siSlug || '' };
    const obs = this.editingCard ? this.api.put(`/credit-cards/${this.editingCard.id}`, payload) : this.api.post('/credit-cards', payload);
    obs.subscribe({ next: () => { this.toast.show('Cartão salvo!', 'success'); this.closeForm(); this.loadCards(); }, error: (e: any) => this.toast.show(e?.error?.error || 'Erro ao salvar cartão.', 'error') });
  }
  archiveCard(c: any) {
    this.closeForm();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.confirmItem.set({ msg: `Arquivar o cartão <strong>${c.name}</strong>? Ele não aparecerá mais na lista.`, action() {
      self.api.delete<any>(`/credit-cards/${c.id}`).subscribe({ next: () => { self.toast.show('Cartão excluído.', 'success'); self.view.set('list'); self.loadCards(); }, error: () => self.toast.show('Erro ao excluir.', 'error') });
    }});
  }

  closeForm() { this.formOpen.set(false); }

  openAdjust() { this.adjustBalance = ''; this.adjustOpen.set(true); }
  saveAdjust() {
    const val = parseFloat(this.adjustBalance.replace(/\./g,'').replace(',','.'));
    const a: any = this.selectedAcc();
    const api = this.api;
    const toast = this.toast;
    api.put<any>(`/accounts/${a.id}`, { ...(a as object), balance: val }).subscribe({
      next: () => { toast.show('Saldo ajustado!', 'success'); this.adjustOpen.set(false); const updated = { ...(a as object), balance: val }; this.selectedAcc.set(updated); this.loadAccounts(); },
      error: () => toast.show('Erro ao ajustar.', 'error'),
    });
  }

  doConfirm() { const item = this.confirmItem(); this.confirmItem.set(null); item?.action(); }
}
