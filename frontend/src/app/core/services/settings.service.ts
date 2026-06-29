import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'RON';

export const CURRENCIES: { value: CurrencyCode; label: string; locale: string; flag: string }[] = [
  { value: 'BRL', label: 'R$ -- Real brasileiro',  locale: 'pt-BR', flag: '\u{1F1E7}\u{1F1F7}' },
  { value: 'USD', label: '$ -- US Dollar',          locale: 'en-US', flag: '\u{1F1FA}\u{1F1F8}' },
  { value: 'EUR', label: '\u20AC -- Euro',          locale: 'en-US', flag: '\u{1F1EA}\u{1F1FA}' },
  { value: 'RON', label: 'Lei -- Leu romanesc',     locale: 'ro-RO', flag: '\u{1F1F7}\u{1F1F4}' },
];

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  BRL: 'R$', USD: 'US$', EUR: '\u20AC', RON: 'Lei',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private api = inject(ApiService);

  currency     = signal<CurrencyCode>('BRL');
  exchangeRate = signal<number>(1);
  rateLoading  = signal<boolean>(false);
  loaded       = signal(false);

  localeFor(code: CurrencyCode): string {
    return CURRENCIES.find(c => c.value === code)?.locale ?? 'pt-BR';
  }

  load() {
    this.api.get<any>('/me').subscribe({
      next: r => {
        if (r.currency) {
          const code = r.currency as CurrencyCode;
          this.currency.set(code);
          if (code !== 'BRL') this.fetchExchangeRate(code);
        }
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  setCurrency(code: CurrencyCode) {
    this.currency.set(code);
    if (code === 'BRL') {
      this.exchangeRate.set(1);
    } else {
      this.fetchExchangeRate(code);
    }
    return this.api.put('/me/settings', { currency: code });
  }

  fetchExchangeRate(target: CurrencyCode) {
    this.rateLoading.set(true);
    // Use native fetch to bypass Angular interceptors (avoids CORS preflight from auth header)
    fetch('https://open.er-api.com/v6/latest/BRL')
      .then(r => r.json())
      .then((res: any) => {
        const rate = res?.rates?.[target];
        if (rate) this.exchangeRate.set(rate);
        this.rateLoading.set(false);
      })
      .catch(() => {
        this.rateLoading.set(false);
      });
  }
}
