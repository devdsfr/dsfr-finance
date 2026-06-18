import { Component, inject, signal, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

export interface ParsedTransaction {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;         // YYYY-MM-DD
  category_name: string;
  paid: boolean;
  source: string;       // nome da aba (conta/cartão)
  selected: boolean;    // UI only
}

// ── Date "DD.MM.YYYY" → "YYYY-MM-DD" ────────────────────────────────────────
function parseDateOrganizze(raw: string): string | null {
  const m = String(raw).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ── Skip logic: entries that represent card bill payments (internal transfers) ─
function shouldSkip(desc: string, cat: string, amount: number): boolean {
  if (amount === 0) return true;
  if (cat.trim().toLowerCase() === 'pagamento de fatura') return true;
  return false;
}

// ── Parse one sheet (array of rows where row[0] is header) ──────────────────
function parseSheet(sheetName: string, rows: any[][]): ParsedTransaction[] {
  if (!rows || rows.length < 2) return [];

  // Detect column indexes from header
  const header = rows[0].map((h: any) => String(h ?? '').toLowerCase().trim());
  const iData   = header.findIndex(h => h === 'data');
  const iDesc   = header.findIndex(h => h === 'descrição' || h === 'descricao');
  const iCat    = header.findIndex(h => h === 'categoria');
  const iVal    = header.findIndex(h => h === 'valor');
  const iSit    = header.findIndex(h => h === 'situação' || h === 'situacao');

  if (iData < 0 || iDesc < 0 || iVal < 0) return []; // Not a valid transaction sheet

  const result: ParsedTransaction[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawDate = String(row[iData] ?? '').trim();
    const desc    = String(row[iDesc] ?? '').trim();
    const cat     = String(iCat >= 0 ? (row[iCat] ?? '') : '').trim();
    const rawVal  = row[iVal];
    const sitStr  = String(iSit >= 0 ? (row[iSit] ?? '') : '').trim();

    if (!rawDate || !desc) continue;

    const date = parseDateOrganizze(rawDate);
    if (!date) continue;

    const amount = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(',', '.'));
    if (isNaN(amount)) continue;
    if (shouldSkip(desc, cat, amount)) continue;

    const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';
    const paid = /^pago$/i.test(sitStr);

    // Default-uncheck entries that look like credit card bill payments from account
    const isFaturaDebit = desc.toLowerCase().startsWith('fatura') && cat === '';

    result.push({
      description:   desc,
      amount:        Math.abs(amount),
      type,
      date,
      category_name: cat,
      paid,
      source:        sheetName,
      selected:      !isFaturaDebit,
    });
  }

  return result;
}

// ── Load SheetJS from CDN ─────────────────────────────────────────────────────
function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    const existing = (window as any)['XLSX'];
    if (existing) { resolve(existing); return; }

    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => {
      const lib = (window as any)['XLSX'];
      lib ? resolve(lib) : reject(new Error('XLSX não encontrado após carregamento'));
    };
    s.onerror = () => reject(new Error('Falha ao carregar SheetJS'));
    document.head.appendChild(s);
  });
}

// ── Parse XLS/XLSX file → ParsedTransaction[] ────────────────────────────────
async function parseXlsFile(file: File): Promise<ParsedTransaction[]> {
  const XLSX = await loadXLSX();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  const all: ParsedTransaction[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    all.push(...parseSheet(sheetName, rows));
  }
  return all;
}

// ── Component ─────────────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'done';

