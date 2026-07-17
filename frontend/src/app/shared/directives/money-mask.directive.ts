import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';

// Currency-aware money input. Use on a <input type="text" inputmode="decimal">
// bound with [(ngModel)] to a plain number — the directive only changes how
// it LOOKS (e.g. "R$ 2.000,00" once you tab away), the bound value stays a
// normal JS number for the backend.
//
// - While focused: shows the raw editable number (no symbol/grouping) so
//   typing/editing isn't fighting a live mask.
// - On blur: reformats using Intl.NumberFormat with the user's current
//   currency + locale from SettingsService.
// - Typing "2000" and tabbing away renders "R$ 2.000,00"; typing a full
//   formatted value like "2.000,00" also parses correctly (the *last*
//   separator typed is treated as the decimal point, earlier ones as
//   thousands separators and discarded).
@Directive({
  selector: '[appMoneyMask]',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => MoneyMaskDirective),
    multi: true,
  }],
  host: {
    '(input)': 'onInput($event)',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
  },
})
export class MoneyMaskDirective implements ControlValueAccessor {
  private el = inject(ElementRef<HTMLInputElement>);
  private settings = inject(SettingsService);

  private value: number | null = null;
  private focused = false;
  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    this.value = value === undefined ? null : value;
    if (!this.focused) this.renderFormatted();
  }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.el.nativeElement.disabled = isDisabled; }

  onFocus(): void {
    this.focused = true;
    this.el.nativeElement.value = this.value != null ? String(this.value) : '';
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.value = parseMoney(raw);
    this.onChange(this.value);
  }

  onBlur(): void {
    this.focused = false;
    this.onTouched();
    this.renderFormatted();
  }

  private renderFormatted(): void {
    const input = this.el.nativeElement;
    if (this.value == null || isNaN(this.value)) {
      input.value = '';
      return;
    }
    const code = this.settings.currency();
    const locale = this.settings.localeFor(code);
    input.value = new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(this.value);
  }
}

// Exported standalone so it can be unit-tested / reused (e.g. for paste handling).
export function parseMoney(raw: string): number | null {
  const onlyValid = raw.replace(/[^0-9.,]/g, '');
  if (!onlyValid) return null;
  const lastComma = onlyValid.lastIndexOf(',');
  const lastDot = onlyValid.lastIndexOf('.');
  const sepIndex = Math.max(lastComma, lastDot);

  let intPart: string;
  let decPart: string;
  if (sepIndex === -1) {
    intPart = onlyValid;
    decPart = '';
  } else {
    intPart = onlyValid.slice(0, sepIndex).replace(/[.,]/g, '');
    decPart = onlyValid.slice(sepIndex + 1).replace(/[.,]/g, '').slice(0, 2);
  }
  intPart = intPart.replace(/[.,]/g, '') || '0';
  const num = parseFloat(`${intPart}.${decPart || '0'}`);
  return isNaN(num) ? null : num;
}
