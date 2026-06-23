import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';
import { FileUploadComponent } from '../../../shared/components/file-upload/file-upload.component';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';

interface Category { id: string; name: string; type: string; }
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
            <select [(ngModel)]="form.category_id" name="category_id" class="input">
              <option value="">Sem categoria</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
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
