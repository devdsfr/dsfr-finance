import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { SettingsService } from '../../core/services/settings.service';

// Wraps Angular's CurrencyPipe, but reads the currency code + matching
// locale from SettingsService instead of a hardcoded 'BRL'/'pt-BR' — this is
// what lets every screen switch currency (BRL/USD/EUR/RON) without each one
// having to know about the user's preference individually.
// Impure for the same reason TranslatePipe is: it must re-run when the
// underlying signal changes, not just when its own argument changes.
@Pipe({ name: 'appCurrency', standalone: true, pure: false })
export class AppCurrencyPipe implements PipeTransform {
  private settings = inject(SettingsService);
  private currencyPipe = new CurrencyPipe('en-US'); // locale is overridden per-call below

  transform(value: number | null | undefined, digits = '1.2-2'): string {
    if (value === null || value === undefined) return '';
    const code = this.settings.currency();
    const locale = this.settings.localeFor(code);
    return this.currencyPipe.transform(value, code, 'symbol', digits, locale) ?? '';
  }
}
