import { Component, Input, Output, EventEmitter, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';

interface Tag { id: string; name: string; color?: string; }

@Component({
  selector: 'app-tag-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tag-wrap" (click)="$event.stopPropagation()">
      <div class="tag-box" (click)="focusInput()">
        @for (tag of selected; track tag.id) {
          <span class="tag-chip" [style.background]="tag.color || '#6366f1'">
            {{ tag.name }}
            <button type="button" (click)="remove(tag)">x</button>
          </span>
        }
        <input #inp
          type="text"
          [(ngModel)]="query"
          (ngModelChange)="onType($event)"
          (keydown.enter)="pickFirst($event)"
          (keydown.escape)="close()"
          (focus)="onFocus()"
          placeholder="{{ selected.length ? '' : 'Adicionar tag...' }}"
          class="tag-input"
        />
      </div>

      @if (open && suggestions.length > 0) {
        <ul class="tag-dropdown">
          @for (s of suggestions; track s.id) {
            <li (mousedown)="pick(s)">
              <span class="dot" [style.background]="s.color || '#6366f1'"></span>
              {{ s.name }}
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .tag-wrap { position: relative; }
    .tag-box {
      display: flex; flex-wrap: wrap; gap: .25rem; align-items: center;
      border: 1px solid #d1d5db; border-radius: .375rem; padding: .35rem .5rem;
      cursor: text; min-height: 38px;
    }
    .tag-box:focus-within { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.15); }
    .tag-chip {
      color: #fff; padding: .15rem .5rem; border-radius: 9999px; font-size: .75rem;
      display: flex; align-items: center; gap: .3rem;
    }
    .tag-chip button { background: none; border: none; color: #fff; cursor: pointer; font-size: .85rem; line-height: 1; padding: 0; }
    .tag-input { border: none; outline: none; flex: 1; min-width: 100px; font-size: .875rem; background: transparent; }
    .tag-dropdown {
      position: absolute; top: calc(100% + 3px); left: 0; right: 0;
      background: #fff; border: 1px solid #e5e7eb; border-radius: .375rem;
      box-shadow: 0 4px 16px rgba(0,0,0,.1); list-style: none; padding: .25rem 0;
      margin: 0; z-index: 500; max-height: 200px; overflow-y: auto;
    }
    .tag-dropdown li {
      display: flex; align-items: center; gap: .5rem;
      padding: .45rem .75rem; cursor: pointer; font-size: .875rem; color: #374151;
    }
    .tag-dropdown li:hover { background: #f3f4f6; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  `]
})
export class TagInputComponent implements OnInit {
  @Input() selected: Tag[] = [];
  @Input() description = '';
  @Output() selectedChange = new EventEmitter<Tag[]>();

  suggestions: Tag[] = [];
  query = '';
  open = false;
  search$ = new Subject<string>();

  private api = inject(ApiService);

  @HostListener('document:click')
  onDocClick() { this.close(); }

  ngOnInit(): void {
    // AC-TG-05: load suggestions as user types
    this.search$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q && !this.description) return of({ data: [] });
        return this.api.get<any>('/transactions/tag-suggestions', { description: q || this.description });
      })
    ).subscribe(res => {
      this.suggestions = (res.data ?? []).filter((s: Tag) =>
        !this.selected.find(sel => sel.id === s.id)
      );
      this.open = this.suggestions.length > 0;
    });
    // Pre-load based on description
    if (this.description) { this.search$.next(''); }
  }

  onType(q: string): void {
    this.search$.next(q);
  }

  onFocus(): void {
    this.search$.next(this.query);
  }

  focusInput(): void {
    const inp = document.querySelector('.tag-input') as HTMLInputElement;
    inp?.focus();
  }

  pick(tag: Tag): void {
    if (!this.selected.find(s => s.id === tag.id)) {
      this.selectedChange.emit([...this.selected, tag]);
    }
    this.query = '';
    this.open = false;
  }

  pickFirst(e: Event): void {
    if (this.suggestions.length) { e.preventDefault(); this.pick(this.suggestions[0]); }
  }

  remove(tag: Tag): void {
    this.selectedChange.emit(this.selected.filter(s => s.id !== tag.id));
  }

  close(): void { this.open = false; }
}
