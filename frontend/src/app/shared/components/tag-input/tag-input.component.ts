import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';

interface Tag { id: string; name: string; color?: string; }

@Component({
  selector: 'app-tag-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- AC-TG-04: tags as easy-access field in the transaction form -->
    <div class="tag-input">
      <div class="tag-input__selected">
        @for (tag of selected; track tag.id) {
          <span class="tag" [style.background]="tag.color || '#6366f1'">
            {{ tag.name }}
            <button type="button" (click)="remove(tag)">×</button>
          </span>
        }
        <input
          type="text"
          [(ngModel)]="query"
          (ngModelChange)="search$.next($event)"
          placeholder="Adicionar tag..."
          [attr.list]="'tag-suggestions-' + uid"
        />
      </div>
      <!-- AC-TG-05: auto-suggest tags -->
      <datalist [id]="'tag-suggestions-' + uid">
        @for (s of suggestions; track s.id) {
          <option [value]="s.name" (mousedown)="addByName(s.name)">{{ s.name }}</option>
        }
      </datalist>
    </div>
  `,
  styles: [`
    .tag-input { border: 1px solid #d1d5db; border-radius: .375rem; padding: .375rem; }
    .tag-input__selected { display: flex; flex-wrap: wrap; gap: .25rem; align-items: center; }
    .tag { color: #fff; padding: .125rem .5rem; border-radius: 9999px; font-size: .75rem;
           display: flex; align-items: center; gap: .25rem; }
    .tag button { background: none; border: none; color: #fff; cursor: pointer; font-size: .9rem; }
    input { border: none; outline: none; flex: 1; min-width: 120px; font-size: .9rem; }
  `]
})
export class TagInputComponent implements OnInit {
  @Input() selected: Tag[] = [];
  @Input() description = '';
  @Output() selectedChange = new EventEmitter<Tag[]>();

  suggestions: Tag[] = [];
  query = '';
  search$ = new Subject<string>();
  uid = Math.random().toString(36).slice(2);

  private api = inject(ApiService);

  ngOnInit(): void {
    // AC-TG-05: suggest on description change
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => this.api.get<any>('/transactions/tag-suggestions', { description: q || this.description }))
    ).subscribe(res => this.suggestions = res.data ?? []);
    if (this.description) this.search$.next(this.description);
  }

  addByName(name: string): void {
    const tag = this.suggestions.find(s => s.name === name);
    if (tag && !this.selected.find(s => s.id === tag.id)) {
      const updated = [...this.selected, tag];
      this.selectedChange.emit(updated);
    }
    this.query = '';
  }

  remove(tag: Tag): void {
    this.selectedChange.emit(this.selected.filter(s => s.id !== tag.id));
  }
}
