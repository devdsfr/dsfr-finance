import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Notificações</h1>
      @if (unread() > 0) {
        <button class="btn btn--ghost btn--sm" (click)="markAllRead()">Marcar todas como lidas</button>
      }
    </div>
    <div class="notif-list">
      @for (n of notifications(); track n.id) {
        <div class="notif-row" [class.notif-row--unread]="!n.read" (click)="markRead(n)">
          <span class="notif-type-icon">
            {{ n.type === 'limit_exceeded' ? '🚨' : n.type === 'spending_alert' ? '⚠️' : '💬' }}
          </span>
          <div class="notif-body">
            <div class="notif-title">{{ n.title }}</div>
            <div class="notif-text">{{ n.body }}</div>
            <div class="notif-time">{{ n.created_at | date:'dd/MM/yy HH:mm' }}</div>
          </div>
          @if (!n.read) { <span class="unread-dot"></span> }
        </div>
      } @empty {
        <div class="empty">Nenhuma notificação.</div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    .notif-list { display: flex; flex-direction: column; gap: .5rem; }
    .notif-row { display: flex; align-items: flex-start; gap: .875rem; background: #fff;
                 border-radius: .5rem; padding: .875rem 1rem; cursor: pointer;
                 box-shadow: 0 1px 3px rgba(0,0,0,.05); transition: background .15s; }
    .notif-row:hover { background: #f9fafb; }
    .notif-row--unread { border-left: 3px solid #6366f1; }
    .notif-type-icon { font-size: 1.25rem; flex-shrink: 0; }
    .notif-body { flex: 1; }
    .notif-title { font-weight: 600; font-size: .875rem; }
    .notif-text { font-size: .82rem; color: #6b7280; margin: .15rem 0; }
    .notif-time { font-size: .75rem; color: #9ca3af; }
    .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; flex-shrink: 0; margin-top: .4rem; }
    .btn { padding: .35rem .75rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; }
    .btn--ghost { background: none; color: #6b7280; }
    .btn--sm { font-size: .78rem; }
    .empty { text-align: center; padding: 2.5rem; color: #9ca3af; background: #fff; border-radius: .5rem; }
  `]
})
export class NotificationsListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  notifications = signal<any[]>([]);
  unread = signal(0);

  ngOnInit(): void {
    this.api.get<any>('/notifications').subscribe(r => {
      this.notifications.set(r.data ?? []);
      this.unread.set((r.data ?? []).filter((n: any) => !n.read).length);
    });
  }

  markRead(n: any): void {
    if (n.read) return;
    this.api.patch(`/notifications/${n.id}/read`).subscribe(() => {
      n.read = true;
      this.unread.update(c => Math.max(0, c - 1));
    });
  }

  markAllRead(): void {
    this.api.post('/notifications/read-all', {}).subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, read: true })));
      this.unread.set(0);
      this.toast.success('Todas marcadas como lidas.');
    });
  }
}
