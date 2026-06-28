import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';
import { FileUploadComponent } from '../../../shared/components/file-upload/file-upload.component';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';

interface Category { id: string; name: string; type: string; color?: string; icon?: string; }
interface Account  { id: string; name: string; logo?: string; color?: string; }
interface CreditCard { id: string; name: string; logo?: string; color?: string; brand?: string; }

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TagInputComponent, FileUploadComponent, MoneyMaskDirective],
  template: `
    <div class="overlay" (click)="goBack()">
      <div class="modal" (click)="$event.stopPropagation()">

        <!-- Type toggle -->
        <div class="type-bar">
          @for (t of types; track t.value) {
            <button type="button" class="type-btn"
                    [class.type-btn--expense]="t.value === 'expense' && form.type === t.value"
                    [class.type-btn--income]="t.value === 'income' && form.type === t.value"
                    [class.type-btn--transfer]="t.value === 'transfer' && form.type === t.value"
                    (click)="form.type = t.value">{{ t.label }}</button>
          }
        </div>

        <!-- Header -->
        <div class="modal-header">
          <h2>{{ formTitle }}</h2>
          <button type="button" class="close-btn" (click)="goBack()">✕</button>
        </div>

        <form (ngSubmit)="save()" autocomplete="off">

          <!-- Description -->
          <input [(ngModel)]="form.description" name="description" required
                 class="desc-input" placeholder="Descrição" autofocus />

          <!-- Amount + Date -->
          <div class="amount-date-row">
            <div class="amount-wrap">
              <span class="currency-prefix">R$</span>
              <input [(ngModel)]="form.amount" name="amount" type="text" inputmode="decimal"
                     appMoneyMask class="amount-input" placeholder="0,00" required />
            </div>
            <div class="date-wrap">
              <input [(ngModel)]="form.date" name="date" type="date" class="date-input" required />
              <button type="button" class="paid-toggle"
                      [class.paid-toggle--active]="form.paid"
                      [title]="form.type === 'income' ? 'Recebido' : 'Pago'"
                      (click)="form.paid = !form.paid">👍</button>
            </div>
          </div>

          <!-- Account/Card chips -->
          <div class="chip-row" (click)="toggleAcc()">
            @if (selectedAccount) {
              <span class="chip chip--account">
                @if (selectedAccount.logo) {
                  <img class="chip-logo" [src]="selectedAccount.logo" [alt]="selectedAccount.name" (error)="onAccLogoError($event, selectedAccount)" />
                } @else {
                  <span class="chip-dot" [style.background]="selectedAccount.color || '#6366f1'"></span>
                }
                {{ selectedAccount.name }}
                <button type="button" class="chip-x"
                        (click)="$event.stopPropagation(); form.account_id = ''">×</button>
              </span>
            }
            @if (form.type === 'expense' && selectedCard) {
              <span class="chip chip--card">
                @if (selectedCard.logo) {
                  <img class="chip-logo" [src]="selectedCard.logo" [alt]="selectedCard.name" (error)="onCardLogoError($event, selectedCard)" />
                } @else {
                  <span class="chip-dot" [style.background]="selectedCard.color || '#f59e0b'"></span>
                }
                {{ selectedCard.name }}
                <button type="button" class="chip-x"
                        (click)="$event.stopPropagation(); form.credit_card_id = ''">×</button>
              </span>
            }
            @if (!selectedAccount) {
              <span class="chip-placeholder">+ Conta/Cartão</span>
            }
          </div>
          @if (accOpen()) {
            <div class="acc-dropdown" (click)="$event.stopPropagation()">
              @if (accounts().length) {
                <div class="acc-section-title">Contas</div>
                @for (a of accounts(); track a.id) {
                  <div class="acc-item" [class.acc-item--active]="form.account_id === a.id"
                       (click)="form.account_id = a.id; accOpen.set(false)">
                    @if (a.logo) {
                      <img class="acc-logo" [src]="a.logo" [alt]="a.name" (error)="onAccLogoError($event, a)" />
                    } @else {
                      <span class="acc-dot" [style.background]="a.color || '#6366f1'"></span>
                    }
                    {{ a.name }}
                  </div>
                }
              }
              @if (form.type === 'expense' && cards().length) {
                <div class="acc-section-title">Cartões de Crédito</div>
                @for (c of cards(); track c.id) {
                  <div class="acc-item" [class.acc-item--active]="form.credit_card_id === c.id"
                       (click)="form.credit_card_id = c.id; accOpen.set(false)">
                    @if (c.logo) {
                      <img class="acc-logo" [src]="c.logo" [alt]="c.name" (error)="onCardLogoError($event, c)" />
                    } @else {
                      <span class="acc-dot" [style.background]="c.color || '#f59e0b'"></span>
                    }
                    {{ c.name }}
                  </div>
                }
              }
            </div>
          }

          <!-- Category -->
          <div class="cat-select" [class.cat-select--open]="catOpen()" (click)="toggleCat()">
            <div class="cat-trigger">
              @if (selectedCategory()) {
                <span class="cat-chip">{{ catIcon(selectedCategory()) }}</span>
                <span>{{ selectedCategory()!.name }}</span>
              } @else {
                <span class="cat-placeholder">Buscar a categoria..</span>
              }
              <span class="cat-chevron">▾</span>
            </div>
            @if (catOpen()) {
              <div class="cat-dropdown" (click)="$event.stopPropagation()">
                <input class="cat-search" [(ngModel)]="catSearchVal" name="catSearch"
                       placeholder="Buscar categoria..." />
                <div class="cat-list">
                  <div class="cat-item" (click)="selectCat('')">
                    <span class="cat-chip cat-chip--none">—</span>
                    Sem categoria
                  </div>
                  @for (cat of filteredCats(); track cat.id) {
                    <div class="cat-item" [class.cat-item--active]="form.category_id === cat.id"
                         (click)="selectCat(cat.id)">
                      <span class="cat-chip">{{ catIcon(cat) }}</span>
                      {{ cat.name }}
                    </div>
                  }
                </div>
                @if (!newCatMode) {
                  <div class="cat-footer" (click)="newCatMode = true">
                    <span class="cat-add-btn">＋ Nova categoria</span>
                  </div>
                } @else {
                  <div class="cat-new-form">
                    <div class="cat-new-row">
                      <div class="cat-new-icons">
                        @for (opt of catIconOpts; track opt.icon) {
                          <button type="button" class="cat-icon-btn"
                                  [class.cat-icon-btn--sel]="newCat.icon === opt.icon"
                                  [style.background]="newCat.icon === opt.icon ? newCat.color : '#f3f4f6'"
                                  (click)="newCat.icon = opt.icon">{{ opt.icon }}</button>
                        }
                      </div>
                    </div>
                    <div class="cat-new-row">
                      <input class="cat-new-input" [(ngModel)]="newCat.name" name="newCatName"
                             placeholder="Nome da categoria" />
                      <div class="cat-colors">
                        @for (col of catColors; track col) {
                          <button type="button" class="cat-color-dot"
                                  [style.background]="col"
                                  [class.cat-color-dot--sel]="newCat.color === col"
                                  (click)="newCat.color = col"></button>
                        }
                      </div>
                    </div>
                    <div class="cat-new-actions">
                      <button type="button" class="cat-new-cancel" (click)="newCatMode = false">Cancelar</button>
                      <button type="button" class="cat-new-save" [disabled]="!newCat.name" (click)="createCat()">Criar</button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="section-divider"></div>

          <!-- Bottom action icons -->
          <div class="action-bar">
            @if (form.type === 'expense') {
              <button type="button" class="action-btn" [class.action-btn--active]="showRepeat"
                      (click)="showRepeat = !showRepeat">
                <span class="action-icon">⟲</span>
                <span class="action-label">Repetir</span>
              </button>
            }
            <button type="button" class="action-btn" [class.action-btn--active]="showNotes"
                    (click)="showNotes = !showNotes">
              <span class="action-icon">💬</span>
              <span class="action-label">Observação</span>
            </button>
            <button type="button" class="action-btn" [class.action-btn--active]="showAttachment"
                    (click)="showAttachment = !showAttachment">
              <span class="action-icon">📎</span>
              <span class="action-label">Anexo</span>
            </button>
            <button type="button" class="action-btn" [class.action-btn--active]="showTags"
                    (click)="showTags = !showTags">
              <span class="action-icon">🏷️</span>
              <span class="action-label">Tags</span>
            </button>
          </div>

          <!-- Expanded sections -->
          @if (showRepeat && form.type === 'expense') {
            <div class="expanded">
              <label class="exp-label">Parcelamento</label>
              <div class="installment-row">
                <input [(ngModel)]="form.installments" name="installments" type="number"
                       min="1" max="48" class="inst-input" />
                <span class="inst-label">parcelas</span>
              </div>
              @if ((form.installments ?? 1) > 1) {
                <div class="inst-preview">
                  Valor por parcela: <strong>R$ {{ installmentAmount | number:'1.2-2' }}</strong>
                  — impacto nas próximas {{ form.installments }} faturas
                </div>
              }
            </div>
          }
          @if (showNotes) {
            <div class="expanded">
              <textarea [(ngModel)]="form.notes" name="notes" class="notes-input"
                        placeholder="Adicione uma observação..."></textarea>
            </div>
          }
          @if (showAttachment) {
            <div class="expanded">
              <app-file-upload (fileSelected)="onFileSelected($event)"></app-file-upload>
              @if (form.attachment_name) {
                <small class="att-name">📎 {{ form.attachment_name }}</small>
              }
            </div>
          }
          @if (showTags) {
            <div class="expanded">
              <app-tag-input [(selected)]="form.tags" [description]="form.description"></app-tag-input>
            </div>
          }

          <!-- FAB Save -->
          <div class="fab-row">
            <button type="submit" class="fab-save"
                    [class.fab-save--income]="form.type === 'income'"
                    [class.fab-save--transfer]="form.type === 'transfer'"
                    [disabled]="saving()">
              {{ saving() ? '…' : '✓' }}
            </button>
          </div>

        </form>
      </div>
    </div>
  `,
  styles: [`
    /* ── Overlay ── */
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 1rem;
    }
    .modal {
      background: #fff; border-radius: 1rem;
      width: 100%; max-width: 460px;
      max-height: 90vh; overflow-y: auto;
      box-shadow: 0 24px 48px rgba(0,0,0,.22);
      padding: 0 0 1.5rem;
    }

    /* ── Type bar ── */
    .type-bar {
      display: flex; border-bottom: 1px solid #f3f4f6;
      border-radius: 1rem 1rem 0 0; overflow: hidden;
    }
    .type-btn {
      flex: 1; padding: .6rem; font-size: .8rem; font-weight: 600;
      border: none; background: #f9fafb; cursor: pointer; color: #6b7280;
      transition: background .15s, color .15s;
    }
    .type-btn--expense  { background: #fee2e2; color: #dc2626; }
    .type-btn--income   { background: #dcfce7; color: #16a34a; }
    .type-btn--transfer { background: #dbeafe; color: #2563eb; }

    /* ── Header ── */
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem .5rem;
    }
    .modal-header h2 { font-size: 1.1rem; font-weight: 700; color: #111827; margin: 0; }
    .close-btn {
      width: 28px; height: 28px; border-radius: 50%; border: none;
      background: #f3f4f6; color: #6b7280; cursor: pointer;
      font-size: .9rem; display: flex; align-items: center; justify-content: center;
    }
    .close-btn:hover { background: #e5e7eb; }

    /* ── Description ── */
    .desc-input {
      display: block; width: 100%; padding: .625rem 1.25rem;
      border: none; border-bottom: 1px solid #f3f4f6;
      font-size: 1rem; color: #111827; outline: none;
      box-sizing: border-box;
    }
    .desc-input:focus { border-bottom-color: #22c55e; }
    .desc-input::placeholder { color: #d1d5db; }

    /* ── Amount + Date ── */
    .amount-date-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .75rem 1.25rem; border-bottom: 1px solid #f3f4f6;
    }
    .amount-wrap {
      display: flex; align-items: center; gap: .25rem; flex: 1;
    }
    .currency-prefix { font-size: .85rem; color: #9ca3af; font-weight: 500; }
    .amount-input {
      border: none; outline: none; font-size: 1.25rem; font-weight: 700;
      color: #111827; width: 100%; background: transparent;
    }
    .amount-input::placeholder { color: #d1d5db; font-weight: 400; }
    .date-wrap { display: flex; align-items: center; gap: .5rem; }
    .date-input {
      border: 1px solid #e5e7eb; border-radius: .5rem; padding: .375rem .5rem;
      font-size: .85rem; color: #374151; outline: none;
    }
    .date-input:focus { border-color: #22c55e; }
    .paid-toggle {
      background: #f3f4f6; border: none; border-radius: 50%;
      width: 32px; height: 32px; cursor: pointer; font-size: 1rem;
      display: flex; align-items: center; justify-content: center;
      opacity: .4; transition: opacity .15s, background .15s;
    }
    .paid-toggle--active { opacity: 1; background: #dcfce7; }

    /* ── Account chips ── */
    .chip-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
      padding: .75rem 1.25rem; border-bottom: 1px solid #f3f4f6; cursor: pointer;
      min-height: 48px;
    }
    .chip {
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .3rem .6rem .3rem .5rem; border-radius: 2rem;
      font-size: .8rem; font-weight: 600;
    }
    .chip--account { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .chip--card    { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .chip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .chip-logo { width: 18px; height: 18px; border-radius: 50%; object-fit: contain; flex-shrink: 0; background: #f3f4f6; }
    .chip-x {
      background: none; border: none; cursor: pointer; padding: 0;
      font-size: .95rem; color: inherit; opacity: .6; line-height: 1;
    }
    .chip-x:hover { opacity: 1; }
    .chip-placeholder { font-size: .85rem; color: #9ca3af; }

    /* ── Account dropdown ── */
    .acc-dropdown {
      margin: 0 1.25rem; border: 1px solid #e5e7eb; border-radius: .5rem;
      background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.1); overflow: hidden;
      z-index: 100; position: relative;
    }
    .acc-section-title {
      padding: .4rem .75rem; font-size: .7rem; font-weight: 700;
      text-transform: uppercase; color: #9ca3af; background: #f9fafb;
    }
    .acc-item {
      display: flex; align-items: center; gap: .5rem;
      padding: .5rem .75rem; font-size: .875rem; cursor: pointer;
    }
    .acc-item:hover { background: #f9fafb; }
    .acc-item--active { background: #f0fdf4; font-weight: 600; }
    .acc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .acc-logo { width: 22px; height: 22px; border-radius: 50%; object-fit: contain; flex-shrink: 0; background: #f3f4f6; border: 1px solid #e5e7eb; }

    /* ── Category ── */
    .cat-select {
      margin: 0; border-bottom: 1px solid #f3f4f6;
      position: relative; cursor: pointer; user-select: none;
    }
    .cat-select--open { background: #fafafa; }
    .cat-trigger {
      display: flex; align-items: center; gap: .5rem;
      padding: .75rem 1.25rem; font-size: .875rem; min-height: 48px;
    }
    .cat-chevron { margin-left: auto; color: #9ca3af; font-size: .75rem; }
    .cat-placeholder { color: #9ca3af; }
    .cat-chip {
      width: 28px; height: 28px; border-radius: 50%; display: inline-flex;
      align-items: center; justify-content: center; font-size: .9rem;
      flex-shrink: 0; line-height: 1; background: #f3f4f6;
    }
    .cat-chip--none { background: #f3f4f6; color: #9ca3af; }
    .cat-dropdown {
      position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 200;
      background: #fff; border: 1px solid #e5e7eb; border-radius: .5rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); overflow: hidden;
    }
    .cat-search {
      width: 100%; padding: .5rem .75rem; border: none; border-bottom: 1px solid #f3f4f6;
      font-size: .875rem; outline: none; box-sizing: border-box;
    }
    .cat-list { max-height: 220px; overflow-y: auto; }
    .cat-item {
      display: flex; align-items: center; gap: .625rem; padding: .45rem .75rem;
      font-size: .875rem; cursor: pointer; transition: background .1s;
    }
    .cat-item:hover { background: #f9fafb; }
    .cat-item--active { background: #f0fdf4; font-weight: 600; }
    .cat-footer { border-top: 1px solid #f3f4f6; padding: .5rem .75rem; }
    .cat-add-btn {
      display: inline-flex; align-items: center; gap: .25rem;
      font-size: .8rem; color: #16a34a; cursor: pointer; font-weight: 600;
    }
    .cat-new-form { border-top: 1px solid #f3f4f6; padding: .75rem; display: flex; flex-direction: column; gap: .5rem; }
    .cat-new-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .cat-new-icons { display: flex; gap: .25rem; flex-wrap: wrap; }
    .cat-icon-btn {
      width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; font-size: .95rem; display: flex; align-items: center; justify-content: center;
    }
    .cat-icon-btn--sel { border-color: #16a34a; }
    .cat-new-input {
      flex: 1; min-width: 120px; padding: .35rem .6rem; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .85rem; outline: none;
    }
    .cat-new-input:focus { border-color: #16a34a; }
    .cat-colors { display: flex; gap: .3rem; flex-wrap: wrap; }
    .cat-color-dot {
      width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
    }
    .cat-color-dot--sel { border-color: #111; box-shadow: 0 0 0 2px #fff inset; }
    .cat-new-actions { display: flex; justify-content: flex-end; gap: .5rem; }
    .cat-new-cancel { background: none; border: 1px solid #d1d5db; border-radius: .375rem; padding: .3rem .75rem; font-size: .8rem; cursor: pointer; }
    .cat-new-save { background: #16a34a; color: #fff; border: none; border-radius: .375rem; padding: .3rem .75rem; font-size: .8rem; cursor: pointer; font-weight: 600; }
    .cat-new-save:disabled { opacity: .5; cursor: default; }

    /* ── Divider ── */
    .section-divider { height: 1px; background: #f3f4f6; margin: .5rem 0; }

    /* ── Action bar ── */
    .action-bar {
      display: flex; align-items: center; justify-content: space-around;
      padding: .5rem 1.25rem;
    }
    .action-btn {
      display: flex; flex-direction: column; align-items: center; gap: .2rem;
      background: none; border: none; cursor: pointer; padding: .4rem .6rem;
      border-radius: .5rem; transition: background .1s;
    }
    .action-btn:hover { background: #f3f4f6; }
    .action-btn--active { background: #f0fdf4; }
    .action-icon { font-size: 1.25rem; line-height: 1; }
    .action-label { font-size: .7rem; color: #6b7280; font-weight: 500; }
    .action-btn--active .action-label { color: #16a34a; }

    /* ── Expanded sections ── */
    .expanded {
      margin: 0 1.25rem .75rem; padding: .75rem;
      background: #f9fafb; border-radius: .5rem;
      display: flex; flex-direction: column; gap: .5rem;
    }
    .exp-label { font-size: .8rem; font-weight: 600; color: #374151; }
    .installment-row { display: flex; align-items: center; gap: .5rem; }
    .inst-input {
      width: 64px; padding: .375rem .5rem; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .875rem; text-align: center;
    }
    .inst-label { font-size: .875rem; color: #374151; }
    .inst-preview {
      font-size: .8rem; color: #6b7280; padding: .4rem .6rem;
      background: #eff6ff; border-radius: .375rem;
    }
    .notes-input {
      width: 100%; padding: .5rem .6rem; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .875rem; resize: vertical;
      min-height: 72px; box-sizing: border-box; outline: none;
    }
    .notes-input:focus { border-color: #22c55e; }
    .att-name { font-size: .8rem; color: #6b7280; }

    /* ── FAB ── */
    .fab-row {
      display: flex; justify-content: center; padding: 1rem 1.25rem 0;
    }
    .fab-save {
      width: 56px; height: 56px; border-radius: 50%; border: none;
      background: #16a34a; color: #fff; font-size: 1.5rem; font-weight: 700;
      cursor: pointer; box-shadow: 0 4px 16px rgba(22,163,74,.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform .1s, box-shadow .1s;
    }
    .fab-save:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(22,163,74,.5); }
    .fab-save:disabled { opacity: .6; cursor: default; transform: none; }
    .fab-save--income   { background: #16a34a; }
    .fab-save--transfer { background: #2563eb; box-shadow: 0 4px 16px rgba(37,99,235,.4); }
  `]
})
export class TransactionFormComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  isEdit  = false;
  saving  = signal(false);
  categories = signal<Category[]>([]);
  accounts   = signal<Account[]>([]);
  cards      = signal<CreditCard[]>([]);

  types = [
    { value: 'expense',  label: 'Despesa' },
    { value: 'income',   label: 'Receita' },
    { value: 'transfer', label: 'Transferência' },
  ];

  form: any = {
    type: 'expense', description: '', amount: null,
    date: new Date().toISOString().slice(0, 10),
    account_id: '', credit_card_id: '', category_id: '',
    notes: '', paid: false, installments: 1, tags: [], attachment_name: null
  };

  get formTitle(): string {
    if (this.form.type === 'income')   return this.isEdit ? 'Editar Receita'     : 'Nova Receita';
    if (this.form.type === 'transfer') return this.isEdit ? 'Editar Transferência': 'Nova Transferência';
    return this.isEdit ? 'Editar Despesa' : 'Nova Despesa';
  }

  get installmentAmount(): number {
    return this.form.amount ? this.form.amount / (this.form.installments || 1) : 0;
  }

  get selectedAccount() { return this.accounts().find(a => a.id === this.form.account_id) ?? null; }
  get selectedCard()    { return this.cards().find(c => c.id === this.form.credit_card_id) ?? null; }

  /* ── Account picker ── */
  accOpen = signal(false);
  toggleAcc() { this.accOpen.update(v => !v); this.catOpen.set(false); }

  /* ── Category picker ── */
  catOpen    = signal(false);
  newCatMode = false;
  newCat: any = { name: '', color: '#16a34a', icon: '●' };
  catSearchVal = '';

  catIconOpts = [
    { icon: '🍽️' }, { icon: '🛒' }, { icon: '🏠' }, { icon: '🚌' }, { icon: '💊' },
    { icon: '🎮' }, { icon: '💼' }, { icon: '✈️' }, { icon: '📱' }, { icon: '💳' },
    { icon: '🎓' }, { icon: '🐾' }, { icon: '👔' }, { icon: '🎁' }, { icon: '📈' },
    { icon: '☰' },
  ];

  catColors = [
    '#ef4444','#f97316','#f59e0b','#22c55e','#16a34a',
    '#3b82f6','#6366f1','#8b5cf6','#ec4899','#6b7280','#111827',
  ];

  filteredCats = computed(() => {
    const q = this.catSearchVal.toLowerCase().trim();
    return q ? this.categories().filter(c => c.name.toLowerCase().includes(q)) : this.categories();
  });

  selectedCategory = computed(() =>
    this.categories().find(c => c.id === this.form.category_id) ?? null
  );

  /* ── Expandable sections ── */
  showRepeat     = false;
  showNotes      = false;
  showAttachment = false;
  showTags       = false;

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.cat-select')) this.catOpen.set(false);
    if (!t.closest('.chip-row') && !t.closest('.acc-dropdown')) this.accOpen.set(false);
  }

  toggleCat() {
    this.catOpen.update(v => !v);
    this.accOpen.set(false);
  }

  selectCat(id: string) {
    this.form.category_id = id;
    this.catSearchVal = '';
    this.catOpen.set(false);
    this.newCatMode = false;
  }

  createCat() {
    if (!this.newCat.name) return;
    this.api.post<any>('/categories', {
      name: this.newCat.name, color: this.newCat.color,
      icon: this.newCat.icon, type: 'expense'
    }).subscribe(() => {
      this.api.get<any>('/categories').subscribe(res => {
        this.categories.set(res.data ?? []);
        const created = (res.data ?? []).find((c: any) => c.name === this.newCat.name);
        if (created) this.form.category_id = created.id;
        this.newCatMode = false;
        this.newCat = { name: '', color: '#16a34a', icon: '●' };
        this.catOpen.set(false);
      });
    });
  }

  private readonly CAT_META: Record<string, { icon: string; color: string }> = {
    'alimentação':       { icon: '🍽️', color: '#ef4444' },
    'assinaturas':       { icon: '📱', color: '#8b5cf6' },
    'bares':             { icon: '🍷', color: '#7c3aed' },
    'cartão de crédito': { icon: '💳', color: '#f59e0b' },
    'casa':              { icon: '🏠', color: '#3b82f6' },
    'compras':           { icon: '🛍️', color: '#ec4899' },
    'cuidados pessoais': { icon: '💆', color: '#f472b6' },
    'dívidas':           { icon: '💰', color: '#dc2626' },
    'educação':          { icon: '🎓', color: '#1e40af' },
    'família':           { icon: '👨‍👩‍👧', color: '#22c55e' },
    'impostos':          { icon: '📋', color: '#f87171' },
    'investimentos':     { icon: '📈', color: '#a855f7' },
    'lazer':             { icon: '🎮', color: '#16a34a' },
    'mercado':           { icon: '🛒', color: '#f97316' },
    'outros':            { icon: '☰', color: '#6b7280' },
    'pets':              { icon: '🐾', color: '#d97706' },
    'presentes':         { icon: '🎁', color: '#6366f1' },
    'roupas':            { icon: '👔', color: '#fb923c' },
    'saúde':             { icon: '➕', color: '#3b82f6' },
    'trabalho':          { icon: '💼', color: '#2563eb' },
    'transporte':        { icon: '🚌', color: '#38bdf8' },
    'viagem':            { icon: '✈️', color: '#f87171' },
  };

  onAccLogoError(event: Event, a: Account) {
    (event.target as HTMLImageElement).style.display = 'none';
    a.logo = '';
  }
  onCardLogoError(event: Event, c: CreditCard) {
    (event.target as HTMLImageElement).style.display = 'none';
    c.logo = '';
  }

  catIcon(cat: any): string {
    if (!cat) return '●';
    if (cat.icon) return cat.icon;
    const n = (cat.name ?? '').toLowerCase();
    for (const [k, v] of Object.entries(this.CAT_META)) if (n.includes(k)) return v.icon;
    return '●';
  }

  catColor(cat: any): string {
    if (!cat) return '#6b7280';
    if (cat.color) return cat.color;
    const n = (cat.name ?? '').toLowerCase();
    for (const [k, v] of Object.entries(this.CAT_META)) if (n.includes(k)) return v.color;
    return '#6b7280';
  }

  private inferLogo(name: string): string {
    const GF = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
    const SI = (s: string, col: string) => `https://cdn.simpleicons.org/${s}/${col}`;
    const n = (name ?? '').toLowerCase();
    if (n.includes('nubank'))                                        return SI('nubank','8a05be');
    if (n.includes('inter'))                                         return GF('inter.co');
    if (n.includes('itaú') || n.includes('itau'))                   return GF('itau.com.br');
    if (n.includes('bradesco'))                                      return GF('bradesco.com.br');
    if (n.includes('santander'))                                     return GF('santander.com.br');
    if (n.includes('caixa'))                                         return GF('caixa.gov.br');
    if (n.includes('brasil') || n.includes(' bb'))                   return GF('bb.com.br');
    if (n.includes('c6'))                                            return GF('c6bank.com.br');
    if (n.includes('btg'))                                           return GF('btgpactual.com');
    if (n.includes('xp'))                                            return GF('xpi.com.br');
    if (n.includes('mercado pago') || n.includes('mercadopago'))     return SI('mercadopago','009ee3');
    if (n.includes('picpay'))                                        return SI('picpay','21c25e');
    if (n.includes('sicoob'))                                        return GF('sicoob.com.br');
    if (n.includes('sicredi'))                                       return GF('sicredi.com.br');
    if (n.includes('neon'))                                          return GF('neon.com.br');
    return '';
  }

  ngOnInit(): void {
    this.api.get<any>('/categories').subscribe(r => this.categories.set(r.data ?? []));
    this.api.get<any>('/accounts').subscribe(r => this.accounts.set((r.data ?? []).map((a: any) => ({ ...a, logo: a.logo || this.inferLogo(a.name) }))));
    this.api.get<any>('/credit-cards').subscribe(r => this.cards.set((r.data ?? []).map((cc: any) => ({ ...cc, logo: cc.logo || this.inferLogo(cc.name) }))));

    const typeParam = this.route.snapshot.queryParamMap.get('type');
    if (typeParam && ['expense','income','transfer'].includes(typeParam)) {
      this.form.type = typeParam;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.api.get<any>(`/transactions/${id}`).subscribe(tx => {
        this.form = { ...tx, installments: 1, tags: tx.tags ?? [] };
      });
    }

    const duplicateId = this.route.snapshot.queryParamMap.get('duplicate');
    if (duplicateId) {
      this.api.get<any>(`/transactions/${duplicateId}`).subscribe(tx => {
        this.form = { ...tx, id: null, date: new Date().toISOString().slice(0, 10), installments: 1, tags: tx.tags ?? [] };
      });
    }
  }

  goBack(): void { this.router.navigate(['/transactions']); }

  onFileSelected(file: File | null): void {
    this.form.attachment_name = file ? file.name : null;
  }

  save(): void {
    this.saving.set(true);
    const tagIDs = (this.form.tags ?? []).map((t: any) => t.id);
    const payload = {
      ...this.form,
      tag_ids: tagIDs,
      account_id:     this.form.account_id     || null,
      credit_card_id: this.form.credit_card_id || null,
      category_id:    this.form.category_id    || null,
    };

    const req = this.isEdit
      ? this.api.put<any>(`/transactions/${this.form.id}`, payload)
      : this.api.post<any>('/transactions', payload);

    req.subscribe({
      next: () => {
        this.toast.success(this.isEdit ? 'Lançamento atualizado!' : 'Lançamento criado!');
        this.router.navigate(['/transactions']);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar');
        this.saving.set(false);
      }
    });
  }
}
