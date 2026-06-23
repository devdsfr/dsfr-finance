import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'RON';

// Locales are limited to ones we've registered in app.config.ts (pt-BR,
// en-US built-in, ro-RO) — adding a new currency/locale also means adding a
// registerLocaleData() call there, or CurrencyPipe throws at runtime.
export const CURRENCIES: { value: CurrencyCode; label: string; locale: string }[] = [
  { value: 'BRL', label: 'R$ — Real brasileiro',  locale: 'pt-BR' },
  { value: 'USD', label: '$ — US Dollar',          locale: 'en-US' },
  { value: 'EUR', label: '€ — Euro',                locale: 'en-US' },
  { value: 'RON', label: 'Lei — Leu românesc',      locale: 'ro-RO' },
];

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private api = inject(ApiService);

  currency = signal<CurrencyCode>('BRL');
  loaded = signal(false);

  localeFor(code: CurrencyCode): string {
    return CURRENCIES.find(c => c.value === code)?.locale ?? 'pt-BR';
  }

  load() {
    this.api.get<any>('/me').subscribe({
      next: r => {
        if (r.currency) this.currency.set(r.currency);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  setCurrency(code: CurrencyCode) {
    this.currency.set(code);
    return this.api.put('/me/settings', { currency: code });
  }
}
