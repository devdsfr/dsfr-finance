import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { PlanService } from '../core/services/plan.service';
import { SettingsService, CURRENCIES, CURRENCY_SYMBOL, CurrencyCode } from '../core/services/settings.service';
import { TranslationService } from '../core/services/translation.service';
import { Lang } from '../core/i18n/translations';
import { TranslatePipe } from '../shared/pipes/translate.pipe';
import { ToastComponent } from '../shared/components/toast/toast.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, ToastComponent, TranslatePipe],
  template: `
    <div class="app">
      <!-- Top Navigation -->
      <header class="topnav">
        <!-- Hamburger (mobile only) -->
        <button class="hamburger" (click)="drawerOpen.set(!drawerOpen())" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>

        <div class="topnav__brand">
          <svg width="28" height="28" viewBox="0 0 32 32" style="flex-shrink:0">
            <rect width="32" height="32" rx="7" fill="#2e7736"/>
            <polyline points="5,22 11,14 17,18 27,8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="27" cy="8" r="2.5" fill="#7dd87f"/>
          </svg>
          <span class="brand-name"><strong>DSFR</strong> finance</span>
        </div>

        <!-- Desktop nav -->
        <nav class="topnav__links">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">{{ 'nav.overview' | translate }}</a>
          <a routerLink="/transactions" routerLinkActive="active">{{ 'nav.transactions' | translate }}</a>

          <a routerLink="/reports" routerLinkActive="active">{{ 'nav.reports' | translate }}</a>

          <a routerLink="/patrimony-evolution" routerLinkActive="active">Patrimônio</a>
          <a routerLink="/spending-limits" routerLinkActive="active">{{ 'nav.spending_limits' | translate }}</a>
          <a routerLink="/debt-strategy"   routerLinkActive="active">
            {{ 'nav.debt_strategy' | translate }} @if (!plan.isPremium()) { <span class="lock-dot">🔒</span> }
          </a>
          <a routerLink="/ai-subscriptions" routerLinkActive="active">
            {{ 'nav.ai_subscriptions' | translate }} @if (!plan.isPremium()) { <span class="lock-dot">🔒</span> }
          </a>
          <a routerLink="/open-finance"     routerLinkActive="active">Open Finance</a>
        </nav>

        <div class="topnav__right">
          <!-- Currency switcher -->
          <div class="lang-menu" [class.open]="currMenuOpen()">
            <button class="lang-menu__trigger" (click)="currMenuOpen.set(!currMenuOpen())" title="Moeda">
              <img [src]="currFlag()" width="20" height="14" style="border-radius:2px;vertical-align:middle" alt=""/>
              <span class="caret">▾</span>
              @if (settings.rateLoading()) { <span class="rate-spin">⟳</span> }
            </button>
            <div class="lang-menu__dropdown" (mouseleave)="currMenuOpen.set(false)">
              @for (c of currencies; track c.value) {
                <button [class.active]="settings.currency() === c.value" (click)="setCurrency(c.value)">
                  <img [src]="currFlagFor(c.value)" width="20" height="14" style="border-radius:2px;vertical-align:middle;margin-right:.35rem" alt=""/>
                  {{ c.value }} — {{ c.label.split('--')[0].trim() }}
                </button>
              }
            </div>
          </div>

          <!-- Language switcher -->
          <div class="lang-menu" [class.open]="langMenuOpen()">
            <button class="lang-menu__trigger" (click)="langMenuOpen.set(!langMenuOpen())" [title]="'common.language' | translate">
              <img [src]="langFlag()" width="20" height="14" style="border-radius:2px;vertical-align:middle" alt=""/>
              <span class="caret">▾</span>
            </button>
            <div class="lang-menu__dropdown" (mouseleave)="langMenuOpen.set(false)">
              @for (l of i18n.langs; track l.value) {
                <button [class.active]="i18n.lang() === l.value" (click)="setLang(l.value)">
                  <img [src]="langFlagFor(l.value)" width="20" height="14" style="border-radius:2px;vertical-align:middle;margin-right:.35rem" alt=""/>
                  {{ l.label }}
                </button>
              }
            </div>
          </div>

          <a routerLink="/notifications" class="notif-btn" [title]="'nav.notifications' | translate">
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
              <a routerLink="/account"     (click)="userMenuOpen.set(false)">{{ 'nav.my_account' | translate }}</a>
              <a routerLink="/categories"  (click)="userMenuOpen.set(false)">{{ 'nav.categories' | translate }}</a>
              <a routerLink="/banking"    (click)="userMenuOpen.set(false)">Contas & Cartões</a>
              <a routerLink="/plan"        (click)="userMenuOpen.set(false)">
                {{ 'nav.access_control' | translate }}
                <span class="plan-pill" [class.plan-pill--premium]="plan.isPremium()">{{ plan.isPremium() ? 'Premium' : 'Free' }}</span>
              </a>
              <a routerLink="/alert-config"(click)="userMenuOpen.set(false)">{{ 'nav.alert_config' | translate }}</a>
              <a routerLink="/activity"    (click)="userMenuOpen.set(false)">{{ 'nav.activity_log' | translate }}</a>
              <hr/>
              <button (click)="auth.logout()">{{ 'nav.logout' | translate }}</button>
            </div>
          </div>
        </div>
      </header>

      <!-- ── Mobile Drawer ──────────────────────────────────── -->
      @if (drawerOpen()) {
        <div class="drawer-overlay" (click)="drawerOpen.set(false)"></div>
      }
      <nav class="drawer" [class.drawer--open]="drawerOpen()">
        <!-- Drawer header -->
        <div class="drawer__head">
          <span class="avatar drawer__avatar">{{ initials() }}</span>
          <div>
            <div class="drawer__name">{{ auth.currentUser()?.name }}</div>
            <div class="drawer__email"><strong>DSFR</strong> finance</div>
          </div>
          <button class="drawer__close" (click)="drawerOpen.set(false)">✕</button>
        </div>

        <!-- Language switcher (mobile) -->
        <div class="drawer__langs">
          @for (l of i18n.langs; track l.value) {
            <button [class.active]="i18n.lang() === l.value" (click)="setLang(l.value)">
              <img [src]="langFlagFor(l.value)" width="24" height="17" style="border-radius:2px" alt=""/>
            </button>
          }
        </div>

        <!-- Currency switcher (mobile) -->
        <div class="drawer__langs drawer__currencies">
          @for (c of currencies; track c.value) {
            <button [class.active]="settings.currency() === c.value" (click)="setCurrency(c.value)" [title]="c.label">
              {{ c.value }}
            </button>
          }
        </div>

        <!-- Nav links -->
        <div class="drawer__section">
          <a class="drawer__link" routerLink="/dashboard" routerLinkActive="drawer__link--active"
             [routerLinkActiveOptions]="{exact:true}" (click)="drawerOpen.set(false)">
            🏠 {{ 'nav.overview' | translate }}
          </a>
          <a class="drawer__link" routerLink="/transactions" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            📋 {{ 'nav.transactions' | translate }}
          </a>
          <a class="drawer__link" routerLink="/patrimony-evolution" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            📊 Patrimônio
          </a>
          <a class="drawer__link" routerLink="/spending-limits" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            🎯 {{ 'nav.spending_limits' | translate }}
          </a>
          <a class="drawer__link" routerLink="/debt-strategy" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            📊 {{ 'nav.debt_strategy' | translate }}
            @if (!plan.isPremium()) { <span class="drawer__lock">🔒</span> }
          </a>
          <a class="drawer__link" routerLink="/ai-subscriptions" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            🤖 {{ 'nav.ai_subscriptions' | translate }}
            @if (!plan.isPremium()) { <span class="drawer__lock">🔒</span> }
          </a>
          <a class="drawer__link" routerLink="/open-finance" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            🏦 Open Finance
          </a>
        </div>

        <div class="drawer__label">{{ 'nav.reports' | translate }}</div>
        <div class="drawer__section">
          <a class="drawer__link" routerLink="/reports" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">📊 {{ 'nav.reports' | translate }}</a>
        </div>

        <div class="drawer__label">{{ 'nav.my_account' | translate }}</div>
        <div class="drawer__section">
          <a class="drawer__link" routerLink="/notifications" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            🔔 {{ 'nav.notifications' | translate }}
            @if (unreadCount() > 0) { <span class="drawer__badge">{{ unreadCount() }}</span> }
          </a>
          <a class="drawer__link" routerLink="/account" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">👤 {{ 'nav.my_account' | translate }}</a>
          <a class="drawer__link" routerLink="/categories" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">📁 {{ 'nav.categories' | translate }}</a>
          <a class="drawer__link" routerLink="/banking" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">🏦 Contas & Cartões</a>
          <a class="drawer__link" routerLink="/plan" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">
            🔑 {{ 'nav.access_control' | translate }}
            <span class="plan-pill" [class.plan-pill--premium]="plan.isPremium()">{{ plan.isPremium() ? 'Premium' : 'Free' }}</span>
          </a>
          <a class="drawer__link" routerLink="/alert-config" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">⚙️ {{ 'nav.alert_config' | translate }}</a>
          <a class="drawer__link" routerLink="/activity" routerLinkActive="drawer__link--active"
             (click)="drawerOpen.set(false)">📝 {{ 'nav.activity_log' | translate }}</a>
        </div>

        <div class="drawer__footer">
          <button class="drawer__logout" (click)="auth.logout()">🚪 {{ 'nav.logout' | translate }}</button>
        </div>
      </nav>

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
      display: flex; align-items: center; gap: 1rem;
      background: #2e7736; color: #fff;
      padding: 0 1.5rem; height: 52px;
      position: sticky; top: 0; z-index: 300;
      box-shadow: 0 2px 8px rgba(0,0,0,.18);
    }

    /* Hamburger — hidden on desktop */
    .hamburger {
      display: none; flex-direction: column; justify-content: center; gap: 5px;
      background: none; border: none; cursor: pointer; padding: .25rem;
      width: 36px; height: 36px; flex-shrink: 0;
    }
    .hamburger span {
      display: block; height: 2px; background: #fff; border-radius: 2px;
      transition: transform .2s, opacity .2s;
    }

    .topnav__brand {
      display: flex; align-items: center; gap: .5rem;
      font-size: 1rem; white-space: nowrap; color: #fff;
    }
    .brand-name strong { font-weight: 700; letter-spacing: .03em; }
    .brand-name { font-weight: 400; font-size: 1rem; }

    .topnav__links {
      display: flex; align-items: center; gap: .25rem; flex: 1;
    }
    .topnav__links > a, .dropdown__trigger {
      padding: .3rem .75rem; border-radius: .25rem;
      text-decoration: none; color: rgba(255,255,255,.88);
      font-size: .875rem; font-weight: 500; white-space: nowrap;
      border: none; background: none; cursor: pointer;
      transition: background .15s, color .15s;
    }
    .topnav__links > a:hover, .dropdown__trigger:hover { background: rgba(255,255,255,.12); color: #fff; }
    .topnav__links > a.active, .dropdown__trigger.active { background: rgba(255,255,255,.2); color: #fff; }

    /* Dropdown */
    .dropdown { position: relative; }
    .caret { font-size: .65rem; vertical-align: middle; margin-left: .15rem; }
    .dropdown__menu {
      display: none; position: absolute; top: calc(100% + 4px); left: 0;
      background: #fff; border-radius: .375rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 200px;
      padding: .375rem 0; z-index: 400;
    }
    .dropdown.open .dropdown__menu { display: block; }
    .dropdown__menu a {
      display: block; padding: .45rem 1rem; color: #374151;
      font-size: .875rem; text-decoration: none;
    }
    .dropdown__menu a:hover { background: #f3f4f6; }
    .dropdown__menu a.active { color: #2e7736; font-weight: 600; }

    /* Right */
    .topnav__right { display: flex; align-items: center; gap: .75rem; margin-left: auto; }
    .notif-btn { position: relative; font-size: 1.1rem; cursor: pointer; text-decoration: none; }
    .notif-badge {
      position: absolute; top: -4px; right: -6px;
      background: #ef4444; color: #fff; border-radius: 9999px;
      font-size: .6rem; padding: .05rem .3rem; font-weight: 700;
    }

    /* Language switcher */
    .lang-menu { position: relative; }
    .lang-menu__trigger {
      background: none; border: none; cursor: pointer; color: #fff;
      padding: .3rem .5rem; border-radius: .25rem; font-size: .95rem;
      transition: background .15s;
    }
    .lang-menu__trigger:hover { background: rgba(255,255,255,.12); }
    .lang-menu__dropdown {
      display: none; position: absolute; top: calc(100% + 4px); right: 0;
      background: #fff; border-radius: .375rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 150px;
      padding: .375rem 0; z-index: 400;
    }
    .lang-menu.open .lang-menu__dropdown { display: block; }
    .lang-menu__dropdown button {
      display: block; width: 100%; text-align: left;
      padding: .45rem 1rem; color: #374151; font-size: .85rem;
      background: none; border: none; cursor: pointer;
    }
    .lang-menu__dropdown button:hover { background: #f3f4f6; }
    .lang-menu__dropdown button.active { color: #2e7736; font-weight: 700; }

    .user-menu { position: relative; }
    .user-menu__trigger {
      display: flex; align-items: center; gap: .4rem;
      background: none; border: none; cursor: pointer; color: #fff;
      padding: .3rem .5rem; border-radius: .25rem; transition: background .15s;
    }
    .user-menu__trigger:hover { background: rgba(255,255,255,.12); }
    .avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(255,255,255,.25); display: flex;
      align-items: center; justify-content: center;
      font-size: .7rem; font-weight: 700; flex-shrink: 0;
    }
    .user-name { font-size: .82rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-menu__dropdown {
      display: none; position: absolute; top: calc(100% + 4px); right: 0;
      background: #fff; border-radius: .375rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 180px;
      padding: .375rem 0; z-index: 400;
    }
    .user-menu.open .user-menu__dropdown { display: block; }
    .user-menu__dropdown a, .user-menu__dropdown button {
      display: block; width: 100%; text-align: left;
      padding: .45rem 1rem; color: #374151; font-size: .875rem;
      text-decoration: none; background: none; border: none; cursor: pointer;
    }
    .user-menu__dropdown a:hover, .user-menu__dropdown button:hover { background: #f3f4f6; }
    .user-menu__dropdown hr { margin: .375rem 0; border: none; border-top: 1px solid #e5e7eb; }
    .user-menu__dropdown button { color: #ef4444; }

    .lock-dot { font-size: .65rem; opacity: .8; margin-left: .2rem; }
    .plan-pill {
      display: inline-block; margin-left: .4rem; padding: .05rem .4rem;
      border-radius: 9999px; background: #e5e7eb; color: #374151;
      font-size: .62rem; font-weight: 700; vertical-align: middle;
    }
    .plan-pill--premium { background: #2e7736; color: #fff; }
    .drawer__lock { font-size: .7rem; margin-left: .3rem; }

    /* ── Mobile Drawer ───────────────────────────────────── */
    .drawer-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      z-index: 400; display: none;
    }
    .drawer {
      position: fixed; top: 0; left: 0; bottom: 0; width: 288px;
      background: #fff; z-index: 500; display: flex; flex-direction: column;
      transform: translateX(-100%); transition: transform .28s ease;
      overflow-y: auto; box-shadow: 4px 0 24px rgba(0,0,0,.12);
    }
    .drawer--open { transform: translateX(0); }

    .drawer__head {
      display: flex; align-items: center; gap: .75rem;
      background: #2e7736; color: #fff; padding: 1rem 1rem 1rem 1.25rem;
    }
    .drawer__avatar { background: rgba(255,255,255,.25); font-size: .85rem; width: 36px; height: 36px; }
    .drawer__name { font-weight: 700; font-size: .9rem; }
    .drawer__email { font-size: .72rem; opacity: .75; }
    .drawer__close {
      margin-left: auto; background: none; border: none; color: #fff;
      font-size: 1.1rem; cursor: pointer; padding: .25rem; line-height: 1;
    }

    .drawer__langs {
      display: flex; gap: .4rem; padding: .6rem 1.25rem;
      border-bottom: 1px solid #f3f4f6;
    }
    .drawer__langs button {
      background: #f3f4f6; border: 2px solid transparent; border-radius: .375rem;
      padding: .3rem .5rem; font-size: 1rem; cursor: pointer;
    }
    .drawer__langs button.active { border-color: #2e7736; background: #f0fdf4; }

    .drawer__label {
      font-size: .68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: #9ca3af; padding: .875rem 1.25rem .35rem;
    }
    .drawer__section { padding: 0 .5rem; }
    .drawer__link {
      display: flex; align-items: center; gap: .5rem;
      padding: .7rem .875rem; border-radius: .375rem; margin-bottom: .1rem;
      color: #374151; text-decoration: none; font-size: .875rem; font-weight: 500;
      transition: background .15s;
    }
    .drawer__link:hover { background: #f3f4f6; }
    .drawer__link--active { background: #f0fdf4; color: #2e7736; font-weight: 600; }
    .drawer__badge {
      margin-left: auto; background: #ef4444; color: #fff;
      border-radius: 9999px; font-size: .65rem; padding: .1rem .4rem; font-weight: 700;
    }

    .drawer__footer {
      margin-top: auto; padding: 1rem; border-top: 1px solid #f3f4f6;
    }
    .drawer__logout {
      width: 100%; padding: .65rem 1rem; background: #fee2e2; border: none;
      border-radius: .375rem; color: #dc2626; font-size: .875rem; font-weight: 500;
      cursor: pointer; text-align: left;
    }

    .drawer__currencies { border-top: 1px solid #f3f4f6; }
    .drawer__currencies button { font-size: .72rem; font-weight: 700; letter-spacing: .04em; }

    .rate-spin {
      display: inline-block; font-size: .75rem; margin-left: .15rem;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Main ────────────────────────────────────────────── */
    .main { flex: 1; padding: 1.5rem 2rem; max-width: 1100px; margin: 0 auto; width: 100%; }

    /* ── Responsive ──────────────────────────────────────── */
    @media (max-width: 768px) {
      .hamburger { display: flex; }
      .topnav__links { display: none; }
      .user-name { display: none; }
      .main { padding: 1rem .75rem; }
      .drawer-overlay { display: block; }
    }
  `]
})
export class ShellComponent implements OnInit {
  auth = inject(AuthService);
  plan = inject(PlanService);
  settings = inject(SettingsService);
  i18n = inject(TranslationService);
  private api = inject(ApiService);
  private router = inject(Router);

