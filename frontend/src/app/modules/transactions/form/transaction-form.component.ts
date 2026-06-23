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
interface Account { id: string; name: string; }
interface CreditCard { id: string; name: string; }

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TagInputComponent, FileUploadComponent, MoneyMaskDirective],
  template: `
    <div class="form-page">
      <h1>{{ isEdit ? 'Editar Lançamento' : 'Novo Lançamento' }}</h1>

      <div class="tabs">
        @for (t of types; track t.value) {
          <button class="tab" [class.tab--active]="form.type === t.value" type="button"
                  (click)="form.type = t.value">{{ t.label }}</button>
        }
      </div>

      <form (ngSubmit)="save()" class="form">
        <div class="form-row">
          <div class="form-group">
            <label>Descrição *</label>
            <input [(ngModel)]="form.description" name="description" required class="input"
                   placeholder="Ex: Supermercado" />
          </div>
          <div class="form-group form-group--sm">
            <label>Valor *</label>
            <input [(ngModel)]="form.amount" name="amount" type="text" inputmode="decimal" appMoneyMask required class="input" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Data *</label>
            <input [(ngModel)]="form.date" name="date" type="date" required class="input" />
          </div>
          <div class="form-group">
            <label>Conta</label>
            <select [(ngModel)]="form.account_id" name="account_id" class="input">
              <option value="">Selecione</option>
              @for (a of accounts(); track a.id) {
                <option [value]="a.id">{{ a.name }}</option>
              }
            </select>
          </div>
          @if (form.type === 'expense') {
            <div class="form-group">
              <label>Cartão de Crédito</label>
              <select [(ngModel)]="form.credit_card_id" name="credit_card_id" class="input">
                <option value="">Nenhum</option>
                @for (c of cards(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
          }
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Categoria</label>
            <div class="cat-select" [class.cat-select--open]="catOpen()" (click)="toggleCat()">
              <div class="cat-trigger">
                @if (selectedCategory()) {
                  <span class="cat-chip" [style.background]="catColor(selectedCategory())">{{ catIcon(selectedCategory()) }}</span>
                  <span>{{ selectedCategory()!.name }}</span>
                } @else {
                  <span class="cat-placeholder">Sem categoria</span>
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
                        <span class="cat-chip" [style.background]="catColor(cat)">{{ catIcon(cat) }}</span>
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
          </div>
        </div>

        <!-- AC-UX-05: Parcelamento -->
        @if (form.type === 'expense') {
          <div class="form-group installment-group">
            <label>Parcelamento</label>
            <div class="installment-controls">
              <input [(ngModel)]="form.installments" name="installments" type="number"
                     min="1" max="48" class="input input--sm" />
              <span>parcelas</span>
            </div>
            @if ((form.installments ?? 1) > 1) {
              <div class="installment-preview">
                <span>Valor por parcela: <strong>R$ {{ installmentAmount | number:'1.2-2' }}</strong></span>
                <small>Impacto nas próximas {{ form.installments }} faturas</small>
              </div>
            }
          </div>
        }

        <!-- AC-UX-03: Observações -->
        <div class="form-group">
          <label>Observações</label>
          <textarea [(ngModel)]="form.notes" name="notes" class="input input--textarea"
                    placeholder="Notas adicionais sobre este lançamento..."></textarea>
        </div>

        <!-- AC-TG-04: Tags as first-class field -->
        <div class="form-group">
          <label>Tags</label>
          <app-tag-input
            [(selected)]="form.tags"
            [description]="form.description">
          </app-tag-input>
        </div>

        <!-- AC-UX-04: Comprovante -->
        <div class="form-group">
          <label>Comprovante</label>
          <app-file-upload (fileSelected)="onFileSelected($event)"></app-file-upload>
          @if (form.attachment_name) {
            <small>Atual: {{ form.attachment_name }}</small>
          }
        </div>

        <div class="form-group form-group--check">
          <input [(ngModel)]="form.paid" name="paid" type="checkbox" id="paid" />
          <label for="paid">{{ form.type === 'income' ? 'Já recebido' : 'Já pago' }}</label>
        </div>

        <div class="form-actions">
          <a routerLink="/transactions" class="btn btn--ghost">Cancelar</a>
          <button type="submit" class="btn btn--primary" [disabled]="saving()">
            {{ saving() ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-page { max-width: 680px; margin: 0 auto; }
    .tabs { display: flex; gap: .25rem; margin-bottom: 1.5rem; }
    .tab { padding: .5rem 1.25rem; border-radius: .375rem; border: 1px solid #d1d5db;
           background: #fff; cursor: pointer; font-size: .875rem; }
    .tab--active { background: #6366f1; color: #fff; border-color: #6366f1; }
    .form { display: flex; flex-direction: column; gap: 1rem; }
    .form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .form-group { display: flex; flex-direction: column; gap: .25rem; flex: 1; }
    .form-group--sm { max-width: 140px; }
    .form-group--check { flex-direction: row; align-items: center; gap: .5rem; }
    .input { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; width: 100%; box-sizing: border-box; }
    .input--textarea { resize: vertical; min-height: 80px; }
    .input--sm { max-width: 80px; }
    .installment-group .installment-controls { display: flex; align-items: center; gap: .5rem; }
    .installment-preview { background: #eff6ff; padding: .5rem .75rem; border-radius: .375rem; font-size: .85rem; margin-top: .25rem; }
    .form-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: .5rem; }
    .btn { padding: .5rem 1.25rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .875rem; }
    .btn--primary { background: #6366f1; color: #fff; }
    .btn--ghost { background: none; color: #374151; }
    label { font-size: .875rem; font-weight: 500; color: #374151; }

    /* Category custom dropdown */
    .cat-select {
      position: relative; border: 1px solid #d1d5db; border-radius: .375rem;
      background: #fff; cursor: pointer; user-select: none;
    }
    .cat-select--open { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.15); }
    .cat-trigger {
      display: flex; align-items: center; gap: .5rem; padding: .5rem .75rem;
      font-size: .875rem; min-height: 38px;
    }
    .cat-chevron { margin-left: auto; color: #9ca3af; font-size: .75rem; }
    .cat-placeholder { color: #9ca3af; }
    .cat-chip {
      width: 28px; height: 28px; border-radius: 50%; display: inline-flex;
      align-items: center; justify-content: center; font-size: .9rem;
      flex-shrink: 0; line-height: 1;
    }
    .cat-chip--none { background: #f3f4f6; color: #9ca3af; }
    .cat-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 200;
      background: #fff; border: 1px solid #e5e7eb; border-radius: .5rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); overflow: hidden;
    }
    .cat-search {
      width: 100%; padding: .5rem .75rem; border: none; border-bottom: 1px solid #f3f4f6;
      font-size: .875rem; outline: none; box-sizing: border-box;
    }
    .cat-list { max-height: 260px; overflow-y: auto; }
    .cat-item {
      display: flex; align-items: center; gap: .625rem; padding: .45rem .75rem;
      font-size: .875rem; cursor: pointer; transition: background .1s;
    }
    .cat-item:hover { background: #f9fafb; }
    .cat-item--active { background: #eff6ff; font-weight: 600; }
    .cat-footer { border-top: 1px solid #f3f4f6; padding: .5rem .75rem; }
    .cat-add-btn {
      display: inline-flex; align-items: center; gap: .25rem;
      font-size: .8rem; color: #6366f1; cursor: pointer; font-weight: 600;
    }
    .cat-add-btn:hover { color: #4f46e5; }
    .cat-new-form { border-top: 1px solid #f3f4f6; padding: .75rem; display: flex; flex-direction: column; gap: .5rem; }
    .cat-new-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .cat-new-icons { display: flex; gap: .25rem; flex-wrap: wrap; }
    .cat-icon-btn {
      width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; font-size: .95rem; display: flex; align-items: center; justify-content: center;
    }
    .cat-icon-btn--sel { border-color: #6366f1; }
    .cat-new-input {
      flex: 1; min-width: 120px; padding: .35rem .6rem; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .85rem; outline: none;
    }
    .cat-new-input:focus { border-color: #6366f1; }
    .cat-colors { display: flex; gap: .3rem; flex-wrap: wrap; }
    .cat-color-dot {
      width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
    }
    .cat-color-dot--sel { border-color: #111; box-shadow: 0 0 0 2px #fff inset; }
    .cat-new-actions { display: flex; justify-content: flex-end; gap: .5rem; }
    .cat-new-cancel { background: none; border: 1px solid #d1d5db; border-radius: .375rem; padding: .3rem .75rem; font-size: .8rem; cursor: pointer; }
    .cat-new-save { background: #6366f1; color: #fff; border: none; border-radius: .375rem; padding: .3rem .75rem; font-size: .8rem; cursor: pointer; font-weight: 600; }
    .cat-new-save:disabled { opacity: .5; cursor: default; }
  `]
})
export class TransactionFormComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  saving = signal(false);
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);
  cards = signal<CreditCard[]>([]);

  types = [
    { value: 'expense', label: 'Despesa' },
    { value: 'income', label: 'Receita' },
    { value: 'transfer', label: 'Transferência' },
  ];

  form: any = {
    type: 'expense', description: '', amount: null, date: new Date().toISOString().slice(0, 10),
    account_id: '', credit_card_id: '', category_id: '', notes: '', paid: false,
    installments: 1, tags: [], attachment_name: null
  };

  get installmentAmount(): number {
    return this.form.amount ? this.form.amount / (this.form.installments || 1) : 0;
  }

  catOpen    = signal(false);
  newCatMode = false;
  newCat: any = { name: '', color: '#6366f1', icon: '●' };

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
  catSearchVal = '';

  filteredCats = computed(() => {
    const q = this.catSearchVal.toLowerCase().trim();
    return q ? this.categories().filter(c => c.name.toLowerCase().includes(q)) : this.categories();
  });

  selectedCategory = computed(() =>
    this.categories().find(c => c.id === this.form.category_id) ?? null
  );

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest('.cat-select');
    if (!el) this.catOpen.set(false);
  }

  toggleCat() { this.catOpen.update(v => !v); }

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
    }).subscribe(r => {
      // Reload categories then select the new one
      this.api.get<any>('/categories').subscribe(res => {
        this.categories.set(res.data ?? []);
        const created = (res.data ?? []).find((c: any) => c.name === this.newCat.name);
        if (created) this.form.category_id = created.id;
        this.newCatMode = false;
        this.newCat = { name: '', color: '#6366f1', icon: '●' };
        this.catOpen.set(false);
      });
    });
  }

  private readonly CAT_META: Record<string, { icon: string; color: string }> = {
    'alimentação':        { icon: '🍽️', color: '#ef4444' },
    'assinaturas':        { icon: '📱', color: '#8b5cf6' },
    'bares':              { icon: '🍷', color: '#7c3aed' },
    'cartão de crédito':  { icon: '💳', color: '#f59e0b' },
    'casa':               { icon: '🏠', color: '#3b82f6' },
    'compras':            { icon: '🛍️', color: '#ec4899' },
    'cuidados pessoais':  { icon: '💆', color: '#f472b6' },
    'dívidas':            { icon: '💰', color: '#dc2626' },
    'educação':           { icon: '🎓', color: '#1e40af' },
    'família':            { icon: '👨‍👩‍👧', color: '#22c55e' },
    'impostos':           { icon: '📋', color: '#f87171' },
    'investimentos':      { icon: '📈', color: '#a855f7' },
    'lazer':              { icon: '🎮', color: '#16a34a' },
    'mercado':            { icon: '🛒', color: '#f97316' },
    'outros':             { icon: '☰', color: '#6b7280' },
    'pets':               { icon: '🐾', color: '#d97706' },
    'presentes':          { icon: '🎁', color: '#6366f1' },
    'roupas':             { icon: '👔', color: '#fb923c' },
    'saúde':              { icon: '➕', color: '#3b82f6' },
    'trabalho':           { icon: '💼', color: '#2563eb' },
    'transporte':         { icon: '🚌', color: '#38bdf8' },
    'viagem':             { icon: '✈️', color: '#f87171' },
  };

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

  ngOnInit(): void {
    this.api.get<any>('/categories').subscribe(r => this.categories.set(r.data ?? []));
    this.api.get<any>('/accounts').subscribe(r => this.accounts.set(r.data ?? []));
    this.api.get<any>('/credit-cards').subscribe(r => this.cards.set(r.data ?? []));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.api.get<any>(`/transactions/${id}`).subscribe(tx => {
        this.form = { ...tx, installments: 1, tags: tx.tags ?? [] };
      });
    }

    // AC-UX-06: pre-fill form when duplicating
    const duplicateId = this.route.snapshot.queryParamMap.get('duplicate');
    if (duplicateId) {
      this.api.get<any>(`/transactions/${duplicateId}`).subscribe(tx => {
        this.form = { ...tx, id: null, date: new Date().toISOString().slice(0, 10), installments: 1, tags: tx.tags ?? [] };
      });
    }
  }

  onFileSelected(file: File | null): void {
    if (file) this.form.attachment_name = file.name;
    else this.form.attachment_name = null;
  }

  save(): void {
    this.saving.set(true);
    const tagIDs = (this.form.tags ?? []).map((t: any) => t.id);
    const payload = { ...this.form, tag_ids: tagIDs };

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
