import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

const STORAGE_KEY = 'dsfr_cookie_consent';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    @if (visible()) {
      <div class="cookie-banner">
        <p>
          {{ 'legal.cookie_message' | translate }}
          <a routerLink="/legal/privacy">{{ 'legal.cookie_learn_more' | translate }}</a>
        </p>
        <button class="cookie-accept" (click)="accept()">{{ 'legal.cookie_accept' | translate }}</button>
      </div>
    }
  `,
  styles: [`
    .cookie-banner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000;
      background: #111827; color: #e5e7eb;
      padding: 1rem 1.5rem; display: flex; align-items: center; gap: 1.5rem;
      flex-wrap: wrap; justify-content: center;
      box-shadow: 0 -2px 12px rgba(0,0,0,.2);
    }
    .cookie-banner p { margin: 0; font-size: .85rem; max-width: 640px; line-height: 1.5; }
    .cookie-banner a { color: #6ee7b7; text-decoration: underline; }
    .cookie-accept {
      background: #2e7736; color: #fff; border: none; border-radius: .375rem;
      padding: .55rem 1.5rem; font-weight: 600; font-size: .85rem; cursor: pointer;
      white-space: nowrap;
    }
    .cookie-accept:hover { background: #235c29; }
  `]
})
export class CookieConsentComponent {
  i18n = inject(TranslationService);
  visible = signal(localStorage.getItem(STORAGE_KEY) !== 'accepted');

  accept(): void {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    this.visible.set(false);
  }
}
