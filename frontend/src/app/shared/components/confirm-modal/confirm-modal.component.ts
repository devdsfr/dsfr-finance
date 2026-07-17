import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="modal-overlay" (click)="cancelled.emit()">
        <div class="confirm-modal" (click)="$event.stopPropagation()">
          <div class="confirm-icon">{{ icon }}</div>
          <h3 class="confirm-title">{{ title }}</h3>
          <p class="confirm-msg" [innerHTML]="message"></p>
          @if (subMessage) {
            <p class="confirm-sub">{{ subMessage }}</p>
          }
          <div class="confirm-actions">
            <button class="btn btn--ghost" (click)="cancelled.emit()">Cancelar</button>
            <button class="btn btn--danger" (click)="confirmed.emit()">{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 1rem;
    }
    .confirm-modal {
      background: #fff; border-radius: .875rem; padding: 2rem 1.75rem;
      width: 100%; max-width: 400px; text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
      animation: pop-in .18s ease;
    }
    @keyframes pop-in {
      from { transform: scale(.92); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
    .confirm-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .confirm-title { font-size: 1.1rem; font-weight: 700; color: #111; margin: 0 0 .5rem; }
    .confirm-msg { font-size: .875rem; color: #374151; line-height: 1.55; margin: 0 0 .35rem; }
    .confirm-sub { font-size: .78rem; color: #9ca3af; margin: 0 0 1.5rem; }
    .confirm-actions { display: flex; gap: .75rem; justify-content: center; }
    .btn { padding: .5rem 1.1rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .875rem; font-weight: 600; }
    .btn--ghost { background: none; color: #374151; border: 1px solid #d1d5db; }
    .btn--danger { background: #ef4444; color: #fff; }
    .btn--danger:hover { background: #dc2626; }
  `]
})
export class ConfirmModalComponent {
  @Input() visible = false;
  @Input() icon = '🗑️';
  @Input() title = 'Excluir registro';
  @Input() message = 'Tem certeza que deseja excluir este registro?';
  @Input() subMessage = 'Essa ação não pode ser desfeita.';
  @Input() confirmLabel = 'Excluir';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
