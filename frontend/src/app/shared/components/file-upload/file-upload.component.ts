import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- AC-UX-04: comprovante attachment -->
    <div class="file-upload" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
      @if (fileName) {
        <div class="file-upload__preview">
          <span>📎 {{ fileName }}</span>
          <button type="button" (click)="clear()">Remover</button>
        </div>
      } @else {
        <label class="file-upload__area">
          <input type="file" [accept]="accept" (change)="onChange($event)" hidden />
          <span>Clique ou arraste um comprovante (imagem ou PDF)</span>
        </label>
      }
    </div>
  `,
  styles: [`
    .file-upload__area {
      display: block; border: 2px dashed #d1d5db; border-radius: .375rem;
      padding: 1rem; text-align: center; cursor: pointer; color: #6b7280; font-size: .875rem;
    }
    .file-upload__area:hover { border-color: #6366f1; color: #6366f1; }
    .file-upload__preview {
      display: flex; justify-content: space-between; align-items: center;
      background: #f3f4f6; padding: .5rem .75rem; border-radius: .375rem;
    }
    .file-upload__preview button {
      background: none; border: none; color: #ef4444; cursor: pointer; font-size: .8rem;
    }
  `]
})
export class FileUploadComponent {
  @Input() accept = 'image/*,application/pdf';
  @Output() fileSelected = new EventEmitter<File | null>();

  fileName = '';

  onChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) { this.fileName = file.name; this.fileSelected.emit(file); }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) { this.fileName = file.name; this.fileSelected.emit(file); }
  }

  clear(): void { this.fileName = ''; this.fileSelected.emit(null); }
}
