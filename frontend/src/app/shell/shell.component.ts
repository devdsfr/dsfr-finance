import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { PlanService } from '../core/services/plan.service';
import { SettingsService, CURRENCIES, CURRENCY_SYMBOL, CurrencyCode } from '../core/services/settings.service';
import { TranslationService } from '../core/services/translation.service';
import { ThemeService } from '../core/services/theme.service';
import { Lang } from '../core/i18n/translations';
import { TranslatePipe } from '../shared/pipes/translate.pipe';
import { ToastComponent } from '../shared/components/toast/toast.component';
import { filter } from 'rxjs/operators';

interface NavItem { path: string; label: string; icon: string; premium?: boolean; }
interface NavGroup { key: string; label: string; items: NavItem[]; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, ToastComponent, TranslatePipe],
  template: `
    <div class="app">

      <!-- ── Sidebar ─────────────────────────────────────────── -->
      @if (sidebarOpen()) { <div class="scrim" (click)="sidebarOpen.set(false)"></div> }
      <aside class="sidebar" [class.sidebar--open]="sidebarOpen()">
        <div class="sidebar__brand">
          <svg width="30" height="30" viewBox="0 0 32 32" style="flex-shrink:0">
            <rect width="32" height="32" rx="7" fill="#2e7736"/>
            <polyline points="5,22 11,14 17,18 27,8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="27" cy="8" r="2.5" fill="#7dd87f"/>
          </svg>
          <span class="brand-name"><strong>DSFR</strong> finance</span>
        </div>

        <nav class="sidebar__nav">
          <a class="nav-item nav-item--top" routerLink="/dashboard" routerLinkActive="nav-item--active"
             [routerLinkActiveOptions]="{exact:true}" (click)="closeMobile()">
            <span class="nav-item__icon">🏠</span>
            <span class="nav-item__label">{{ 'nav.overview' | translate }}</span>
          </a>

          @for (g of navGroups; track g.key) {
            <div class="nav-group">
              <button class="nav-group__head" (click)="toggleGroup(g.key)">
                <span>{{ g.label }}</span>
                <span class="nav-group__chev" [class.nav-group__chev--open]="isGroupOpen(g.key)">▾</span>
              </button>
              @if (isGroupOpen(g.key)) {
                <div class="nav-group__items">
                  @for (it of g.items; track it.path) {
                    <a class="nav-item" [routerLink]="it.path" routerLinkActive="nav-item--active" (click)="closeMobile()">
                      <span class="nav-item__icon">{{ it.icon }}</span>
                      <span class="nav-item__label">{{ it.label }}</span>
                      @if (it.premium && !plan.isPremium()) { <span class="nav-lock">🔒</span> }
                    </a>
                  }
                </div>
              }
            </div>
          }
        </nav>

        <!-- Rodapé: conta -->
        <div class="sidebar__footer">
          <div class="acct" [class.acct--open]="acctOpen()">
            <button class="acct__trigger" (click)="acctOpen.set(!acctOpen())">
              <span class="avatar">{{ initials() }}</span>
              <span class="acct__name">{{ auth.currentUser()?.name }}</span>
              <span class="caret">▾</span>
            </button>
            @if (acctOpen()) {
              <div class="acct__menu">
                <a routerLink="/account" (click)="closeAcct()">👤 {{ 'nav.my_account' | translate }}</a>
                <a routerLink="/plan" (click)="closeAcct()">
                  🔑 {{ 'nav.access_control' | translate }}
                  <span class="plan-pill" [class.plan-pill--premium]="plan.isPremium()">{{ plan.isPremium() ? 'Premium' : 'Free' }}</span>
                </a>
                <a routerLink="/alert-config" (click)="closeAcct()">⚙️ {{ 'nav.alert_config' | translate }}</a>
                <a routerLink="/activity" (click)="closeAcct()">📝 {{ 'nav.activity_log' | translate }}</a>
                <hr/>
                <button (click)="auth.logout()">🚪 {{ 'nav.logout' | translate }}</button>
              </div>
            }
          </div>
        </div>
      </aside>

      <!-- ── Área principal ──────────────────────────────────── -->
      <div class="main-wrap">
        <!-- Topbar slim -->
        <header class="topbar">
          <button class="hamburger" (click)="sidebarOpen.set(!sidebarOpen())" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>

          <div class="topbar__spacer"></div>

          <div class="topbar__right">
            <!-- Moeda -->
            <div class="menu" [class.open]="currMenuOpen()">
              <button class="menu__trigger" (click)="currMenuOpen.set(!currMenuOpen())" title="Moeda">
                <img [src]="currFlag()" width="20" height="14" style="border-radius:2px;vertical-align:middle" alt=""/>
                <span class="caret">▾</span>
                @if (settings.rateLoading()) { <span class="rate-spin">⟳</span> }
              </button>
              <div class="menu__dropdown" (mouseleave)="currMenuOpen.set(false)">
                @for (c of currencies; track c.value) {
                  <button [class.active]="settings.currency() === c.value" (click)="setCurrency(c.value)">
                    <img [src]="currFlagFor(c.value)" width="20" height="14" style="border-radius:2px;vertical-align:middle;margin-right:.35rem" alt=""/>
                    {{ c.value }} — {{ c.label.split('--')[0].trim() }}
                  </button>
                }
              </div>
            </div>

            <!-- Idioma -->
            <div class="menu" [class.open]="langMenuOpen()">
              <button class="menu__trigger" (click)="langMenuOpen.set(!langMenuOpen())" [title]="'common.language' | translate">
                <img [src]="langFlag()" width="20" height="14" style="border-radius:2px;vertical-align:middle" alt=""/>
                <span class="caret">▾</span>
              </button>
              <div class="menu__dropdown" (mouseleave)="langMenuOpen.set(false)">
                @for (l of i18n.langs; track l.value) {
                  <button [class.active]="i18n.lang() === l.value" (click)="setLang(l.value)">
                    <img [src]="langFlagFor(l.value)" width="20" height="14" style="border-radius:2px;vertical-align:middle;margin-right:.35rem" alt=""/>
                    {{ l.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Tema -->
            <button class="theme-toggle" (click)="theme.toggle()" [class.theme-toggle--dark]="theme.isDark()" [title]="theme.isDark() ? 'Modo claro' : 'Modo escuro'" aria-label="Alternar tema">
              <span class="tt-track"><span class="tt-thumb">
                @if (theme.isDark()) {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                } @else {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                }
              </span></span>
            </button>

            <!-- Notificações -->
            <a routerLink="/notifications" class="notif-btn" [title]="'nav.notifications' | translate">
              🔔
              @if (unreadCount() > 0) { <span class="notif-badge">{{ unreadCount() }}</span> }
            </a>
          </div>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>

      <!-- ── FAB de ações rápidas ────────────────────────────── -->
      @if (fabOpen()) {
        <div class="fab-scrim" (click)="fabOpen.set(false)"></div>
        <div class="fab-menu">
          <a class="fab-action fab-action--income" routerLink="/transactions/new" [queryParams]="{type:'income'}" (click)="fabOpen.set(false)">
            <span class="fab-action__icon">➕</span> {{ 'dashboard.income' | translate }}
          </a>
          <a class="fab-action fab-action--expense" routerLink="/transactions/new" [queryParams]="{type:'expense'}" (click)="fabOpen.set(false)">
            <span class="fab-action__icon">➖</span> {{ 'dashboard.expense' | translate }}
          </a>
          <a class="fab-action fab-action--transfer" routerLink="/transactions/new" [queryParams]="{type:'transfer'}" (click)="fabOpen.set(false)">
            <span class="fab-action__icon">⇄</span> {{ 'dashboard.transfer' | translate }}
          </a>
        </div>
      }
      <button class="fab" [class.fab--open]="fabOpen()" (click)="fabOpen.set(!fabOpen())" aria-label="Novo lançamento">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
    <app-toast />
  `,
  styles: [`
    * { box-sizing: border-box; }
    :host { --sw: 254px; }
    .app { min-height: 100vh; background: #f4f6fb; }

    /* ── Sidebar ─────────────────────────────────────────── */
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; width: var(--sw);
      background: #fff; border-right: 1px solid #e9edf3;
      display: flex; flex-direction: column; z-index: 400;
      overflow-y: auto;
    }
    .sidebar__brand { display: flex; align-items: center; gap: .6rem; padding: 1.1rem 1.25rem; }
    .brand-name { font-size: 1.05rem; font-weight: 400; color: #1a2035; white-space: nowrap; }
    .brand-name strong { font-weight: 700; letter-spacing: .03em; }

    .sidebar__nav { flex: 1; padding: .25rem .6rem 1rem; }
    .nav-group { margin-top: .35rem; }
    .nav-group__head {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      background: none; border: none; cursor: pointer; padding: .55rem .65rem .35rem;
      font-size: .66rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #9aa4b2;
    }
    .nav-group__chev { font-size: .7rem; transition: transform .2s; }
    .nav-group__chev--open { transform: rotate(180deg); }
    .nav-group__items { display: flex; flex-direction: column; gap: 1px; }

    .nav-item {
      display: flex; align-items: center; gap: .65rem; padding: .55rem .7rem; border-radius: .5rem;
      text-decoration: none; color: #46505f; font-size: .875rem; font-weight: 500; transition: background .12s, color .12s;
    }
    .nav-item--top { margin: .35rem 0; font-weight: 600; }
    .nav-item:hover { background: #f1f5f2; color: #1a2035; }
    .nav-item--active { background: #eaf5ec; color: #2e7736; font-weight: 600; }
    .nav-item--active .nav-item__icon { filter: none; }
    .nav-item__icon { width: 20px; text-align: center; font-size: .95rem; flex-shrink: 0; }
    .nav-item__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nav-lock { font-size: .7rem; opacity: .8; }

    /* Footer / conta */
    .sidebar__footer { border-top: 1px solid #eef1f5; padding: .6rem; }
    .acct { position: relative; }
    .acct__trigger { width: 100%; display: flex; align-items: center; gap: .55rem; background: none; border: none; cursor: pointer; padding: .45rem .5rem; border-radius: .5rem; }
    .acct__trigger:hover { background: #f1f5f2; }
    .avatar { width: 30px; height: 30px; border-radius: 50%; background: #2e7736; color: #fff; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
    .acct__name { flex: 1; text-align: left; font-size: .82rem; font-weight: 600; color: #1a2035; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .caret { font-size: .65rem; color: #9ca3af; }
    .acct__menu { position: absolute; bottom: calc(100% + 6px); left: 0; right: 0; background: #fff; border: 1px solid #e9edf3; border-radius: .6rem; box-shadow: 0 12px 32px rgba(0,0,0,.14); padding: .35rem; z-index: 500; }
    .acct__menu a, .acct__menu button { display: flex; align-items: center; gap: .4rem; width: 100%; text-align: left; padding: .5rem .6rem; border-radius: .4rem; font-size: .82rem; color: #374151; text-decoration: none; background: none; border: none; cursor: pointer; }
    .acct__menu a:hover, .acct__menu button:hover { background: #f3f4f6; }
    .acct__menu hr { margin: .3rem 0; border: none; border-top: 1px solid #eef1f5; }
    .acct__menu button { color: #dc2626; }
    .plan-pill { margin-left: auto; padding: .05rem .4rem; border-radius: 9999px; background: #e5e7eb; color: #374151; font-size: .6rem; font-weight: 700; }
    .plan-pill--premium { background: #2e7736; color: #fff; }

    /* ── Main ────────────────────────────────────────────── */
    .main-wrap { margin-left: var(--sw); min-height: 100vh; display: flex; flex-direction: column; }
    .topbar {
      height: 56px; display: flex; align-items: center; gap: .5rem;
      padding: 0 1.25rem; background: #fff; border-bottom: 1px solid #e9edf3;
      position: sticky; top: 0; z-index: 300;
    }
    .topbar__spacer { flex: 1; }
    .topbar__right { display: flex; align-items: center; gap: .6rem; }

    .hamburger { display: none; flex-direction: column; justify-content: center; gap: 4px; background: none; border: none; cursor: pointer; padding: .25rem; width: 34px; height: 34px; }
    .hamburger span { display: block; height: 2px; background: #46505f; border-radius: 2px; }

    /* Dropdowns moeda/idioma */
    .menu { position: relative; }
    .menu__trigger { background: #f4f6fb; border: 1px solid #e9edf3; cursor: pointer; color: #46505f; padding: .3rem .5rem; border-radius: .45rem; font-size: .9rem; display: inline-flex; align-items: center; gap: .2rem; }
    .menu__trigger:hover { background: #eef1f5; }
    .menu__dropdown { display: none; position: absolute; top: calc(100% + 4px); right: 0; background: #fff; border: 1px solid #e9edf3; border-radius: .5rem; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 160px; padding: .375rem 0; z-index: 400; }
    .menu.open .menu__dropdown { display: block; }
    .menu__dropdown button { display: block; width: 100%; text-align: left; padding: .45rem 1rem; color: #374151; font-size: .85rem; background: none; border: none; cursor: pointer; }
    .menu__dropdown button:hover { background: #f3f4f6; }
    .menu__dropdown button.active { color: #2e7736; font-weight: 700; }
    .caret { font-size: .65rem; }
    .rate-spin { display: inline-block; font-size: .75rem; margin-left: .15rem; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .notif-btn { position: relative; font-size: 1.15rem; cursor: pointer; text-decoration: none; padding: 0 .15rem; }
    .notif-badge { position: absolute; top: -6px; right: -6px; background: #ef4444; color: #fff; border-radius: 9999px; font-size: .6rem; padding: .05rem .3rem; font-weight: 700; }

    /* Tema toggle */
    .theme-toggle { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; }
    .tt-track { position: relative; width: 44px; height: 24px; background: #e2e8f0; border-radius: 12px; transition: background .25s; display: flex; align-items: center; }
    .theme-toggle--dark .tt-track { background: rgba(74,222,128,.35); }
    .tt-thumb { position: absolute; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #f59e0b; transition: transform .25s cubic-bezier(.34,1.56,.64,1), background .25s, color .25s; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
    .theme-toggle--dark .tt-thumb { transform: translateX(20px); background: #1e2638; color: #c4b5fd; }

    .content { flex: 1; padding: 1.5rem 2rem; max-width: 1180px; margin: 0 auto; width: 100%; }

    /* ── FAB ─────────────────────────────────────────────── */
    .fab {
      position: fixed; right: 1.75rem; bottom: 1.75rem; width: 56px; height: 56px; border-radius: 50%;
      background: #2e7736; border: none; cursor: pointer; box-shadow: 0 8px 22px rgba(46,119,54,.4);
      display: flex; align-items: center; justify-content: center; z-index: 620; transition: transform .2s, background .2s;
    }
    .fab:hover { background: #276a2e; }
    .fab--open { transform: rotate(135deg); }
    .fab-scrim { position: fixed; inset: 0; z-index: 600; }
    .fab-menu { position: fixed; right: 1.75rem; bottom: 5.5rem; z-index: 620; display: flex; flex-direction: column; gap: .55rem; align-items: flex-end; }
    .fab-action {
      display: inline-flex; align-items: center; gap: .55rem; padding: .6rem 1rem; border-radius: 9999px;
      background: #fff; color: #1a2035; font-size: .85rem; font-weight: 600; text-decoration: none;
      box-shadow: 0 6px 18px rgba(0,0,0,.16); animation: fab-in .18s ease both;
    }
    .fab-action__icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .8rem; }
    .fab-action--income .fab-action__icon { background: #dcfce7; }
    .fab-action--expense .fab-action__icon { background: #fee2e2; }
    .fab-action--transfer .fab-action__icon { background: #e0e7ff; }
    @keyframes fab-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .scrim { display: none; }

    /* ── Responsivo ──────────────────────────────────────── */
    @media (max-width: 900px) {
      .sidebar { transform: translateX(-100%); transition: transform .28s ease; box-shadow: 4px 0 24px rgba(0,0,0,.12); }
      .sidebar--open { transform: translateX(0); }
      .scrim { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 390; }
      .main-wrap { margin-left: 0; }
      .hamburger { display: flex; }
      .content { padding: 1rem .9rem; }
    }

    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .app { background: #0d1117; }
    :host-context([data-theme="dark"]) .sidebar,
    :host-context([data-theme="dark"]) .topbar { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .brand-name,
    :host-context([data-theme="dark"]) .acct__name { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .nav-group__head { color: #6b7688 !important; }
    :host-context([data-theme="dark"]) .nav-item { color: #b3bdcc !important; }
    :host-context([data-theme="dark"]) .nav-item:hover { background: #1e2638 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sidebar__footer { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .acct__trigger:hover { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .acct__menu { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .acct__menu a, :host-context([data-theme="dark"]) .acct__menu button { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .acct__menu a:hover, :host-context([data-theme="dark"]) .acct__menu button:hover { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .acct__menu button { color: #f87171 !important; }
    :host-context([data-theme="dark"]) .acct__menu hr { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .hamburger span { background: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .menu__trigger { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .menu__dropdown { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .menu__dropdown button { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .menu__dropdown button:hover { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .fab-action { background: #1e2638 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .tt-track { background: #232d42; }
  
    /* ══ DARK THEME (auto) ══ */
    :host-context([data-theme="dark"]) .caret { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .acct__menu a, .acct__menu button { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .plan-pill { color: #e2e8f5 !important; background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .tt-thumb { background: #161c28 !important; }
  `]
})
export class ShellComponent implements OnInit {
  auth     = inject(AuthService);
  plan     = inject(PlanService);
  settings = inject(SettingsService);
  i18n     = inject(TranslationService);
  theme    = inject(ThemeService);
  private api    = inject(ApiService);
  private router = inject(Router);

