import { Component, inject, signal, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

export interface ParsedTransaction {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;       // YYYY-MM-DD
  category_name: string;
  paid: boolean;
  selected: boolean;  // UI only
}

// ── Organizze "Relatório de categorias" text parser ──────────────────────────
function parseCurrencyBR(raw: string): number {
  // "3.850,00" → 3850.00
  return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
}
function parseDateBR(raw: string): string {
  // "15/06/2026" → "2026-06-15"
  const [d, m, y] = raw.split('/');
  return `${y}-${m}-${d}`;
}

const RE_SECTION  = /^(Despesas|Receitas)$/i;
const RE_CAT      = /^(.+?)\s+\d+,\d{2}%\s+R\$\s*[\d.]+,\d{2}$/;
const RE_TX       = /^(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+R\$\s*([\d.]+,\d{2})$/;
const RE_TOTAL    = /^Total\s+\d+/i;
const RE_PERIOD   = /^De\s+\d+/i;
const RE_TITLE    = /^Relatório/i;

export function parseOrganizzeCatText(text: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const result: ParsedTransaction[] = [];

  let section: 'income' | 'expense' = 'expense';
  let currentCategory = '';

  for (const line of lines) {
    if (RE_SECTION.test(line)) {
      section = /Receitas/i.test(line) ? 'income' : 'expense';
      currentCategory = '';
      continue;
    }
    if (RE_TOTAL.test(line) || RE_PERIOD.test(line) || RE_TITLE.test(line)) {
      continue;
    }
    // Category header: "Cartão de crédito 37,89% R$ 7.650,00"
    const catMatch = line.match(RE_CAT);
    if (catMatch && !RE_TX.test(line)) {
      currentCategory = catMatch[1].trim();
      continue;
    }
    // Transaction: "Fatura 15/06/2026 R$ 3.850,00"
    const txMatch = line.match(RE_TX);
    if (txMatch) {
      result.push({
        description:   txMatch[1].trim(),
        date:          parseDateBR(txMatch[2]),
        amount:        parseCurrencyBR(txMatch[3]),
        type:          section,
        category_name: currentCategory,
        paid:          true,
        selected:      true,
      });
    }
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'done';

@Component({
  selector: 'app-import-organizze',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Trigger button — rendered inline by parent -->
    @if (step() === 'idle') {
      <button class="btn-import" (click)="trigger.click()" [disabled]="loading()">
        📥 Importar PDF Organizze
      </button>
      <input #trigger type="file" accept=".pdf" style="display:none"
             (change)="onFile($event)" />
    }

    <!-- Modal overlay -->
    @if (step() !== 'idle') {
      <div class="overlay" (click)="$event.stopPropagation()">
        <div class="modal" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="modal__head">
            <div>
              <h2>Importar do Organizze</h2>
              @if (step() === 'preview') {
                <p class="sub">{{ selectedCount() }} lançamentos selecionados · {{ filename() }}</p>
              }
              @if (step() === 'done') {
                <p class="sub done">✅ Importação concluída</p>
              }
            </div>
            <button class="close-btn" (click)="close()">✕</button>
          </div>

          <!-- Loading spinner -->
          @if (loading()) {
            <div class="spinner-wrap">
              <div class="spinner"></div>
              <p>Lendo PDF...</p>
            </div>
          }

          <!-- Preview table -->
          @if (step() === 'preview' && !loading()) {
            <div class="toolbar">
              <button class="link-btn" (click)="selectAll(true)">Selecionar todos</button>
              <span class="sep">·</span>
              <button class="link-btn" (click)="selectAll(false)">Desmarcar todos</button>
              <span class="sep">·</span>
              <span class="count income">{{ incomeCount() }} receitas</span>
              <span class="sep">·</span>
              <span class="count expense">{{ expenseCount() }} despesas</span>
            </div>

            <div class="table-wrap">
              <table class="prev-table">
                <thead>
                  <tr>
                    <th class="chk-col">
                      <input type="checkbox" [checked]="allSelected()" (change)="selectAll($any($event.target).checked)" />
                    </th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th class="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (tx of rows(); track $index) {
                    <tr [class.unselected]="!tx.selected">
                      <td class="chk-col">
                        <input type="checkbox" [(ngModel)]="tx.selected"
                               [ngModelOptions]="{standalone:true}" />
                      </td>
                      <td>{{ tx.description }}</td>
                      <td class="cat">{{ tx.category_name || '—' }}</td>
                      <td class="date">{{ tx.date | date:'dd/MM/yyyy' }}</td>
                      <td>
                        <span class="badge" [class.badge--in]="tx.type==='income'"
                              [class.badge--ex]="tx.type==='expense'">
                          {{ tx.type === 'income' ? 'Receita' : 'Despesa' }}
                        </span>
                      </td>
                      <td class="num" [class.red]="tx.type==='expense'" [class.green]="tx.type==='income'">
                        {{ tx.amount | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="modal__foot">
              <button class="btn btn--ghost" (click)="close()">Cancelar</button>
              <button class="btn btn--primary" (click)="confirmImport()" [disabled]="selectedCount() === 0">
                Importar {{ selectedCount() }} lançamentos
              </button>
            </div>
          }

          <!-- Done screen -->
          @if (step() === 'done') {
            <div class="done-screen">
              <div class="done-icon">✅</div>
              <p><strong>{{ result().created }}</strong> lançamentos importados com sucesso.</p>
              @if (result().skipped > 0) {
                <p class="warn">{{ result().skipped }} ignorados (datas inválidas ou valores zerados).</p>
              }
              @for (e of result().errors; track e) {
                <p class="err-line">⚠️ {{ e }}</p>
              }
            </div>
            <div class="modal__foot">
              <button class="btn btn--primary" (click)="finish()">Fechar e atualizar</button>
            </div>
          }

        </div>
      </div>
    }
  `,
  styles: [`
    /* Trigger */
    .btn-import { display: inline-flex; align-items: center; gap: .4rem;
      padding: .4rem .875rem; background: #fff; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .82rem; font-weight: 500; color: #374151;
      cursor: pointer; transition: border-color .15s; }
    .btn-import:hover { border-color: #2e7736; color: #2e7736; }
    .btn-import:disabled { opacity: .5; cursor: not-allowed; }

    /* Overlay + modal */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2000;
      display: flex; align-items: flex-start; justify-content: center; padding-top: 5vh; }
    .modal { background: #fff; border-radius: .5rem; width: 95vw; max-width: 860px;
      max-height: 88vh; display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,.22); overflow: hidden; }

    /* Modal head */
    .modal__head { display: flex; justify-content: space-between; align-items: flex-start;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid #f3f4f6; }
    .modal__head h2 { margin: 0; font-size: 1.075rem; font-weight: 700; }
    .sub { margin: .15rem 0 0; font-size: .8rem; color: #6b7280; }
    .sub.done { color: #16a34a; }
    .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer;
      color: #9ca3af; padding: .25rem; line-height: 1; }
    .close-btn:hover { color: #374151; }

    /* Spinner */
    .spinner-wrap { display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 3rem; gap: 1rem; color: #6b7280; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb;
      border-top-color: #2e7736; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Toolbar */
    .toolbar { display: flex; align-items: center; gap: .5rem; padding: .75rem 1.5rem;
      background: #f9fafb; border-bottom: 1px solid #f3f4f6; font-size: .8rem; flex-wrap: wrap; }
    .sep { color: #d1d5db; }
    .link-btn { background: none; border: none; cursor: pointer; color: #2e7736;
      font-size: .8rem; padding: 0; }
    .link-btn:hover { text-decoration: underline; }
    .count { font-weight: 600; }
    .count.income { color: #16a34a; }
    .count.expense { color: #dc2626; }

    /* Table */
    .table-wrap { overflow-y: auto; flex: 1; }
    .prev-table { width: 100%; border-collapse: collapse; font-size: .8rem; }
    .prev-table th { position: sticky; top: 0; background: #f9fafb; padding: .5rem .75rem;
      text-align: left; color: #6b7280; font-size: .72rem; text-transform: uppercase;
      border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
    .prev-table td { padding: .45rem .75rem; border-top: 1px solid #f9fafb; }
    .prev-table tr:hover td { background: #f9fafb; }
    .prev-table tr.unselected td { opacity: .45; }
    .chk-col { width: 36px; }
    .cat { color: #6b7280; font-size: .75rem; max-width: 160px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .date { white-space: nowrap; color: #6b7280; font-size: .76rem; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .red { color: #dc2626; }
    .green { color: #16a34a; }

    /* Badge */
    .badge { font-size: .68rem; padding: .15rem .5rem; border-radius: 9999px; font-weight: 500; }
    .badge--in { background: #dcfce7; color: #166534; }
    .badge--ex { background: #fee2e2; color: #991b1b; }

    /* Footer */
    .modal__foot { display: flex; justify-content: flex-end; gap: .75rem;
      padding: 1rem 1.5rem; border-top: 1px solid #f3f4f6; }
    .btn { padding: .45rem 1rem; border-radius: .375rem; border: none;
      cursor: pointer; font-size: .85rem; font-weight: 500; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn--ghost { background: none; color: #6b7280; }

    /* Done */
    .done-screen { padding: 2rem 1.5rem; text-align: center; }
    .done-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .done-screen p { margin: .25rem; color: #374151; }
    .warn { color: #d97706; font-size: .85rem; }
    .err-line { color: #dc2626; font-size: .78rem; }
  `]
})
export class ImportOrganizzeComponent {
  @Output() imported = new EventEmitter<void>();

  private api   = inject(ApiService);
  private toast = inject(ToastService);

  step     = signal<Step>('idle');
  loading  = signal(false);
  filename = signal('');
  rows     = signal<ParsedTransaction[]>([]);
  result   = signal({ created: 0, skipped: 0, errors: [] as string[] });

  selectedCount = () => this.rows().filter(r => r.selected).length;
  incomeCount   = () => this.rows().filter(r => r.type === 'income').length;
  expenseCount  = () => this.rows().filter(r => r.type === 'expense').length;
  allSelected   = () => this.rows().every(r => r.selected);

  selectAll(v: boolean) {
    this.rows.update(rs => rs.map(r => ({ ...r, selected: v })));
  }

  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.filename.set(file.name);
    this.loading.set(true);
    this.step.set('preview');

    try {
      const text = await this.extractPdfText(file);
      const parsed = parseOrganizzeCatText(text);
      if (parsed.length === 0) {
        this.toast.error('Nenhum lançamento encontrado. Use o "Relatório de categorias" do Organizze.');
        this.step.set('idle');
      } else {
        this.rows.set(parsed);
      }
    } catch (err: any) {
      this.toast.error('Erro ao ler PDF: ' + (err?.message ?? err));
      this.step.set('idle');
    } finally {
      this.loading.set(false);
      input.value = '';
    }
  }

  private extractPdfText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // Dynamically load PDF.js from CDN
      const pdfjsLib = (window as any)['pdfjsLib'];
      if (pdfjsLib) {
        this.doParse(pdfjsLib, file, resolve, reject);
        return;
      }
      // Load script
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        const lib = (window as any)['pdfjsLib'];
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        this.doParse(lib, file, resolve, reject);
      };
      s.onerror = () => reject(new Error('Falha ao carregar PDF.js'));
      document.head.appendChild(s);
    });
  }

  private doParse(lib: any, file: File, resolve: (t: string) => void, reject: (e: any) => void) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arr = new Uint8Array(e.target!.result as ArrayBuffer);
        const pdf = await lib.getDocument({ data: arr }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join('\n');
          fullText += pageText + '\n';
        }
        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  }

  confirmImport() {
    const selected = this.rows()
      .filter(r => r.selected)
      .map(({ selected: _, ...rest }) => rest);

    if (selected.length === 0) return;

    this.loading.set(true);
    this.api.post<any>('/import/organizze', { transactions: selected }).subscribe({
      next: res => {
        this.result.set(res);
        this.step.set('done');
        this.loading.set(false);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao importar');
        this.loading.set(false);
      }
    });
  }

  close() {
    this.step.set('idle');
    this.rows.set([]);
  }

  finish() {
    this.close();
    this.imported.emit();
  }
}