  unreadCount  = signal(0);
  userMenuOpen = signal(false);
  drawerOpen   = signal(false);
  langMenuOpen = signal(false);
  currMenuOpen = signal(false);

  // Expose currency list and symbol helper to template
  currencies = CURRENCIES;
  currSymbol() { return CURRENCY_SYMBOL[this.settings.currency()]; }

  // Flag image helpers — flagcdn.com works on all platforms (no Windows emoji issue)
  private readonly CURR_FLAG: Record<CurrencyCode, string> = {
    BRL: 'br', USD: 'us', EUR: 'eu', RON: 'ro',
  };
  private readonly LANG_FLAG: Record<string, string> = {
    pt: 'br', en: 'gb', ro: 'ro',
  };
  private flagUrl(code: string): string {
    return `https://flagcdn.com/20x15/${code}.png`;
  }
  currFlag()                     { return this.flagUrl(this.CURR_FLAG[this.settings.currency()]); }
  currFlagFor(c: CurrencyCode)   { return this.flagUrl(this.CURR_FLAG[c]); }
  langFlag()                     { return this.flagUrl(this.LANG_FLAG[this.i18n.lang()] ?? 'br'); }
  langFlagFor(l: string)         { return this.flagUrl(this.LANG_FLAG[l] ?? 'br'); }

  @HostListener('document:keydown.escape')
  onEscape() { this.drawerOpen.set(false); }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  currentLangFlag(): string {
    return this.i18n.langs.find(l => l.value === this.i18n.lang())?.flag ?? '\u{1F310}';
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
    this.langMenuOpen.set(false);
  }

  setCurrency(code: CurrencyCode): void {
    this.settings.setCurrency(code);
    this.currMenuOpen.set(false);
  }

  ngOnInit(): void {
    this.plan.load();
    this.settings.load();
    this.api.get<any>('/notifications').subscribe(r => {
      const list: any[] = r.data ?? [];
      this.unreadCount.set(list.filter((n: any) => !n.read).length);
    });

    // Close menus on navigation
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.userMenuOpen.set(false);
      this.drawerOpen.set(false);
      this.langMenuOpen.set(false);
      this.currMenuOpen.set(false);
    });
  }
}