  unreadCount  = signal(0);
  sidebarOpen  = signal(false);
  acctOpen     = signal(false);
  langMenuOpen = signal(false);
  currMenuOpen = signal(false);
  fabOpen      = signal(false);

  // Grupos do menu (5 grupos, padrão de mercado)
  navGroups: NavGroup[] = [
    { key: 'financas', label: 'Finanças', items: [
      { path: '/transactions', label: 'Lançamentos', icon: '📋' },
      { path: '/banking',      label: 'Contas & Cartões', icon: '🏦' },
      { path: '/categories',   label: 'Categorias', icon: '📁' },
    ]},
    { key: 'contas', label: 'Contas', items: [
      { path: '/commitments',    label: 'Compromissos', icon: '📅' },
      { path: '/forecast',       label: 'Previsão', icon: '🔮' },
      { path: '/goals',          label: 'Objetivos', icon: '🎯' },
      { path: '/spending-limits', label: 'Limite de Gastos', icon: '🚦' },
    ]},
    { key: 'planejar', label: 'Planejar', items: [
      { path: '/patrimony-evolution', label: 'Patrimônio', icon: '📊' },
      { path: '/debt-strategy',       label: 'Estratégia de Dívidas', icon: '📉', premium: true },
      { path: '/investment-strategy', label: 'Estratégia de Investimentos', icon: '⚖️', premium: true },
      { path: '/ai-subscriptions',    label: 'Assinaturas Tech', icon: '🤖', premium: true },
    ]},
    { key: 'gestao', label: 'Gestão', items: [
      { path: '/reports',      label: 'Relatórios', icon: '📈' },
      { path: '/open-finance', label: 'Open Finance', icon: '🔗' },
    ]},
  ];

