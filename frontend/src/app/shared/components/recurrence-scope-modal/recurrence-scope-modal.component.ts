import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type RecurrenceScope = 'one' | 'future' | 'all';

/**
 * Asks how an edit/delete should propagate across a recurrence group.
 * Mirrors the pattern used by calendar apps.
 */
@Component({
  selector: 'app-recurrence-scope-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="overlay" (click)="cancelled.emit()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ mode === 'delete' ? 'Excluir lançamento recorrente' : 'Alterar lançamento recorrente' }}</h2>
          <p class="sub">
            Este lançamento se repete em outros meses. O que você quer
            {{ mode === 'delete' ? 'excluir' : 'alterar' }}?
          </p>

          <div class="opts">
            <button type="button" class="opt" [class.opt--sel]="scope === 'one'" (click)="scope = 'one'">
              <span class="opt__radio"></span>
              <span class="opt__txt">
                <strong>Somente este</strong>
                <small>Os demais meses ficam como estão</small>
              </span>
            </button>

            <button type="button" class="opt" [class.opt--sel]="scope === 'future'" (click)="scope = 'future'">
              <span class="opt__radio"></span>
              <span class="opt__txt">
                <strong>Este e os próximos</strong>
                <small>Meses anteriores não são afetados</small>
              </span>
            </button>

            <button type="button" class="opt" [class.opt--sel]="scope === 'all'" (click)="scope = 'all'">
              <span class="opt__radio"></span>
              <span class="opt__txt">
                <strong>Todos da série</strong>
                <small>Inclusive os meses já passados</small>
              </span>
            </button>
          </div>

          <div class="actions">
            <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">Cancelar</button>
            <button type="button" class="btn"
                    [class.btn--danger]="mode === 'delete'"
                    [class.btn--primary]="mode !== 'delete'"
                    (click)="confirmed.emit(scope)">
              {{ mode === 'delete' ? 'Excluir' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .modal { background: #fff; border-radius: .625rem; padding: 1.5rem; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,.22); }
    h2 { margin: 0 0 .35rem; font-size: 1.05rem; color: #111; }
    .sub { margin: 0 0 1.1rem; font-size: .85rem; color: #6b7280; line-height: 1.5; }

    .opts { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1.25rem; }
    .opt {
      display: flex; align-items: flex-start; gap: .65rem; width: 100%; text-align: left;
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: .5rem;
      padding: .7rem .85rem; cursor: pointer; transition: all .15s;
    }
    .opt:hover { border-color: #9ca3af; }
    .opt--sel { border-color: #2e7736; background: #f0fdf4; }
    .opt__radio {
      width: 16px; height: 16px; flex-shrink: 0; margin-top: .15rem;
      border: 2px solid #9ca3af; border-radius: 50%; transition: all .15s;
    }
    .opt--sel .opt__radio { border-color: #2e7736; border-width: 5px; }
    .opt__txt { display: flex; flex-direction: column; gap: .1rem; }
    .opt__txt strong { font-size: .85rem; color: #111; font-weight: 600; }
    .opt__txt small { font-size: .74rem; color: #6b7280; }

    .actions { display: flex; justify-content: flex-end; gap: .6rem; }
    .btn { padding: .5rem 1rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .85rem; font-weight: 600; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--danger  { background: #dc2626; color: #fff; }
    .btn--ghost   { background: #fff; border: 1px solid #d1d5db; color: #374151; }

    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .modal { background: #161c28 !important; }
    :host-context([data-theme="dark"]) h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sub,
    :host-context([data-theme="dark"]) .opt__txt small { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .opt { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .opt--sel { background: rgba(74,222,128,.12) !important; border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .opt--sel .opt__radio { border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .opt__txt strong { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .btn--ghost { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
  `]
})
export class RecurrenceScopeModalComponent {
  @Input() visible = false;
  /** 'edit' shows "Salvar", 'delete' shows a red "Excluir". */
  @Input() mode: 'edit' | 'delete' = 'edit';

  @Output() confirmed = new EventEmitter<RecurrenceScope>();
  @Output() cancelled = new EventEmitter<void>();

  scope: RecurrenceScope = 'one';
}
