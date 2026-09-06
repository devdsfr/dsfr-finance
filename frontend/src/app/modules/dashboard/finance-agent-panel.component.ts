import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

interface Turn { question: string; answer: string; }

const SUGGESTIONS = [
  'Vale a pena comprar uma moto de 20 mil em 24x?',
  'Consigo trocar de carro esse ano?',
  'Como está meu orçamento este mês?',
  'Quanto posso gastar sem apertar?',
];

@Component({
  selector: 'app-finance-agent-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="agent">
  <div class="agent__head">
    <div class="agent__id">
      <span class="agent__icon">🧠</span>
      <div>
        <h2>Pergunte ao seu agente financeiro</h2>
        <p class="agent__sub">Ele conhece suas contas, dívidas, parcelas e reserva.</p>
      </div>
    </div>
    <button class="dl-btn" (click)="downloadContext()" [disabled]="downloading()"
            title="Baixar seu contexto financeiro em Markdown">
      {{ downloading() ? 'Gerando…' : '⬇ Baixar contexto (.md)' }}
    </button>
  </div>

  <!-- Conversa -->
  @if (turns().length > 0) {
    <div class="thread">
      @for (t of turns(); track $index) {
        <div class="turn">
          <div class="bubble bubble--q">{{ t.question }}</div>
          <div class="bubble bubble--a">{{ t.answer }}</div>
        </div>
      }
      @if (loading()) {
        <div class="bubble bubble--a bubble--wait">Analisando seus números…</div>
      }
    </div>
  }

  <!-- Sugestões (só antes da primeira pergunta) -->
  @if (turns().length === 0 && !loading()) {
    <div class="chips">
      @for (s of suggestions; track s) {
        <button class="chip" (click)="askSuggestion(s)">{{ s }}</button>
      }
    </div>
  }

  <!-- Entrada -->
  <div class="composer">
    <input class="composer__input" type="text" [(ngModel)]="question"
           (keyup.enter)="ask()" [disabled]="loading()"
           placeholder="Ex: quero comprar uma moto de 18 mil, vale a pena?" />
    <button class="composer__send" (click)="ask()" [disabled]="loading() || !question.trim()">
      Perguntar
    </button>
  </div>

  @if (turns().length > 0) {
    <button class="clear-btn" (click)="clear()">Limpar conversa</button>
  }

  <p class="disclaimer">
    Analiso orçamento, dívidas e parcelamentos. Não recomendo investimentos específicos.
  </p>
</div>
  `,
  styles: [`
    .agent { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.07);
      padding: 1.25rem 1.4rem; margin-bottom: 1.25rem; }
    .agent__head { display: flex; justify-content: space-between; align-items: flex-start;
      gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .agent__id { display: flex; gap: .7rem; align-items: flex-start; }
    .agent__icon { font-size: 1.5rem; }
    .agent h2 { font-size: 1rem; font-weight: 700; color: #111; margin: 0; }
    .agent__sub { font-size: .78rem; color: #9ca3af; margin: .1rem 0 0; }
    .dl-btn { background: none; border: 1px solid #d1d5db; border-radius: 9999px;
      padding: .4rem 1rem; font-size: .78rem; font-weight: 600; color: #374151; cursor: pointer; }
    .dl-btn:hover:not(:disabled) { border-color: #2e7736; color: #2e7736; }
    .dl-btn:disabled { opacity: .5; cursor: default; }

    .thread { display: flex; flex-direction: column; gap: .9rem; margin-bottom: 1rem;
      max-height: 380px; overflow-y: auto; padding-right: .25rem; }
    .turn { display: flex; flex-direction: column; gap: .4rem; }
    .bubble { border-radius: .6rem; padding: .6rem .85rem; font-size: .86rem; line-height: 1.55;
      white-space: pre-wrap; }
    .bubble--q { background: #eef2f7; color: #374151; align-self: flex-end; max-width: 85%; }
    .bubble--a { background: #f0fdf4; color: #14532d; border-left: 3px solid #2e7736; }
    .bubble--wait { opacity: .7; font-style: italic; }

    .chips { display: flex; flex-wrap: wrap; gap: .45rem; margin-bottom: .9rem; }
    .chip { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 9999px;
      padding: .35rem .8rem; font-size: .76rem; color: #374151; cursor: pointer; }
    .chip:hover { border-color: #2e7736; color: #2e7736; }

    .composer { display: flex; gap: .5rem; }
    .composer__input { flex: 1; padding: .6rem .85rem; border: 1px solid #d1d5db;
      border-radius: .45rem; font-size: .86rem; background: #fff; color: #111; }
    .composer__input:focus { outline: none; border-color: #2e7736; }
    .composer__send { background: #2e7736; color: #fff; border: none; border-radius: .45rem;
      padding: .6rem 1.3rem; font-size: .85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .composer__send:disabled { opacity: .45; cursor: default; }

    .clear-btn { background: none; border: none; color: #9ca3af; font-size: .75rem;
      cursor: pointer; padding: .5rem 0 0; }
    .clear-btn:hover { color: #374151; }
    .disclaimer { font-size: .7rem; color: #9ca3af; margin: .6rem 0 0; }

    /* ══ DARK THEME ══ */
    :host-context([data-theme="dark"]) .agent { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .agent h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .agent__sub,
    :host-context([data-theme="dark"]) .disclaimer,
    :host-context([data-theme="dark"]) .clear-btn { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .dl-btn { border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .dl-btn:hover:not(:disabled) { border-color: #4ade80 !important; color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .bubble--q { background: #1e2638 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .bubble--a { background: rgba(74,222,128,.1) !important;
      color: #d7f5e0 !important; border-left-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .chip { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .chip:hover { border-color: #4ade80 !important; color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .composer__input { background: #1e2638 !important;
      border-color: #232d42 !important; color: #e2e8f5 !important; }
  `]
})
export class FinanceAgentPanelComponent {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  readonly suggestions = SUGGESTIONS;

  question = '';
  turns       = signal<Turn[]>([]);
  loading     = signal(false);
  downloading = signal(false);

  askSuggestion(s: string): void {
    this.question = s;
    this.ask();
  }

  ask(): void {
    const q = this.question.trim();
    if (!q || this.loading()) return;

    this.loading.set(true);
    this.question = '';

    // O backend devolve o motivo em `error` (chave ausente, chave inválida,
    // modelo inexistente, cota estourada). Engolir isso num aviso genérico
    // deixava o problema indistinguível — agora a mensagem real aparece.
    this.api.post<any>('/agent/ask', { question: q, history: this.turns() })
      .pipe(catchError((e: any) => of({ __error: e?.error?.error || e?.message || '' })))
      .subscribe((res: any) => {
        this.loading.set(false);
        if (!res?.answer) {
          this.toast.error(this.agentErrorMessage(res?.__error));
          this.question = q; // devolve a pergunta para não perder o texto
          return;
        }
        this.turns.update(t => [...t, { question: q, answer: res.answer }]);
      });
  }

  /** Traduz o erro do provedor de IA em algo acionável. */
  private agentErrorMessage(raw?: string): string {
    const e = (raw ?? '').toLowerCase();
    if (!e) return 'O agente não respondeu. Tente de novo em instantes.';
    if (e.includes('ai_api_key') || e.includes('não configurada'))
      return 'IA não configurada: falta AI_API_KEY no backend.';
    if (e.includes('ia 401') || e.includes('invalid api key') || e.includes('unauthorized'))
      return 'Chave de IA inválida ou expirada. Gere outra no provedor.';
    if (e.includes('ia 404') || e.includes('model'))
      return 'Modelo não encontrado nesse provedor. Confira AI_MODEL.';
    if (e.includes('ia 429') || e.includes('rate limit') || e.includes('quota'))
      return 'Cota de IA atingida. Tente mais tarde ou configure o provedor reserva.';
    return `O agente não respondeu: ${raw}`;
  }

  clear(): void { this.turns.set([]); }

  /**
   * Baixa o contexto em Markdown. Usa responseType 'text' porque a resposta
   * não é JSON, e monta o download no navegador.
   */
  downloadContext(): void {
    this.downloading.set(true);
    this.http.get(`${environment.apiUrl}/agent/context.md`, { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe(md => {
        this.downloading.set(false);
        if (!md) { this.toast.error('Não foi possível gerar o contexto.'); return; }

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contexto-financeiro-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);

        this.toast.success('Contexto baixado. Ele contém dados financeiros — cuidado ao compartilhar.');
      });
  }
}
