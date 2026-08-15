import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Fecha o modal só quando o clique começa E termina no próprio backdrop.
 *
 * O `(click)` puro no overlay tem um defeito clássico: o evento `click` é
 * disparado no ancestral comum entre o alvo do mousedown e o do mouseup.
 * Se o usuário aperta o mouse dentro de um input (para selecionar o texto)
 * e solta fora do modal, o alvo do clique vira o overlay — e o modal fecha
 * no meio da digitação.
 *
 * Ouvindo o mousedown e exigindo `target === currentTarget`, o fechamento
 * só acontece quando o gesto realmente começou no fundo escuro.
 */
@Directive({
  selector: '[appDismissOnBackdrop]',
  standalone: true,
})
export class DismissOnBackdropDirective {
  @Output() backdropDismiss = new EventEmitter<void>();

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.backdropDismiss.emit();
    }
  }
}
