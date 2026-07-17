import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.type" (click)="toastSvc.dismiss(toast.id)">
          <span class="toast__icon">
            {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ' }}
          </span>
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      display: flex; flex-direction: column; gap: .5rem; z-index: 9999;
    }
    .toast {
      display: flex; align-items: center; gap: .5rem;
      padding: .75rem 1.25rem; border-radius: .5rem;
      cursor: pointer; animation: slide-in .2s ease;
      color: #fff; font-size: .9rem; min-width: 220px;
    }
    .toast--success { background: #22c55e; }
    .toast--error   { background: #ef4444; }
    .toast--info    { background: #3b82f6; }
    .toast--warning { background: #f59e0b; }
    @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } }
  `]
})
export class ToastComponent {
  toastSvc = inject(ToastService);
}
