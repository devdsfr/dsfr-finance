import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { ToastComponent } from '../shared/components/toast/toast.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, ToastComponent],
  template: `
    <div class="app">
      <!-- Top Navigation -->
      <header class="topnav">
        <div class="topnav__brand">
          <span class="brand-icon">💰</span>
          <span class="brand-name">dsfr finance</span>
        </div>

        <nav class="topnav__links">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Visão Geral</a>
          <a routerLink="/transactions" routerLinkActive="active">Lançamentos</a>

          <!-- Relatórios dropdown -->
          <div class="dropdown" [class.open]="reportsOpen()">
            <button class="dropdown__trigger" (click)="reportsOpen.set(!reportsOpen())"
                    [class.active]="isReportsActive()">
              Relatórios <span class="caret">▾</span>
            </button>
            <div class="dropdown__menu" (mouseleave)="reportsOpen.set(false)">
              <a routerLink="/reports/flow" routerLinkActive="active" (click)="reportsOpen.set(false)">Entradas x Saídas</a>
              <a routerLink="/reports/patrimony" routerLinkActive="active" (click)="reportsOpen.set(false)">Evolução Patrimonial</a>
              <a routerLink="/reports/categories" routerLinkActive="active" (click)="reportsOpen.set(false)">Categorias</a>
              <a routerLink="/reports/tags" routerLinkActive="active" (click)="reportsOpen.set(false)">Tags</a>
              <a routerLink="/reports/installments" routerLinkActive="active" (click)="reportsOpen.set(false)">Parcelamentos</a>
              <a routerLink="/reports/card-invoices" routerLinkActive="active" (click)="reportsOpen.set(false)">Faturas de Cartão</a>
            </div>
          </div>

          <a routerLink="/spending-limits" routerLinkActive="active">Limite de Gastos</a>
          <a routerLink="/banking" routerLinkActive="active">Conexão Bancária</a>
        </nav>

        <div class="topnav__right">
          <a routerLink="/notifications" class="notif-btn" title="Notificações">
            🔔
            @if (unreadCount() > 0) {
              <span class="notif-badge">{{ unreadCount() }}</span>
            }
          </a>

          <div class="user-menu" [class.open]="userMenuOpen()">
            <button class="user-menu__trigger" (click)="userMenuOpen.set(!userMenuOpen())">
              <span class="avatar">{{ initials() }}</span>
              <span class="user-name">{{ auth.currentUser()?.name }}</span>
              <span class="caret">▾</span>
            </button>
            <div class="user-menu__dropdown" (mouseleave)="userMenuOpen.set(false)">
              <a routerLink="/account" (click)="userMenuOpen.set(false)">Minha Conta</a>
              <a routerLink="/categories" (click)="userMenuOpen.set(false)">Categorias</a>
              <a routerLink="/alert-config" (click)="userMenuOpen.set(false)">Configurar Alertas</a>
              <a routerLink="/activity" (click)="userMenuOpen.set(false)">Log de Atividades</a>
              <hr/>
              <button (click)="auth.logout()">Sair</button>
            </div>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="main">
        <router-outlet />
      </main>
    </div>
    <app-toast />
  `,
  styles: [`
    * { box-sizing: border-box; }

    .app { display: flex; flex-direction: column; min-height: 100vh; background: #f4f6f8; }

    /* ── Top Nav ─────────────────────────────────────────── */
    .topnav {
      display: flex; align-items: center; gap: 1.5rem;
      background: #2e7736; color: #fff;
      padding: 0 1.5rem; height: 52px;
      position: sticky; top: 0; z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,.18);
    }

    .topnav__brand {
      display: flex; align-items: center; gap: .5rem;
      font-weight: 700; font-size: 1rem; white-space: nowrap;
      margin-right: .5rem;
    }
    .brand-icon { font-size: 1.2rem; }
    .brand-name { letter-spacing: -.01em; }

    .topnav__links {
      display: flex; align-items: center; gap: .25rem; flex: 1;
    }
    .topnav__links > a,
    .dropdown__trigger {
      padding: .3rem .75rem; border-radius: .25rem;
      text-decoration: none; color: rgba(255,255,255,.88);
      font-size: .875rem; font-weight: 500; white-space: nowrap;
      border: none; background: none; cursor: pointer;
      transition: background .15s, color .15s;
    }
    .topnav__links > a:hover,
    .dropdown__trigger:hover { background: rgba(255,255,255,.12); color: #fff; }
    .topnav__links > a.active,
    .dropdown__trigger.active { background: rgba(255,255,255,.2); color: #fff; }

    /* Dropdown */
    .dropdown { position: relative; }
    .caret { font-size: .65rem; vertical-align: middle; margin-left: .15rem; }
    .dropdown__menu {
      display: none; position: absolute; top: calc(100% + 4px); left: 0;
      background: #fff; border-radius: .375rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 200px;
      padding: .375rem 0; z-index: 200;
    }
    .dropdown.open .dropdown__menu { display: block; }
    .dropdown__menu a {
      display: block; padding: .45rem 1rem; color: 