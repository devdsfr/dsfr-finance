import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { SettingsService } from '../../core/services/settings.service';

// Impure so it re-runs when the currency signal or exchange rate signal changes.
@Pipe({ name: 'appCurrency', standalone: true, pure: false })
export class AppCurrencyPipe implements PipeTransform {
  private settings = inject(SettingsService);
  private currencyPipe = new CurrencyPipe('en-US');

  transform(value: number | null | undefined, digits = '1.2-2'): string {
    if (value === null || value === undefined) return '';
    const code      = this.settings.currency();
    const locale    = this.settings.localeFor(code);
    const rate      = this.settings.exchangeRate();
    const converted = value * rate;
    return this.currencyPipe.transform(converted, code, 'symbol', digits, locale) ?? '';
  }
}
