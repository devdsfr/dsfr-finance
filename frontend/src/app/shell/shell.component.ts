import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { ToastComponent } from '../shared/components/toast/toast.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, ToastComponent],
  template: `
    <div class="layout">
      <!-- Sidebar -->
      <nav class="sidebar">
        <div class="sidebar__logo">
          <span class="logo-icon">💰</span>
          <span class="logo-text">dsfr-finance</span>
        </div>

        <div class="sidebar__user">
          <span class="user-avatar">{{ initials() }}</span>
          <span class="user-name">{{ auth.currentUser()?.name }}</span>
        </div>

        <ul class="sidebar__nav">
          <li><a routerLink="/transactions" routerLinkActive="active">📋 Lançamentos</a></li>
          <li class="nav-group">
            <span class="nav-group__label">Relatórios</span>
            <ul>
              <li><a routerLink="/reports/patrimony" routerLinkActive="active">📈 Evolução Patrimonial</a></li>
              <li><a routerLink="/reports/accounts" routerLinkActive="active">🏦 Contas</a></li>
            </ul>
          </li>
          <li><a routerLink="/spending-limits" routerLinkActive="active">⚡ Limites de Gastos</a></li>
          <li class="notification-link">
            <a routerLink="/notifications" routerLinkActive="active">
              🔔 Notificações
              @if (unreadCount() > 0) {
                <span class="badge">{{ unreadCount() }}</span>
              }
            </a>
          </li>
          <li><a routerLink="/alert-config" routerLinkActive="active">⚙️ Alertas</a></li>
          <li><a routerLink="/activity" routerLinkActive="active">📜 Atividades</a></li>
          <li><a routerLink="/account" routerLinkActive="active">👤 Minha Conta</a></li>
        </ul>

        <button class="sidebar__logout" (click)="auth.logout()">Sair</button>
      </nav>

      <!-- Main content -->
      <main class="main">
        <router-outlet />
      </main>
    </div>
    <app-toast />
  `,
  styles: [`
    .layout { display: flex; height: 100vh; overflow: hidden; }
    .sidebar {
      width: 220px; background: #1e1b4b; color: #c7d2fe;
      display: flex; flex-direction: column; padding: 1rem; flex-shrink: 0;
    }
    .sidebar__logo { display: flex; align-items: center; gap: .5rem; margin-bottom: 1.5rem; }
    .logo-icon { font-size: 1.5rem; }
    .logo-text { font-size: 1rem; font-weight: 700; color: #fff; }
    .sidebar__user { display: flex; align-items: center; gap: .5rem; margin-bottom: 1.5rem;
                     padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,.1); }
    .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: #6366f1;
                   display: flex; align-items: center; justify-content: center;
                   color: #fff; font-size: .8rem; font-weight: 700; flex-shrink: 0; }
    .user-name { font-size: .8rem; color: #e0e7ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sidebar__nav { list-style: none; padding: 0; margin: 0; flex: 1; display: flex; flex-direction: column; gap: .15rem; }
    .sidebar__nav li a {
      display: flex; align-items: center; gap: .5rem; padding: .5rem .65rem;
      border-radius: .375rem; text-decoration: none; color: #a5b4fc;
      font-size: .82rem; transition: background .15s;
    }
    .sidebar__nav li a:hover { background: rgba(255,255,255,.08); color: #fff; }
    .sidebar__nav li a.active { background: #6366f1; color: #fff; }
    .nav-group__label { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em;
                        color: #6b7280; padding: .75rem .65rem .25rem; display: block; }
    .nav-group ul { list-style: none; padding: 0; }
    .notification-link .badge {
      background: #ef4444; color: #fff; border-radius: 9999px;
      padding: .1rem .4rem; font-size: .65rem; margin-left: auto;
    }
    .sidebar__logout {
      margin-top: auto; padding: .5rem; background: none; border: 1px solid rgba(255,255,255,.15);
      color: #a5b4fc; border-radius: .375rem; cursor: pointer; font-size: .82rem;
    }
    .sidebar__logout:hover { background: rgba(255,255,255,.08); color: #fff; }
    .main { flex: 1; overflow-y: auto; padding: 1.5rem 2rem; background: #f8fafc; }
  `]
})
export class ShellComponent {
  auth = inject(AuthService);
  private api = inject(ApiService);
  unreadCount = signal(0);

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  constructor() {
    this.api.get<any>('/notifications').subscribe(r => {
      const list: any[] = r.data ?? [];
      this.unreadCount.set(list.filter(n => !n.read).length);
    });
  }
}
