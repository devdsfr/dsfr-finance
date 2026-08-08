import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { catchError, of } from 'rxjs';

interface Row {
  external_id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string | null;
  duplicate: boolean;
  suggested_category_name?: string;
  selected: boolean;
}

@Component({
  selector: 'app-import-statement',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  template: `
<div class="imp">

  <div class="imp__head">
    <button class="btn-back" (click)="goBack()">‹ Contas &amp; Cartões</button>
    <h1 class="imp__title">Importar extrato</h1>
  </div>

  <!-- ── PASSO 1: arquivo ── -->
  @if (step() === 'upload') {
    <div class="card">
      <div class="field">
        <label>Conta de destino</label>
        <select [value]="accountId()" (change)="accountId.set($any($event.target).value)">
          <option value="">Selecione a conta…</option>
          @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
        </select>
      </div>

      <div class="drop" [class.drop--over]="dragOver()"
           (dragover)="$event.preventDefault(); dragOver.set(true)"
           (dragleave)="dragOver.set(false)"
           (drop)="onDrop($event)"
           (click)="fileInput.click()">
        <span class="drop__icon">📄</span>
        <strong>Arraste o arquivo .OFX aqui</strong>
        <span class="drop__hint">ou clique para escolher</span>
      </div>
      <input #fileInput type="file" accept=".ofx,.OFX,.qfx" hidden
             (change)="onFile($any($event.target).files)" />

      @if (fileName()) { <p class="file-name">Arquivo: <strong>{{ fileName() }}</strong></p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      <div class="help">
        <strong>Onde baixar o OFX</strong>
        <p>No internet banking, procure por “Exportar extrato”, “Salvar em outros formatos” ou
           “Money / OFX”. Quase todo banco oferece — costuma estar na tela de extrato,
           junto do botão de imprimir.</p>
      </div>
    </div>
  }

  <!-- ── PASSO 2: revisão ── -->
  @if (step() === 'review') {
    <div class="card">
      <div class="summary">
        <div class="sum">
          <span class="sum__lbl">Encontrados</span>
          <span class="sum__val">{{ rows().length }}</span>
        </div>
        <div class="sum">
          <span class="sum__lbl">Já importados</span>
          <span class="sum__val sum__val--dup">{{ dupCount() }}</span>
        </div>
        <div class="sum">
          <span class="sum__lbl">Selecionados</span>
          <span class="sum__val sum__val--ok">{{ selectedCount() }}</span>
        </div>
        <div class="sum">
          <span class="sum__lbl">Impacto no saldo</span>
          <span class="sum__val" [class.neg]="delta() < 0" [class.pos]="delta() > 0">
            {{ delta() | appCurrency }}
          </span>
        </div>
      </div>

      <div class="bulk">
        <button class="btn-link" (click)="selectAll(true)">Marcar todos</button>
        <button class="btn-link" (click)="selectAll(false)">Desmarcar todos</button>
        <button class="btn-link" (click)="selectOnlyNew()">Só os novos</button>
      </div>

      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="c-chk"></th>
              <th class="c-date">Data</th>
              <th>Descrição</th>
              <th class="c-cat">Categoria</th>
              <th class="c-val">Valor</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track $index) {
              <tr [class.row--dup]="r.duplicate">
                <td class="c-chk">
                  <input type="checkbox" [checked]="r.selected" (change)="toggle(r)" />
                </td>
                <td class="c-date">{{ r.date | date:'dd/MM/yyyy':'UTC' }}</td>
                <td>
                  <span class="desc">{{ r.description }}</span>
                  @if (r.duplicate) { <span class="badge-dup">já importado</span> }
                </td>
                <td class="c-cat">
                  <select [value]="r.category_id ?? ''" (change)="setCat(r, $any($event.target).value)">
                    <option value="">Sem categoria</option>
                    @for (c of catsFor(r.type); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
                  </select>
                </td>
                <td class="c-val" [class.neg]="r.type === 'expense'" [class.pos]="r.type === 'income'">
                  {{ (r.type === 'expense' ? -r.amount : r.amount) | appCurrency }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="foot">
        <button class="btn-ghost" (click)="reset()">Cancelar</button>
        <button class="btn-primary" [disabled]="selectedCount() === 0 || saving()" (click)="confirm()">
          {{ saving() ? 'Importando…' : 'Importar ' + selectedCount() + ' lançamento(s)' }}
        </button>
      </div>
    </div>
  }

  <!-- ── PASSO 3: resultado ── -->
  @if (step() === 'done') {
    <div class="card done">
      <span class="done__icon">✅</span>
      <h2>{{ result()?.created ?? 0 }} lançamento(s) importado(s)</h2>
      @if ((result()?.skipped ?? 0) > 0) {
        <p class="done__sub">{{ result()?.skipped }} ignorado(s) por já existirem ou dados inválidos.</p>
      }
      <div class="done__actions">
        <button class="btn-ghost" (click)="reset()">Importar outro extrato</button>
        <button class="btn-primary" (click)="goTransactions()">Ver lançamentos</button>
      </div>
    </div>
  }
</div>
  `,
  styles: [`
    .imp { max-width: 1100px; }
    .imp__head { display: flex; flex-direction: column; gap: .35rem; margin-bottom: 1.25rem; }
    .btn-back { background: none; border: none; color: #2e7736; font-size: .85rem; font-weight: 600; cursor: pointer; padding: 0; align-self: flex-start; }
    .imp__title { font-size: 1.35rem; font-weight: 700; color: #111; margin: 0; }

    .card { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.75rem; }

    .field { display: flex; flex-direction: column; gap: .35rem; max-width: 340px; margin-bottom: 1.25rem; }
    .field label { font-size: .78rem; font-weight: 600; color: #374151; }
    .field select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; background: #fff; color: #111; }

    .drop { border: 2px dashed #d1d5db; border-radius: .6rem; padding: 2.5rem 1rem; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: .35rem; cursor: pointer; transition: border-color .15s, background .15s; }
    .drop:hover, .drop--over { border-color: #2e7736; background: #f0fdf4; }
    .drop__icon { font-size: 2rem; }
    .drop strong { font-size: .95rem; color: #111; }
    .drop__hint { font-size: .8rem; color: #9ca3af; }
    .file-name { font-size: .82rem; color: #374151; margin: .75rem 0 0; }
    .error { color: #dc2626; font-size: .82rem; margin: .75rem 0 0; }

    .help { margin-top: 1.5rem; padding: .9rem 1rem; background: #f9fafb; border-radius: .5rem; }
    .help strong { font-size: .8rem; color: #111; display: block; margin-bottom: .25rem; }
    .help p { font-size: .78rem; color: #6b7280; margin: 0; line-height: 1.5; }

    .summary { display: flex; flex-wrap: wrap; gap: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #f3f4f6; margin-bottom: .75rem; }
    .sum { display: flex; flex-direction: column; gap: .1rem; }
    .sum__lbl { font-size: .7rem; text-transform: uppercase; letter-spacing: .02em; color: #9ca3af; font-weight: 600; }
    .sum__val { font-size: 1.15rem; font-weight: 700; color: #111; }
    .sum__val--dup { color: #d97706; }
    .sum__val--ok  { color: #2e7736; }
    .neg { color: #dc2626; }
    .pos { color: #16a34a; }

    .bulk { display: flex; gap: 1rem; margin-bottom: .5rem; }
    .btn-link { background: none; border: none; color: #2e7736; font-size: .8rem; font-weight: 600; cursor: pointer; padding: 0; }

    .table-wrap { overflow-x: auto; max-height: 60vh; overflow-y: auto; }
    .tbl { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .tbl thead th { position: sticky; top: 0; background: #f9fafb; text-align: left; padding: .55rem .5rem;
      font-size: .72rem; text-transform: uppercase; color: #6b7280; font-weight: 700; border-bottom: 1px solid #e5e7eb; }
    .tbl td { padding: .5rem; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
    .row--dup { opacity: .6; }
    .c-chk { width: 36px; }
    .c-date { width: 96px; white-space: nowrap; }
    .c-cat { width: 190px; }
    .c-val { width: 120px; text-align: right; font-weight: 600; white-space: nowrap; }
    .c-cat select { width: 100%; padding: .3rem .4rem; border: 1px solid #d1d5db; border-radius: .3rem; font-size: .78rem; background: #fff; color: #111; }
    .desc { display: inline-block; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
    .badge-dup { margin-left: .4rem; font-size: .62rem; font-weight: 700; text-transform: uppercase;
      background: #fef3c7; color: #b45309; padding: .12rem .4rem; border-radius: 9999px; }

    .foot { display: flex; justify-content: flex-end; gap: .75rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; margin-top: 1rem; }
    .btn-primary { background: #2e7736; color: #fff; border: none; border-radius: .375rem; padding: .55rem 1.4rem; font-size: .875rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: .45; cursor: default; }
    .btn-ghost { background: none; border: 1px solid #d1d5db; border-radius: .375rem; padding: .55rem 1.2rem; font-size: .875rem; font-weight: 600; color: #374151; cursor: pointer; }

    .done { text-align: center; }
    .done__icon { font-size: 2.5rem; display: block; margin-bottom: .5rem; }
    .done h2 { font-size: 1.15rem; color: #111; margin: 0 0 .35rem; }
    .done__sub { font-size: .85rem; color: #6b7280; margin: 0; }
    .done__actions { display: flex; justify-content: center; gap: .75rem; margin-top: 1.5rem; }

    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .card { background: #161c28 !important; box-shadow: 0 8px 32px rgba(0,0,0,.5) !important; }
    :host-context([data-theme="dark"]) .imp__title,
    :host-context([data-theme="dark"]) .drop strong,
    :host-context([data-theme="dark"]) .help strong,
    :host-context([data-theme="dark"]) .sum__val,
    :host-context([data-theme="dark"]) .done h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .btn-back,
    :host-context([data-theme="dark"]) .btn-link { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .field label { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .field select,
    :host-context([data-theme="dark"]) .c-cat select { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .drop { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .drop:hover,
    :host-context([data-theme="dark"]) .drop--over { border-color: #4ade80 !important; background: rgba(74,222,128,.06) !important; }
    :host-context([data-theme="dark"]) .drop__hint,
    :host-context([data-theme="dark"]) .help p,
    :host-context([data-theme="dark"]) .sum__lbl,
    :host-context([data-theme="dark"]) .done__sub { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .file-name { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .help { background: #1e2638 !important; }
    :host-context([data-theme="dark"]) .summary,
    :host-context([data-theme="dark"]) .foot { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .tbl thead th { background: #1e2638 !important; color: #8393ad !important; border-bottom-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .tbl td { border-bottom-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .badge-dup { background: rgba(217,119,6,.18) !important; color: #fbbf24 !important; }
    :host-context([data-theme="dark"]) .sum__val--dup { color: #fbbf24 !important; }
    :host-context([data-theme="dark"]) .sum__val--ok { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .neg { color: #f87171 !important; }
    :host-context([data-theme="dark"]) .pos { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .btn-ghost { border-color: #232d42 !important; color: #c5cdd9 !important; }
  `]
})
export class ImportStatementComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  step      = signal<'upload' | 'review' | 'done'>('upload');
  accounts  = signal<any[]>([]);
  categories= signal<any[]>([]);
  accountId = signal('');
  fileName  = signal('');
  error     = signal('');
  dragOver  = signal(false);
  saving    = signal(false);
  rows      = signal<Row[]>([]);
  result    = signal<any>(null);

  selectedCount = computed(() => this.rows().filter(r => r.selected).length);
  dupCount      = computed(() => this.rows().filter(r => r.duplicate).length);
  delta = computed(() => this.rows()
    .filter(r => r.selected)
    .reduce((s, r) => s + (r.type === 'expense' ? -r.amount : r.amount), 0));

  constructor() {
    this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] })))
      .subscribe(r => {
        this.accounts.set(r.data ?? []);
        const pre = this.route.snapshot.queryParamMap.get('account');
        if (pre) this.accountId.set(pre);
        else if ((r.data ?? []).length === 1) this.accountId.set(r.data[0].id);
      });
    this.api.get<any>('/categories').pipe(catchError(() => of({ data: [] })))
      .subscribe(r => this.categories.set(r.data ?? []));
  }

  catsFor(type: 'income' | 'expense') {
    return this.categories().filter(c => !c.type || c.type === type);
  }

  // ── Arquivo ──────────────────────────────────────────────────────────
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragOver.set(false);
    this.onFile(ev.dataTransfer?.files ?? null);
  }

  onFile(files: FileList | null) {
    this.error.set('');
    if (!files || files.length === 0) return;
    if (!this.accountId()) { this.error.set('Selecione a conta de destino antes de enviar o arquivo.'); return; }

    const file = files[0];
    this.fileName.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer;
      const text = this.decode(buf);
      const parsed = this.parseOFX(text);
      if (parsed.length === 0) {
        this.error.set('Não encontrei lançamentos nesse arquivo. Confirme que é um extrato .OFX.');
        return;
      }
      this.analyze(parsed);
    };
    reader.onerror = () => this.error.set('Não consegui ler o arquivo.');
    reader.readAsArrayBuffer(file);
  }

  /** OFX brasileiro costuma vir em Latin-1; UTF-8 quebra os acentos. */
  private decode(buf: ArrayBuffer): string {
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    // Caractere de substituição indica que não era UTF-8 de verdade.
    if (utf8.includes('�')) {
      return new TextDecoder('windows-1252').decode(buf);
    }
    return utf8;
  }

  /** Extrai o valor de uma tag SGML/XML do bloco OFX. */
  private tag(block: string, name: string): string {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
    return m ? m[1].trim() : '';
  }

  private parseOFX(text: string): Omit<Row, 'duplicate' | 'selected' | 'category_id'>[] {
    const out: Omit<Row, 'duplicate' | 'selected' | 'category_id'>[] = [];
    const blocks = text.split(/<STMTTRN>/i).slice(1);

    for (const raw of blocks) {
      const block = raw.split(/<\/STMTTRN>/i)[0];

      const rawDate = this.tag(block, 'DTPOSTED');
      if (rawDate.length < 8) continue;
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

      const rawAmt = this.tag(block, 'TRNAMT').replace(',', '.');
      const amt = parseFloat(rawAmt);
      if (!isFinite(amt) || amt === 0) continue;

      const desc = this.tag(block, 'MEMO') || this.tag(block, 'NAME') || 'Lançamento importado';

      out.push({
        external_id: this.tag(block, 'FITID'),
        date,
        description: desc,
        amount: Math.abs(amt),
        type: amt < 0 ? 'expense' : 'income',
      });
    }
    return out;
  }

  // ── Análise (duplicados + sugestão de categoria) ──────────────────────
  private analyze(parsed: any[]) {
    this.api.post<any>('/import/statement/analyze', {
      account_id: this.accountId(),
      transactions: parsed,
    }).pipe(catchError(() => of(null))).subscribe(res => {
      if (!res) { this.error.set('Falha ao analisar o extrato. Tente novamente.'); return; }
      const rows: Row[] = (res.data ?? []).map((r: any) => ({
        external_id: r.external_id ?? '',
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category_id: r.suggested_category_id ?? null,
        duplicate: !!r.duplicate,
        suggested_category_name: r.suggested_category_name,
        selected: !r.duplicate,          // duplicados entram desmarcados
      }));
      this.rows.set(rows);
      this.step.set('review');
    });
  }

  // ── Revisão ──────────────────────────────────────────────────────────
  toggle(row: Row) {
    this.rows.update(rs => rs.map(r => r === row ? { ...r, selected: !r.selected } : r));
  }
  setCat(row: Row, catID: string) {
    this.rows.update(rs => rs.map(r => r === row ? { ...r, category_id: catID || null } : r));
  }
  selectAll(v: boolean) {
    this.rows.update(rs => rs.map(r => ({ ...r, selected: v })));
  }
  selectOnlyNew() {
    this.rows.update(rs => rs.map(r => ({ ...r, selected: !r.duplicate })));
  }

  confirm() {
    const chosen = this.rows().filter(r => r.selected).map(r => ({
      external_id: r.external_id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category_id: r.category_id,
    }));
    if (chosen.length === 0) return;

    this.saving.set(true);
    this.api.post<any>('/import/statement', {
      account_id: this.accountId(),
      transactions: chosen,
    }).pipe(catchError(() => of(null))).subscribe(res => {
      this.saving.set(false);
      if (!res) { this.error.set('Falha ao importar. Nenhum lançamento foi gravado.'); return; }
      this.result.set(res);
      this.step.set('done');
    });
  }

  reset() {
    this.rows.set([]);
    this.fileName.set('');
    this.error.set('');
    this.result.set(null);
    this.step.set('upload');
  }

  goBack()         { this.router.navigate(['/banking']); }
  goTransactions() { this.router.navigate(['/transactions']); }
}
