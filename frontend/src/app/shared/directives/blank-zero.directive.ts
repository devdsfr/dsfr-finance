import { Directive, ElementRef, HostListener, inject, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Campos de valor que começam vazios em vez de mostrar "0".
 *
 * Sem isso, um input numérico zerado exibe "0" e o usuário acaba digitando
 * depois dele — vira "0500" — ou precisa selecionar o zero para substituir,
 * gesto que é a origem de vários acidentes de UI.
 *
 * Ao focar: se o valor é zero, limpa o campo para digitar direto.
 *           Se já tem número, seleciona tudo para sobrescrever numa tecla.
 * Ao sair:  campo vazio permanece nulo. O backend em Go converte null para
 *           zero naturalmente, então nada quebra.
 */
@Directive({
  selector: 'input[appBlankZero]',
  standalone: true,
})
export class BlankZeroDirective {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor(@Optional() private ngControl: NgControl) {}

  @HostListener('focus')
  onFocus(): void {
    const input = this.el.nativeElement;
    if (input.value === '' || Number(input.value) === 0) {
      input.value = '';
      this.ngControl?.control?.setValue(null, { emitEvent: true });
    } else {
      input.select();
    }
  }

  @HostListener('blur')
  onBlur(): void {
    if (this.el.nativeElement.value === '') {
      this.ngControl?.control?.setValue(null, { emitEvent: true });
    }
  }
}
