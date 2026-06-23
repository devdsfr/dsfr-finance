import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslationService } from '../../core/services/translation.service';
import { Lang } from '../../core/i18n/translations';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="landing">
      <header class="lp-header">
        <div class="lp-brand">💰 dsfr-finance</div>
        <div class="lp-header__right">
          <div class="lang-bar">
            @for (l of i18n.langs; track l.value) {
              <button [class.active]="i18n.lang() === l.value" (click)="setLang(l.value)">{{ l.flag }}</button>
            }
          </div>
          <a routerLink="/auth/login" class="lp-login-link">{{ 'landing.cta_login' | translate }}</a>
        </div>
      </header>

      <section class="hero">
        <h1>{{ 'landing.hero_title' | translate }}</h1>
        <p>{{ 'landing.hero_subtitle' | translate }}</p>
        <a routerLink="/auth/register" class="cta-btn">{{ 'landing.cta_start' | translate }}</a>
      </section>

      <section class="features">
        <div class="feature">
          <span class="feature__icon">📊</span>
          <strong>Relatórios &amp; Dashboard</strong>
          <p>Visão geral, fluxo de caixa, evolução patrimonial e categorias.</p>
        </div>
        <div class="feature">
          <span class="feature__icon">🎯</span>
          <strong>Limites de Gastos</strong>
          <p>Defina metas por categoria e receba alertas antes de passar do limite.</p>
        </div>
        <div class="feature">
          <span class="feature__icon">💳</span>
          <strong>Contas &amp; Cartões</strong>
          <p>Controle contas bancárias e faturas de cartão de crédito em um só lugar.</p>
        </div>
        <div class="feature">
          <span class="feature__icon">🔐</span>
          <strong>Segurança</strong>
          <p>Autenticação em dois fatores (2FA) e log de atividades.</p>
        </div>
      </section>

      <section class="pricing">
        <h2>{{ 'landing.cta_start' | translate }}</h2>
        <div class="plans">
          <div class="plan-card">
            <h3>{{ 'landing.plan_free' | translate }}</h3>
            <div class="plan-price">€0</div>
            <p>{{ 'landing.plan_free_desc' | translate }}</p>
            <a routerLink="/auth/register" class="plan-btn plan-btn--outline">{{ 'landing.cta_start' | translate }}</a>
          </div>
          <div class="plan-card plan-card--highlight">
            <h3>{{ 'landing.plan_pro' | translate }}</h3>
            <div class="plan-price">€3.99<span>{{ 'landing.per_month' | translate }}</span></div>
            <div class="plan-price-alt">€39{{ 'landing.per_year' | translate }}</div>
            <p>{{ 'landing.plan_pro_desc' | translate }}</p>
            <a routerLink="/auth/register" class="plan-btn">{{ 'landing.cta_start' | translate }}</a>
          </div>
          <div class="plan-card">
            <h3>{{ 'landing.plan_family' | translate }}</h3>
            <div class="plan-price">€6.99<span>{{ 'landing.per_month' | translate }}</span></div>
            <p>{{ 'landing.plan_family_desc' | translate }}</p>
            <a routerLink="/auth/register" class="plan-btn plan-btn--outline">{{ 'landing.cta_start' | translate }}</a>
          </div>
        </div>
      </section>

      <footer class="lp-footer">
        <a routerLink="/legal/privacy">{{ 'legal.privacy_title' | translate }}</a>
        <span>·</span>
        <a routerLink="/legal/terms">{{ 'legal.terms_title' | translate }}</a>
        <span>·</span>
        <span>© {{ year }} dsfr-finance</span>
      </footer>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    .landing { min-height: 100vh; background: #f8fafc; }

    .lp-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 2rem; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .lp-brand { font-weight: 700; font-size: 1.1rem; color: #111; }
    .lp-header__right { display: flex; align-items: center; gap: 1rem; }
    .lang-bar { display: flex; gap: .3rem; }
    .lang-bar button { background: #f3f4f6; border: 2px solid transparent; border-radius: .375rem; padding: .25rem .5rem; font-size: .95rem; cursor: pointer; }
    .lang-bar button.active { border-color: #2e7736; }
    .lp-login-link { color: #2e7736; text-decoration: none; font-weight: 600; font-size: .875rem; }

    .hero { text-align: center; padding: 4rem 1.5rem 3rem; max-width: 720px; margin: 0 auto; }
    .hero h1 { font-size: 2.1rem; color: #111; margin-bottom: .75rem; line-height: 1.25; }
    .hero p { font-size: 1.05rem; color: #6b7280; margin-bottom: 2rem; }
    .cta-btn {
      display: inline-block; background: #2e7736; color: #fff; text-decoration: none;
      padding: .85rem 2rem; border-radius: .5rem; font-weight: 700; font-size: 1rem;
    }
    .cta-btn:hover { background: #235c29; }

    .features {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem; max-width: 1000px; margin: 0 auto 4rem; padding: 0 1.5rem;
    }
    .feature { background: #fff; border-radius: .5rem; padding: 1.5rem; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
    .feature__icon { font-size: 2rem; display: block; margin-bottom: .5rem; }
    .feature strong { display: block; color: #111; margin-bottom: .4rem; }
    .feature p { font-size: .85rem; color: #6b7280; margin: 0; }

    .pricing { padding: 1rem 1.5rem 4rem; max-width: 1000px; margin: 0 auto; text-align: center; }
    .pricing h2 { font-size: 1.4rem; color: #111; margin-bottom: 2rem; }
    .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; }
    .plan-card { background: #fff; border-radius: .75rem; padding: 2rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.06); border: 2px solid transparent; }
    .plan-card--highlight { border-color: #2e7736; transform: scale(1.03); }
    .plan-card h3 { font-size: 1.1rem; color: #111; margin: 0 0 .75rem; }
    .plan-price { font-size: 1.8rem; font-weight: 700; color: #2e7736; margin-bottom: .25rem; }
    .plan-price span { font-size: .85rem; font-weight: 400; color: #9ca3af; }
    .plan-price-alt { font-size: .8rem; color: #9ca3af; margin-bottom: .75rem; }
    .plan-card p { font-size: .85rem; color: #6b7280; min-height: 60px; margin-bottom: 1.25rem; }
    .plan-btn {
      display: block; padding: .65rem; border-radius: .375rem; text-decoration: none;
      font-weight: 600; font-size: .9rem; background: #2e7736; color: #fff;
    }
    .plan-btn--outline { background: none; border: 1px solid #2e7736; color: #2e7736; }

    .lp-footer {
      text-align: center; padding: 2rem 1.5rem; color: #9ca3af; font-size: .8rem;
      display: flex; justify-content: center; gap: .6rem; flex-wrap: wrap;
    }
    .lp-footer a { color: #6b7280; text-decoration: none; }
    .lp-footer a:hover { color: #2e7736; }
  `]
})
export class LandingComponent {
  i18n = inject(TranslationService);
  year = new Date().getFullYear();

  setLang(lang: Lang): void { this.i18n.setLang(lang); }
}
