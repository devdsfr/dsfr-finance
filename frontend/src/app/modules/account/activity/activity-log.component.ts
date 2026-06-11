import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- AC-AT-05: filter by action type -->
    <div class="activity-page">
      <h1>Registro de Atividades</h1>
      <div class="filters">
        <select [(ngModel)]="actionFilter" (ngModelChange)="load()" class="input">
          <option value="">Todas as ações</option>
          <option value="create">Criações</option>
          <option value="update">Atualizações</option>
          <option value="delete">Exclusões</option>
        </select>
        <select [(ngModel)]="entityFilter" (ngModelChange)="load()" class="input">
          <option value="">Todos os tipos</option>
          <option value="transaction">Lançamentos</option>
          <option value="account">Contas</option>
          <option value="card">Cartões</option>
          <option value="category">Categorias</option>
          <option value="tag">Tags</option>
          <option value="limit">Limites</option>
        </select>
      </div>
      <div class="log-list">
        @for (log of logs(); track log.id) {
          <div class="log-row">
            <span class="log-action" [class]="'log-action--' + log.action">{{ log.action }}</span>
            <span class="log-entity">{{ log.entity_type }}</span>
            <span class="log-user">{{ log.user?.name }}</span>
            <span class="log-time">{{ log.created_at | date:'dd/MM/yy HH:mm' }}</span>
          </div>
        } @empty {
          <div class="empty">Nenhuma atividade encontrada.</div>
        }
      </div>
      <div class="pagination">
        <button class="btn" [disabled]="page() <= 1" (click)="changePage(-1)">‹</button>
        <span>Página {{ page() }}</span>
        <button class="btn" (click)="changePage(1)">›</button>
      </div>
    </div>
  `,
  styles: [`
    .activity-page { }
    .filters { display: flex; gap: .75rem; margin-bottom: 1.25rem; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .log-list { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .log-row { display: flex; align-items: center; gap: 1rem; padding: .65rem 1.25rem; border-bottom: 1px solid #f3f4f6; font-size: .85rem; }
    .log-action { padding: .15rem .5rem; border-radius: .25rem; font-weight: 600; font-size: .75rem; text-transform: uppercase; }
    .log-action--create { background: #dcfce7; color: #166534; }
    .log-action--update { background: #dbeafe; color: #1e40af; }
    .log-action--delete { background: #fee2e2; color: #991b1b; }
    .log-entity { flex: 1; color: #374151; }
    .log-user { color: #6b7280; }
    .log-time { color: #9ca3af; white-space: nowrap; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; }
    .btn { padding: .3rem .65rem; border-radius: .375rem; border: 1px solid #d1d5db; cursor: pointer; background: #fff; }
    .empty { text-align: center; padding: 2rem; color: #9ca3af; }
  `]
})
export class ActivityLogComponent implements OnInit {
  private api = inject(ApiService);

  logs = signal<any[]>([]);
  page = signal(1);
  actionFilter = '';
  entityFilter = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.get<any>('/activity', {
      action: this.actionFilter, entity_type: this.entityFilter, page: this.page()
    }).subscribe(r => this.logs.set(r.data ?? []));
  }

  changePage(d: number): void { this.page.update(p => Math.max(1, p + d)); this.load(); }
}