@Component({
  selector: 'app-import-organizze',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (step() === 'idle') {
      <button class="btn-import" (click)="trigger.click()" [disabled]="loading()">
        📥 Importar XLS Organizze
      </button>
      <input #trigger type="file" accept=".xls,.xlsx" style="display:none"
             (change)="onFile($event)" />
    }

    @if (step() !== 'idle') {
      <div class="overlay">
        <div class="modal" (click)="$event.stopPropagation()">

          <div class="modal__head">
            <div>
              <h2>Importar do Organizze</h2>
              @if (step() === 'preview') {
                <p class="sub">{{ selectedCount() }} selecionados · {{ filename() }}</p>
              }
              @if (step() === 'done') {
                <p class="sub done">✅ Importação concluída</p>
              }
            </div>
            <button class="close-btn" (click)="close()">✕</button>
          </div>

          @if (loading()) {
            <div class="spinner-wrap">
              <div class="spinner"></div>
              <p>Lendo arquivo...</p>
            </div>
          }

          @if (step() === 'preview' && !loading()) {
            <!-- Toolbar -->
            <div class="toolbar">
              <button class="link-btn" (click)="selectAll(true)">Todos</button>
              <span class="sep">·</span>
              <button class="link-btn" (click)="selectAll(false)">Nenhum</button>
              <span class="sep">·</span>

              @for (src of sources(); track src) {
                <button class="source-btn"
                        [class.active]="activeSource() === src"
                        (click)="filterSource(src)">
                  {{ src }}
                </button>
              }
              <button class="source-btn" [class.active]="activeSource() === ''"
                      (click)="filterSource('')">Todas as abas</button>

              <span class="spacer"></span>
              <span class="count income">{{ incomeCount() }} receitas</span>
              <span class="sep">·</span>
              <span class="count expense">{{ expenseCount() }} despesas</span>
            </div>

            <!-- Table -->
            <div class="table-wrap">
              <table class="prev-table">
                <thead>
                  <tr>
                    <th class="chk-col">
                      <input type="checkbox" [checked]="allSelected()"
                             (change)="selectAll($any($event.target).checked)" />
                    </th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Situação</th>
                    <th class="num">Valor</th>
                    <th>Conta / Aba</th>
                  </tr>
                </thead>
                <tbody>
                  @for (tx of visibleRows(); track $index) {
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
                      <td>
                        <span class="paid-dot" [class.paid]="tx.paid"
                              [class.unpaid]="!tx.paid">
                          {{ tx.paid ? 'Pago' : 'A pagar' }}
                        </span>
                      </td>
                      <td class="num" [class.red]="tx.type==='expense'"
                          [class.green]="tx.type==='income'">
                        {{ tx.amount | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                      </td>
                      <td class="src">{{ tx.source }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="modal__foot">
              <span class="total-info">
                Total: {{ selectedTotal() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
              </span>
              <button class="btn btn--ghost" (click)="close()">Cancelar</button>
              <button class="btn btn--primary" (click)="confirmImport()"
                      [disabled]="selectedCount() === 0 || importing()">
                {{ importing() ? 'Importando...' : 'Importar ' + selectedCount() + ' lançamentos' }}
              </button>
            </div>
          }

          @if (step() === 'done') {
            <div class="done-screen">
              <div class="done-icon">✅</div>
              <p><strong>{{ result().created }}</strong> lançamentos importados.</p>
              @if (result().skipped > 0) {
                <p class="warn">{{ result().skipped }} ignorados (valor zero ou inválido).</p>
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
    .btn-import { display: inline-flex; align-items: center; gap: .4rem;
      padding: .4rem .875rem; background: #fff; border: 1px solid #d1d5db;
      border-radius: .375rem; font-size: .82rem; font-weight: 500; color: #374151;
      cursor: pointer; transition: border-color .15s, color .15s; }
    .btn-import:hover { border-color: #2e7736; color: #2e7736; }
    .btn-import:disabled { opacity: .5; cursor: not-allowed; }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2000;
      display: flex; align-items: flex-start; justify-content: center; padding-top: 4vh; }
    .modal { background: #fff; border-radius: .5rem; width: 97vw; max-width: 1040px;
      max-height: 90vh; display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,.22); overflow: hidden; }

    .modal__head { display: flex; justify-content: space-between; align-items: flex-start;
      padding: 1.1rem 1.5rem; border-bottom: 1px solid #f3f4f6; flex-shrink: 0; }
    .modal__head h2 { margin: 0; font-size: 1rem; font-weight: 700; }
    .sub { margin: .15rem 0 0; font-size: .78rem; color: #6b7280; }
    .sub.done { color: #16a34a; }
    .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer;
      color: #9ca3af; padding: .2rem; }

    .spinner-wrap { display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 3rem; gap: 1rem; color: #6b7280; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb;
      border-top-color: #2e7736; border-radius: 50%;
      animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .toolbar { display: flex; align-items: center; gap: .4rem; padding: .6rem 1.25rem;
      background: #f9fafb; border-bottom: 1px solid #f3f4f6; font-size: .78rem;
      flex-wrap: wrap; flex-shrink: 0; }
    .sep { color: #d1d5db; }
    .link-btn { background: none; border: none; cursor: pointer; color: #2e7736;
      font-size: .78rem; padding: 0; }
    .link-btn:hover { text-decoration: underline; }
    .source-btn { background: #fff; border: 1px solid #e5e7eb; border-radius: 9999px;
      padding: .15rem .55rem; font-size: .72rem; cursor: pointer; color: #374151; }
    .source-btn.active { background: #2e7736; color: #fff; border-color: #2e7736; }
    .spacer { flex: 1; }
    .count { font-weight: 600; font-size: .78rem; }
    .count.income { color: #16a34a; }
    .count.expense { color: #dc2626; }

    .table-wrap { overflow-y: auto; flex: 1; min-height: 0; }
    .prev-table { width: 100%; border-collapse: collapse; font-size: .79rem; }
    .prev-table th { position: sticky; top: 0; background: #f9fafb; padding: .45rem .65rem;
      text-align: left; color: #6b7280; font-size: .7rem; text-transform: uppercase;
      border-bottom: 1px solid #e5e7eb; white-space: nowrap; z-index: 1; }
    .prev-table th.num, .prev-table td.num { text-align: right; }
    .prev-table td { padding: .4rem .65rem; border-top: 1px solid #f9fafb; }
    .prev-table tr:hover td { background: #f9fafb; }
    .prev-table tr.unselected td { opacity: .42; }
    .chk-col { width: 32px; }
    .cat { color: #6b7280; max-width: 140px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .date { white-space: nowrap; color: #6b7280; font-size: .74rem; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .red { color: #dc2626; } .green { color: #16a34a; }
    .src { color: #6b7280; font-size: .72rem; white-space: nowrap; }

    .badge { font-size: .66rem; padding: .12rem .45rem; border-radius: 9999px; font-weight: 500; white-space: nowrap; }
    .badge--in { background: #dcfce7; color: #166534; }
    .badge--ex { background: #fee2e2; color: #991b1b; }

    .paid-dot { font-size: .72rem; white-space: nowrap; }
    .paid-dot.paid { color: #16a34a; }
    .paid-dot.unpaid { color: #d97706; }

    .modal__foot { display: flex; align-items: center; gap: .75rem;
      padding: .875rem 1.5rem; border-top: 1px solid #f3f4f6; flex-shrink: 0; }
    .total-info { font-size: .8rem; font-weight: 600; color: #374151; margin-right: auto; }
    .btn { padding: .4rem .95rem; border-radius: .375rem; border: none;
      cursor: pointer; font-size: .82rem; font-weight: 500; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn--ghost { background: none; color: #6b7280; }

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

  step      = signal<Step>('idle');
  loading   = signal(false);
  importing = signal(false);
  filename  = signal('');
  rows      = signal<ParsedTransaction[]>([]);
  result    = signal({ created: 0, skipped: 0, errors: [] as string[] });
  activeSource = signal('');

  // ── Derived ─────────────────────────────────────────────────────────
  sources = () => [...new Set(this.rows().map(r => r.source))];

  visibleRows = () => {
    const src = this.activeSource();
    return src ? this.rows().filter(r => r.source === src) : this.rows();
  };

  selectedCount = () => this.rows().filter(r => r.selected).length;
  incomeCount   = () => this.rows().filter(r => r.selected && r.type === 'income').length;
  expenseCount  = () => this.rows().filter(r => r.selected && r.type === 'expense').length;
  allSelected   = () => this.visibleRows().every(r => r.selected);

  selectedTotal = () => this.rows()
    .filter(r => r.selected)
    .reduce((sum, r) => sum + (r.type === 'income' ? r.amount : -r.amount), 0);

  selectAll(v: boolean) {
    const src = this.activeSource();
    this.rows.update(rs => rs.map(r =>
      (!src || r.source === src) ? { ...r, selected: v } : r
    ));
  }

  filterSource(src: string) { this.activeSource.set(src); }

  // ── File handler ─────────────────────────────────────────────────────
  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.filename.set(file.name);
    this.loading.set(true);
    this.step.set('preview');

    try {
      const parsed = await parseXlsFile(file);
      if (parsed.length === 0) {
        this.toast.error('Nenhum lançamento encontrado. Exporte as "Movimentações" do Organizze em formato XLS.');
        this.step.set('idle');
      } else {
        this.rows.set(parsed);
      }
    } catch (err: any) {
      this.toast.error('Erro ao ler arquivo: ' + (err?.message ?? err));
      this.step.set('idle');
    } finally {
      this.loading.set(false);
      input.value = '';
    }
  }

  confirmImport() {
    const selected = this.rows()
      .filter(r => r.selected)
      .map(({ selected: _, source: __, ...rest }) => rest);

    if (selected.length === 0) return;
    this.importing.set(true);

    this.api.post<any>('/import/organizze', { transactions: selected }).subscribe({
      next: res => {
        this.result.set(res);
        this.step.set('done');
        this.importing.set(false);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao importar');
        this.importing.set(false);
      }
    });
  }

  close() {
    this.step.set('idle');
    this.rows.set([]);
    this.activeSource.set('');
  }

  finish() {
    this.close();
    this.imported.emit();
  }
}
