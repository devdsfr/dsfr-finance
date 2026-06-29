import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

interface Category { id: string; name: string; color: string; icon: string; type: string; }

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  template: `
    <div class="cat-page">

      <!-- Header -->
      <div class="cat-header">
        <h1>Categorias</h1>
        <button class="btn-new" (click)="openForm(activeTab())">
          <span>⊕</span>
          Categoria de {{ activeTab() === 'income' ? 'receita' : 'despesa' }}
        </button>
      </div>

      <!-- Card -->
      <div class="cat-card">
        <div class="tabs">
          <button class="tab" [class.tab--active]="activeTab() === 'expense'"
                  (click)="activeTab.set('expense')">Despesas</button>
          <button class="tab" [class.tab--active]="activeTab() === 'income'"
                  (click)="activeTab.set('income')">Receitas</button>
        </div>

        <div class="cat-list">
          @if (loading()) {
            @for (i of [1,2,3,4,5,6,7]; track i) {
              <div class="cat-row cat-row--skel">
                <span class="skel skel--circle"></span>
                <span class="skel skel--text"></span>
              </div>
            }
          }
          @for (cat of filteredCats(); track cat.id) {
            <div class="cat-row">
              <span class="cat-circle">
                {{ cat.icon || '📁' }}
              </span>
              <span class="cat-name">{{ cat.name }}</span>
              <div class="cat-actions">
                <button class="act-link" (click)="edit(cat)">editar</button>
                <button class="act-link act-link--orange" (click)="askArchive(cat)">arquivar</button>
                <button class="act-link act-link--red" (click)="askDelete(cat)">excluir</button>
              </div>
            </div>
          }
          @if (!loading() && filteredCats().length === 0) {
            <div class="cat-empty">Nenhuma categoria cadastrada.</div>
          }
        </div>
      </div>
    </div>

    <!-- ── Create/Edit Modal ── -->
    @if (showForm) {
      <div class="overlay" (click)="showForm = false">
        <div class="modal" (click)="$event.stopPropagation()">

          <div class="mh">
            <span class="mh-title">{{ editing ? 'Editando' : 'Criando' }} categoria de {{ form.type === 'income' ? 'receita' : 'despesa' }}</span>
            <button class="mh-close" (click)="showForm = false">✕</button>
          </div>

          <div class="kind-row">
            <label class="kind-opt kind-opt--active">
              <span class="kind-radio kind-radio--sel">✓</span>
              Categoria principal
            </label>
            <label class="kind-opt kind-opt--disabled">
              <span class="kind-radio"></span>
              Subcategoria
            </label>
          </div>

          <div class="preview-name-row">
            <span class="preview-circle">
              {{ form.icon }}
            </span>
            <div class="name-field">
              <label class="field-label">Nome da categoria</label>
              <input class="name-input" [(ngModel)]="form.name" placeholder="" autofocus />
            </div>
          </div>

          <div class="section">
            <button type="button" class="section-toggle" (click)="iconOpen = !iconOpen">
              <span>Escolha um ícone</span>
              <span class="toggle-chevron">{{ iconOpen ? '∧' : '∨' }}</span>
            </button>
            @if (iconOpen) {
              <div class="icon-grid">
                @for (ic of icons; track ic) {
                  <button type="button" class="icon-btn"
                          [class.icon-btn--sel]="form.icon === ic"
                          [style.background]="form.icon === ic ? form.color : '#fff'"
                          (click)="form.icon = ic">{{ ic }}</button>
                }
              </div>
            }
          </div>

          <div class="modal-footer">
            <button class="btn-create" [disabled]="!form.name.trim()" (click)="save()">
              {{ editing ? 'Salvar alterações' : 'Criar categoria' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Delete Confirm Modal ── -->
    <app-confirm-modal
      [visible]="!!deleteTarget"
      [message]="deleteTarget ? 'Tem certeza que deseja excluir permanentemente a categoria <strong>' + deleteTarget.name + '</strong>? Os lançamentos vinculados perderão a categoria.' : ''"
      (confirmed)="confirmDelete()"
      (cancelled)="deleteTarget = null">
    </app-confirm-modal>

    <!-- ── Archive Confirm Modal ── -->
    @if (archiveTarget) {
      <div class="overlay" (click)="archiveTarget = null">
        <div class="confirm-modal" (click)="$event.stopPropagation()">
          <button class="mh-close confirm-close" (click)="archiveTarget = null">✕</button>
          <p class="confirm-title">
            Você quer mesmo arquivar a categoria<br>
            <strong>{{ archiveTarget.name }}</strong>?
          </p>
          <p class="confirm-desc">
            Categorias arquivadas não serão exibidas ao criar ou editar um lançamento,
            ok? Também não serão listadas nos filtros. Porém, os lançamentos vinculados
            à categoria arquivada continuam sendo exibidos normalmente em relatórios,
            tela de lançamentos e etc.
          </p>
          <p class="confirm-desc">Você poderá reverter o arquivamento a qualquer momento.</p>
          <button class="btn-archive" (click)="confirmArchive()">arquivar categoria</button>
          <button class="btn-cancel-link" (click)="archiveTarget = null">cancelar</button>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Page ── */
    .cat-page { max-width: 680px; margin: 0 auto; }
    .cat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
    .cat-header h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0; }
    .btn-new {
      display: inline-flex; align-items: center; gap: .375rem;
      padding: .45rem 1rem; border-radius: 2rem; border: 1px solid #16a34a;
      background: #fff; color: #16a34a; font-size: .85rem; font-weight: 600; cursor: pointer;
    }
    .btn-new:hover { background: #f0fdf4; }

    /* ── List card ── */
    .cat-card { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
    .tabs { display: flex; border-bottom: 1px solid #f3f4f6; }
    .tab { flex: 1; padding: .75rem; text-align: center; font-size: .9rem; font-weight: 600; color: #9ca3af; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; }
    .tab--active { color: #16a34a; border-bottom-color: #16a34a; }
    .cat-list { display: flex; flex-direction: column; }
    .cat-row { display: flex; align-items: center; gap: .875rem; padding: .75rem 1.25rem; border-bottom: 1px solid #f9fafb; }
    .cat-row:last-child { border-bottom: none; }
    .cat-row:hover { background: #fafafa; }
    .cat-row--skel { pointer-events: none; }

    .cat-circle {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; background: #f3f4f6;
    }

    .cat-name { flex: 1; font-size: .925rem; font-weight: 500; color: #111827; }
    .cat-actions { display: flex; gap: .875rem; }
    .act-link { font-size: .8rem; color: #3b82f6; background: none; border: none; cursor: pointer; font-weight: 500; padding: 0; }
    .act-link:hover { text-decoration: underline; }
    .act-link--orange { color: #f97316; }
    .act-link--red { color: #ef4444; }
    .cat-empty { padding: 2.5rem; text-align: center; color: #9ca3af; font-size: .9rem; }
    .skel { display: block; background: #f3f4f6; border-radius: .375rem; animation: pulse 1.5s infinite; }
    .skel--circle { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .skel--text { height: 14px; width: 140px; border-radius: 9999px; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

    /* ── Overlay ── */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }

    /* ── Create/Edit Modal ── */
    .modal { background: #fff; border-radius: .875rem; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0,0,0,.2); }
    .mh { display: flex; align-items: center; justify-content: space-between; padding: 1.125rem 1.25rem; border-bottom: 1px solid #f3f4f6; }
    .mh-title { font-size: .95rem; font-weight: 700; color: #111827; }
    .mh-close { width: 28px; height: 28px; border-radius: 50%; border: none; background: #f3f4f6; color: #6b7280; cursor: pointer; font-size: .85rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .kind-row { display: flex; gap: 1.5rem; padding: .875rem 1.25rem; border-bottom: 1px solid #f3f4f6; }
    .kind-opt { display: flex; align-items: center; gap: .5rem; font-size: .875rem; color: #374151; }
    .kind-opt--disabled { color: #9ca3af; }
    .kind-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #d1d5db; display: flex; align-items: center; justify-content: center; font-size: .65rem; flex-shrink: 0; }
    .kind-radio--sel { border-color: #16a34a; background: #16a34a; color: #fff; font-weight: 700; }
    .preview-name-row { display: flex; align-items: flex-end; gap: 1rem; padding: 1.125rem 1.25rem; }
    .preview-circle { width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; background: #f3f4f6; }
    .name-field { flex: 1; display: flex; flex-direction: column; gap: .375rem; }
    .field-label { font-size: .78rem; font-weight: 600; color: #374151; }
    .name-input { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: .5rem; font-size: .9rem; outline: none; width: 100%; box-sizing: border-box; }
    .name-input:focus { border-color: #16a34a; box-shadow: 0 0 0 2px rgba(22,163,74,.15); }
    .section { border-top: 1px solid #f3f4f6; }
    .section-toggle { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: .875rem 1.25rem; background: none; border: none; cursor: pointer; font-size: .875rem; font-weight: 600; color: #374151; }
    .section-toggle:hover { background: #fafafa; }
    .toggle-chevron { color: #9ca3af; }
    .icon-grid { display: flex; flex-wrap: wrap; gap: .375rem; padding: 0 1.25rem .875rem; }
    .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #e5e7eb; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; transition: transform .1s; }
    .icon-btn:hover { transform: scale(1.1); }
    .icon-btn--sel { border-color: transparent; box-shadow: 0 0 0 3px rgba(0,0,0,.12); }
    .color-grid { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0 1.25rem .875rem; }
    .color-dot { width: 34px; height: 34px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; transition: transform .1s; }
    .color-dot:hover { transform: scale(1.1); }
    .color-dot--sel { border-color: #111; box-shadow: 0 0 0 2px #fff inset; }
    .modal-footer { padding: 1rem 1.25rem; border-top: 1px solid #f3f4f6; }
    .btn-create { width: 100%; padding: .65rem; border: none; border-radius: .5rem; background: #d1d5db; color: #fff; font-size: .9rem; font-weight: 700; cursor: default; }
    .btn-create:not(:disabled) { background: #16a34a; cursor: pointer; }
    .btn-create:not(:disabled):hover { background: #15803d; }

    /* ── Archive Confirm Modal ── */
    .confirm-modal {
      background: #fff; border-radius: .875rem; width: 100%; max-width: 400px;
      padding: 2rem 2rem 1.5rem; text-align: center; position: relative;
      box-shadow: 0 24px 48px rgba(0,0,0,.2);
    }
    .confirm-close { position: absolute; top: 1rem; right: 1rem; }
    .confirm-title { font-size: 1rem; color: #111827; line-height: 1.5; margin: 0 0 1rem; }
    .confirm-title strong { display: block; font-size: 1.1rem; }
    .confirm-desc { font-size: .82rem; color: #9ca3af; line-height: 1.6; margin: 0 0 .75rem; }
    .btn-archive {
      display: block; width: 100%; padding: .7rem; border: none; border-radius: .5rem;
      background: #16a34a; color: #fff; font-size: .9rem; font-weight: 700;
      cursor: pointer; margin: 1.25rem 0 .5rem;
    }
    .btn-archive:hover { background: #15803d; }
    .btn-cancel-link { background: none; border: none; color: #16a34a; font-size: .875rem; font-weight: 600; cursor: pointer; text-decoration: none; }
    .btn-cancel-link:hover { text-decoration: underline; }
  `]
})
export class CategoriesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  loading      = signal(true);
  confirmItem   = signal<{ msg: string; action: () => void } | null>(null);
  categories   = signal<Category[]>([]);
  activeTab    = signal<'expense' | 'income'>('expense');
  showForm     = false;
  editing: Category | null = null;
  archiveTarget: Category | null = null;
  iconOpen  = true;
  colorOpen = true;

  filteredCats = computed(() =>
    this.categories().filter(c => c.type === this.activeTab())
  );

  form = { name: '', type: 'expense' as 'expense'|'income', color: '#8b5cf6', icon: '👔' };

  /** First letter of the category name for the colored circle */
  initial(cat: Category): string {
    return (cat.name || '?')[0].toUpperCase();
  }

  /** First letter for the form preview circle */
  formInitial(): string {
    return (this.form.name || '?')[0].toUpperCase();
  }

  icons = [
    '🍷','👔','📋','🎓','✈️','🏢','🎵','🎯','🏌️',
    '📅','👜','🍰','⚙️','💬','🎲','🏆','👁️','🐶',
    '❤️','🚩','🍴','🎮','👶','🛒','👥','⚽','➕','🏠',
    '📍','📊','👤','💲','🔒','🔧','☰','⋯','🎨',
    '📄','👨‍👩‍👧','🐾','🛡️','🌊','⭐','🏷️','🚛','💼',
    '🔄','❄️','🌮','🍔','✂️','🚗','🔧','🚌','🏠','💰',
  ];

  palette = [
    '#e91e8c','#7c4dff','#651fff','#2979ff','#7b1fa2',
    '#f44336','#ff80ab','#0097a7','#f48fb1','#e040fb',
    '#388e3c','#ff6d00','#ff8f00','#bf360c','#1565c0',
    '#9e9e9e','#00695c','#1b5e20','#80cbc4','#c62828',
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.get<any>('/categories').subscribe(r => {
      this.categories.set(r.data ?? []);
      this.loading.set(false);
    });
  }

  openForm(type: 'expense' | 'income') {
    this.editing = null;
    this.iconOpen = true;
    this.colorOpen = true;
    this.form = { name: '', type, color: '#8b5cf6', icon: '👔' };
    this.showForm = true;
  }

  edit(cat: Category) {
    this.editing = cat;
    this.iconOpen = true;
    this.colorOpen = true;
    this.form = { name: cat.name, type: cat.type as any, color: cat.color || '#8b5cf6', icon: cat.icon || '👔' };
    this.showForm = true;
  }

  save() {
    if (!this.form.name.trim()) return;
    const payload = { name: this.form.name, type: this.form.type, color: this.form.color, icon: this.form.icon };
    if (this.editing) {
      this.api.put(`/categories/${this.editing.id}`, payload).subscribe({
        next: () => { this.toast.show('Categoria atualizada!', 'success'); this.showForm = false; this.editing = null; this.load(); },
        error: () => this.toast.show('Erro ao atualizar.', 'error'),
      });
    } else {
      this.api.post('/categories', payload).subscribe({
        next: () => { this.toast.show('Categoria criada!', 'success'); this.showForm = false; this.load(); },
        error: () => this.toast.show('Erro ao criar.', 'error'),
      });
    }
  }

  doDelete(): void {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }
}