  private openGroups = signal<Set<string>>(new Set(this.navGroups.map(g => g.key)));
  isGroupOpen(key: string): boolean { return this.openGroups().has(key); }
  toggleGroup(key: string): void {
    const s = new Set(this.openGroups());
    s.has(key) ? s.delete(key) : s.add(key);
    this.openGroups.set(s);
  }

  currencies = CURRENCIES;
  currSymbol() { return CURRENCY_SYMBOL[this.settings.currency()]; }

  private readonly CURR_FLAG: Record<CurrencyCode, string> = { BRL: 'br', USD: 'us', EUR: 'eu', RON: 'ro' };
  private readonly LANG_FLAG: Record<string, string> = { pt: 'br', en: 'gb', ro: 'ro' };
  private flagUrl(code: string): string { return `https://flagcdn.com/20x15/${code}.png`; }
  currFlag()                   { return this.flagUrl(this.CURR_FLAG[this.settings.currency()]); }
  currFlagFor(c: CurrencyCode) { return this.flagUrl(this.CURR_FLAG[c]); }
  langFlag()                   { return this.flagUrl(this.LANG_FLAG[this.i18n.lang()] ?? 'br'); }
  langFlagFor(l: string)       { return this.flagUrl(this.LANG_FLAG[l] ?? 'br'); }

  @HostListener('document:keydown.escape')
  onEscape() { this.sidebarOpen.set(false); this.acctOpen.set(false); this.fabOpen.set(false); }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  closeMobile(): void { this.sidebarOpen.set(false); }
  closeAcct(): void { this.acctOpen.set(false); }
  setLang(lang: Lang): void { this.i18n.setLang(lang); this.langMenuOpen.set(false); }
  setCurrency(code: CurrencyCode): void { this.settings.setCurrency(code); this.currMenuOpen.set(false); }

  ngOnInit(): void {
    this.plan.load();
    this.settings.load();
    this.api.get<any>('/notifications').subscribe(r => {
      const list: any[] = r.data ?? [];
      this.unreadCount.set(list.filter((n: any) => !n.read).length);
    });

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.acctOpen.set(false);
      this.sidebarOpen.set(false);
      this.langMenuOpen.set(false);
      this.currMenuOpen.set(false);
      this.fabOpen.set(false);
    });
  }
}
