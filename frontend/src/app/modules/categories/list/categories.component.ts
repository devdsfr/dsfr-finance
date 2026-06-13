import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface Category { id: string; name: string; color: string; icon: string; type: string; }

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>Categorias</h1>
      <button class="btn btn--primary" (click)="openForm()">+ Nova categoria</button>
    </div>

    @if (showForm) {
      <div class="card form-card">
        <h3>{{ editing ? 'Editar' : 'Nova' }} Categoria</h3>
        <div class="form-row">
          <div class="field">
            <label>Nome</label>
            <input class="input" [(ngModel)]="form.name" placeholder="Ex: Alimentação" />
          </div>
          <div class="field">
            <label>Tipo</label>
            <select class="input" [(ngModel)]="form.type">
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
              <option value="transfer">Transferência</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Cor</label>
            <div class="color-row">
              <input type="color" [(ngModel)]="form.color" class="color-picker" />
              <span class="color-preview" [style.background]="form.color">{{ form.name || 'Prévia' }}</span>
            </div>
          </div>
          <div class="field">
            <label>Ícone (emoji)</label>
            <div class="icon-grid">
              @for (ic of icons; track ic) {
                <button type="button" class="icon-btn" [class.icon-btn--selected]="form.icon === ic" (click)="form.icon = ic">{{ ic }}</button>
              }
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn--primary" (click)="save()">Salvar</button>
          <button class="btn btn--ghost" (click)="showForm = false">Cancelar</button>
        </div>
      </div>
    }

    <div class="categories-grid">
      @for (cat of categories(); track cat.id) {
        <div class="cat-card">
          <div class="cat-card__header" [style.background]="cat.color">
            <span class="cat-icon">{{ cat.icon || '📁' }}</span>
            <span class="cat-type">{{ cat.type === 'expense' ? 'Despesa' : cat.type === 'income' ? 'Receita' : 'Transf.' }}</span>
          </div>
          <div class="cat-card__body">
            <span class="cat-name">{{ cat.name }}</span>
            <div class="cat-actions">
              <button class="btn btn--sm btn--ghost" (click)="edit(cat)">✎ Editar</button>
              <button class="btn btn--sm btn--danger" (click)="delete(cat)">✕</button>
            </div>
          </div>
        </div>
      }
      @empty {
        <div class="empty">Nenhuma categoria. Crie a primeira!</div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.25rem; }
    .form-card { margin-bottom: 1rem; }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .field { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: .25rem; }
    label { font-size: .8rem; font-weight: 500; color: #374151; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .color-row { display: flex; align-items: center; gap: .75rem; }
    .color-picker { width: 48px; height: 36px; border: none; padding: 0; cursor: pointer; border-radius: .25rem; }
    .color-preview { padding: .25rem .75rem; border-radius: 9999px; color: #fff; font-size: .82rem; font-weight: 500; }
    .icon-grid { display: flex; flex-wrap: wrap; gap: .35rem; }
    .icon-btn { border: 2px solid transparent; background: #f3f4f6; border-radius: .375rem; padding: .25rem .4rem; cursor: pointer; font-size: 1.1rem; }
    .icon-btn--selected { border-color: #6366f1; background: #eef2ff; }
    .form-actions { display: flex; gap: .5rem; }
    .categories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .cat-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .cat-card__header { padding: 1rem; display: flex; align-items: center; justify-content: space-between; }
    .cat-icon { font-size: 1.5rem; }
    .cat-type { font-size: .7rem; color: rgba(255,255,255,.8); font-weight: 500; }
    .cat-card__body { padding: .75rem; display: flex; justify-content: space-between; align-items: center; }
    .cat-name { font-weight: 500; font-size: .9rem; }
    .cat-actions { display: flex; gap: .25rem; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--primary { background: #6366f1; color: #fff; }
    .btn--ghost { background: none; color: #374151; }
    .btn--danger { background: none; color: #ef4444; }
    .btn--sm { padding: .2rem .4rem; font-size: .75rem; }
    .empty { grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 2rem; }
    h3 { margin: 0 0 1rem; }
  `]
})
export class CategoriesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  categories = signal<Category[]>([]);
  showForm = false;
  editing: Category | null = null;
  form = { name: '', type: 'expense', color: '#6366f1', icon: '📁' };
  icons = ['📁','🍔','🏠','🚗','🎮','💊','📚','✈️','💰','🛒','⚡','📱','💡','🎵','👔','🏋️','🐾','🎁','🍕','☕'];

  ngOnInit() { this.load(); }

  load() {
    this.api.get<any>('/categories').subscribe(r => this.categories.set(r.data ?? []));
  }

  openForm() { this.editing = null; this.form = { name: '', type: 'expense', color: '#6366f1', icon: '📁' }; this.showForm = true; }

  edit(cat: Category) {
    this.editing = cat;
    this.form = { name: cat.name, type: cat.type, color: cat.color || '#6366f1', icon: cat.icon || '📁' };
    this.showForm = true;
  }

  save() {
    const obs = this.editing
      ? this.api.put<any>(`/categories/${this.editing.id}`, this.form)
      : this.api.post<any>('/categories', this.form);
    obs.subscribe(() => {
      this.toast.success(this.editing ? 'Categoria atualizada!' : 'Categoria criada!');
      this.showForm = false;
      this.load();
    });
  }

  delete(cat: Category) {
    if (!confirm(`Excluir "${cat.name}"?`)) return;
    this.api.delete(`/categories/${cat.id}`).subscribe(() => {
      this.toast.success('Categoria excluída.');
      this.load();
    });
  }
}
