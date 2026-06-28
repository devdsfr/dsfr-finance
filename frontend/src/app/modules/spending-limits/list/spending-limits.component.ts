import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-spending-limits',
  standalone: true,
  imports: [CommonModule, FormsModule, MoneyMaskDirective, ConfirmModalComponent],
  template: `
    <!-- AC-LG-07..11 -->
    <div class="page-header">
      <h1>Limites de Gastos</h1>
      <button class="btn btn--primary" (click)="showForm = true">+ Novo Limite</button>
    </div>

    @if (showForm) {
      <div class="card form-card">
        <h3>{{ editing ? 'Editar Limite' : 'Novo Limite' }}</h3>
        <form (ngSubmit)="save()" class="form">
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de limite</label>
              <select [(ngModel)]="form.limitType" name="limitType" class="input">
                <!-- AC-LG-09: subcategory -->
                <option value="category">Categoria / Subcategoria</option>
                <!-- AC-LG-10: bank account -->
                <option value="account">Conta bancária</option>
                <!-- AC-LG-11: credit card -->
                <option value="card">Cartão de crédito</option>
              </select>
            </div>
            @if (form.limitType === 'category') {
              <div class="form-group">
                <label>Categoria</label>
                <select [(ngModel)]="form.category_id" name="category_id" class="input">
                  <option value="">Selecione</option>
                  @for (c of categories(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
            }
            @if (form.limitType === 'account') {
              <div class="form-group">
                <label>Conta</label>
                <select [(ngModel)]="form.account_id" name="account_id" class="input">
                  @for (a of accounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </div>
            }
            @if (form.limitType === 'card') {
              <div class="form-group">
                <label>Cartão</label>
                <select [(ngModel)]="form.credit_card_id" name="credit_card_id" class="input">
                  @for (c of cards(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
            }
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Valor limite</label>
              <input [(ngModel)]="form.amount" name="amount" type="text" inputmode="decimal" appMoneyMask class="input" />
            </div>
            <div class="form-group">
              <label>Período</label>
              <select [(ngModel)]="form.period" name="period" class="input">
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <!-- AC-LG-07: configurable alert percentage -->
            <div class="form-group">
              <label>Alertar em (%)</label>
              <input [(ngModel)]="form.alert_pct" name="alert_pct" type="number" min="1" max="100" class="input" />
              <small>Padrão: 80%</small>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn--ghost" (click)="cancelForm()">Cancelar</button>
            <button type="submit" class="btn btn--primary">Salvar</button>
          </div>
        </form>
      </div>
    }

    <div class="limits-list">
      @if (loading()) {
        @for (i of [1,2,3]; track i) {
          <div class="limit-card">
            <div class="limit-card__info">
              <div class="skel-block skel-h3 skel-w-40" style="margin-bottom:.3rem"></div>
              <div class="skel-block skel-p skel-w-25"></div>
            </div>
            <div class="limit-card__progress" style="flex:1">
              <div class="skel-block" style="height:.75rem;border-radius:.375rem;width:100%"></div>
            </div>
          </div>
        }
      }
      @for (l of limits(); track l.id) {
        <div class="limit-card">
          <div class="limit-card__info">
            <div class="limit-card__title">{{ limitTitle(l) }}</div>
            <div class="limit-card__period">{{ l.period === 'monthly' ? 'Mensal' : 'Anual' }}</div>
          </div>
          <div class="limit-card__progress">
            <div class="progress-bar">
              <div class="progress-bar__fill"
                   [style.width.%]="barWidth(l)"
                   [class.progress-bar__fill--warning]="isWarning(l)"
                   [class.progress-bar__fill--danger]="isDanger(l)">
              </div>
            </div>
            <div class="progress-bar__labels">
              <span>R$ {{ l.current_spend | number:'1.2-2' }} de R$ {{ l.amount | number:'1.2-2' }}</span>
              <!-- AC-LG-07/08: visual alert -->
              @if (l.usage_pct >= 100) {
                <span class="alert alert--danger">⚠ Limite ultrapassado!</span>
              } @else if (l.usage_pct >= l.alert_pct) {
                <span class="alert alert--warning">⚠ {{ l.usage_pct | number:'1.0-0' }}% atingido</span>
              }
            </div>
          </div>
          <div class="limit-card__actions">
            <button class="btn btn--ghost btn--sm" (click)="edit(l)">✎</button>
            <button class="btn btn--danger btn--sm" (click)="delete(l)">✕</button>
          </div>
        </div>
      } @empty {
        <div class="empty">Nenhum limite configurado.</div>
      }
    </div>

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      (confirmed)="doDelete()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; margin-bottom: 1.5rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.5rem; }
    .form-card { margin-bottom: 1.5rem; }
    .form { display: flex; flex-direction: column; gap: 1rem; }
    .form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .form-group { display: flex; flex-direction: column; gap: .25rem; flex: 1; }
    .input { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .form-actions { display: flex; justify-content: flex-end; gap: .75rem; }
    .limits-list { display: flex; flex-direction: column; gap: .75rem; }
    .limit-card { background: #fff; border-radius: .5rem; padding: 1rem 1.25rem;
                  box-shadow: 0 1px 3px rgba(0,0,0,.07); display: flex; align-items: center; gap: 1.5rem; }
    .limit-card__info { min-width: 160px; }
    .limit-card__title { font-weight: 500; font-size: .9rem; }
    .limit-card__period { font-size: .78rem; color: #6b7280; }
    .limit-card__progress { flex: 1; }
    .progress-bar { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; margin-bottom: .35rem; }
    .progress-bar__fill { height: 100%; background: #22c55e; border-radius: 4px; transition: width .3s; }
    .progress-bar__fill--warning { background: #f59e0b; }
    .progress-bar__fill--danger { background: #ef4444; }
    .progress-bar__labels { display: flex; justify-content: space-between; font-size: .78rem; color: #6b7280; }
    .alert { font-weight: 600; }
    .alert--warning { color: #d97706; }
    .alert--danger { color: #dc2626; }
    .limit-card__actions { display: flex; gap: .25rem; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--primary { background: #6366f1; color: #fff; }
    .btn--ghost { background: none; color: #374151; }
    .btn--danger { background: none; color: #ef4444; }
    .btn--sm { padding: .2rem .5rem; font-size: .78rem; }
    .empty { text-align: center; color: #9ca3af; padding: 2rem; }
  `]
})
export class SpendingLimitsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  limits = signal<any[]>([]);
  categories = signal<any[]>([]);
  accounts = signal<any[]>([]);
  cards = signal<any[]>([]);
  showForm = false;
  editing: any = null;

  Math = Math;

  form: any = { limitType: 'category', category_id: '', account_id: '', credit_card_id: '',
                amount: null, period: 'monthly', alert_pct: 80 };

  ngOnInit(): void {
    this.load();
    this.api.get<any>('/categories').subscribe(r => this.categories.set(r.data ?? []));
    this.api.get<any>('/accounts').subscribe(r => this.accounts.set(r.data ?? []));
    this.api.get<any>('/credit-cards').subscribe(r => this.cards.set(r.data ?? []));
  }

  load(): void {
    this.loading.set(true);
    this.api.get<any>('/spending-limits').subscribe(r => { this.limits.set(r.data ?? []); this.loading.set(false); });
  }

  limitTitle(l: any): string {
    if (l.category_id) return this.categories().find(c => c.id === l.category_id)?.name ?? 'Categoria';
    if (l.account_id) return this.accounts().find(a => a.id === l.account_id)?.name ?? 'Conta';
    if (l.credit_card_id) return this.cards().find(c => c.id === l.credit_card_id)?.name ?? 'Cartão';
    return 'Limite global';
  }

  edit(l: any): void {
    this.editing = l;
    this.form = { ...l, limitType: l.category_id ? 'category' : l.account_id ? 'account' : 'card' };
    this.showForm = true;
  }

  save(): void {
    const payload: any = { amount: this.form.amount, period: this.form.period, alert_pct: this.form.alert_pct };
    if (this.form.limitType === 'category') payload.category_id = this.form.category_id || null;
    if (this.form.limitType === 'account') payload.account_id = this.form.account_id || null;
    if (this.form.limitType === 'card') payload.credit_card_id = this.form.credit_card_id || null;

    const req = this.editing
      ? this.api.put<any>(`/spending-limits/${this.editing.id}`, payload)
      : this.api.post<any>('/spending-limits', payload);

    req.subscribe(() => {
      this.toast.success('Limite salvo!');
      this.cancelForm();
      this.load();
    });
  }

  cancelForm(): void { this.showForm = false; this.editing = null; }

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  delete(l: any): void {
    this.confirmItem.set({ msg: `Tem certeza que deseja excluir o limite <strong>${l.category_name || 'selecionado'}</strong>?`, action: () => {
      this.api.delete(`/spending-limits/${l.id}`).subscribe(() => {
        this.toast.success('Limite excluído.');
        this.load();
      });
    }});
  }

  doDelete() {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }
  barWidth(l: any): number {
    const pct = +(l.usage_pct ?? 0);
    return isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  }
  isWarning(l: any): boolean {
    const pct = +(l.usage_pct ?? 0);
    const alert = +(l.alert_pct ?? 80);
    return !isNaN(pct) && pct >= alert && pct < 100;
  }
  isDanger(l: any): boolean {
    const pct = +(l.usage_pct ?? 0);
    return !isNaN(pct) && pct >= 100;
  }

}
