import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';

// ── Types ────────────────────────────────────────────────────────────────
type WidgetStyle = 'compare' | 'evolution' | 'pie' | 'bar' | 'gauge';
type SourceType  = 'category' | 'card' | 'debt' | 'ai';

interface CatalogItem {
  type: SourceType;
  refId: string;
  label: string;
  color: string;
  icon?: string;
  raw?: any;
}

interface WidgetSource {
  type: SourceType;
  refId: string;
  label: string;
  color: string;
}

interface DashWidget {
  id: string;
  title: string;
  style: WidgetStyle;
  sources: WidgetSource[];
}

// Resolved data attached at runtime (not persisted)
interface WidgetData {
  loading: boolean;
  values: { label: string; value: number; color: string }[];      // compare + pie
  series: { months: string[]; lines: { label: string; color: string; points: number[] }[] }; // evolution
}

const PALETTE = [
  '#6366f1','#f59e0b','#ef4444','#10b981','#3b82f6',
  '#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16',
];
const PT_MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const TYPE_LABEL: Record<SourceType, string> = {
  category: 'Categoria', card: 'Cartão', debt: 'Empréstimo', ai: 'Gasto IA',
};

@Component({
  selector: 'app-configurable-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe],
  template: `
<section class="cdash">
  <div class="cdash__head">
    <p class="section-label" style="margin:0">Meu Painel</p>
    <button class="btn-add-widget" (click)="openBuilder()">+ Adicionar widget</button>
  </div>

  @if (!widgets().length) {
    <div class="cdash-empty">
      <div class="cdash-empty__icon">📊</div>
      <p class="cdash-empty__title">Monte seu painel personalizado</p>
      <p class="cdash-empty__sub">Escolha categorias, cartões, empréstimos ou gastos com IA e visualize como comparativo, evolução ou pizza.</p>
      <button class="btn-add-widget btn-add-widget--lg" (click)="openBuilder()">+ Criar primeiro widget</button>
    </div>
  } @else {
    <div class="widget-grid">
      @for (w of widgets(); track w.id) {
        <div class="widget" [class.widget--wide]="w.style === 'evolution'">
          <div class="widget__head">
            <span class="widget__title">{{ w.title }}</span>
            <div class="widget__actions">
              <button class="wbtn" (click)="editWidget(w)" title="Editar">✎</button>
              <button class="wbtn wbtn--del" (click)="removeWidget(w.id)" title="Remover">✕</button>
            </div>
          </div>

          @if (data()[w.id]?.loading) {
            <div class="widget-loading"><span class="wskel"></span><span class="wskel"></span></div>
          } @else {

            <!-- ── COMPARE ── -->
            @if (w.style === 'compare') {
              <div class="cmp">
                @for (v of data()[w.id]?.values || []; track $index) {
                  <div class="cmp-item">
                    <span class="cmp-dot" [style.background]="v.color"></span>
                    <span class="cmp-label">{{ v.label }}</span>
                    <span class="cmp-val">{{ v.value | appCurrency }}</span>
                  </div>
                }
                @if ((data()[w.id]?.values?.length || 0) === 2) {
                  <div class="cmp-bar">
                    <div class="cmp-bar__seg"
                         [style.width.%]="comparePct(w.id)"
                         [style.background]="data()[w.id]!.values[0].color"></div>
                    <div class="cmp-bar__seg"
                         [style.width.%]="100 - comparePct(w.id)"
                         [style.background]="data()[w.id]!.values[1].color"></div>
                  </div>
                  <div class="cmp-diff" [class.cmp-diff--up]="compareDiff(w.id) >= 0">
                    {{ compareDiff(w.id) >= 0 ? '▲' : '▼' }}
                    {{ absDiff(w.id) | appCurrency }} de diferença
                  </div>
                }
              </div>
            }

            <!-- ── PIE ── -->
            @if (w.style === 'pie') {
              @if (pieTotal(w.id) > 0) {
                <div class="pie">
                  <svg viewBox="0 0 100 100" class="pie-svg">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" stroke-width="16"/>
                    @for (seg of pieSegments(w.id); track $index) {
                      <circle cx="50" cy="50" r="38" fill="none"
                              [attr.stroke]="seg.color" stroke-width="16"
                              [attr.stroke-dasharray]="seg.dash + ' ' + C"
                              [attr.stroke-dashoffset]="seg.offset"
                              transform="rotate(-90 50 50)"/>
                    }
                    <text x="50" y="47" text-anchor="middle" font-size="7" fill="#9ca3af">Total</text>
                    <text x="50" y="56" text-anchor="middle" font-size="8" font-weight="700" fill="#111">
                      {{ pieTotalShort(w.id) }}
                    </text>
                  </svg>
                  <div class="pie-legend">
                    @for (seg of pieSegments(w.id); track $index) {
                      <div class="pie-leg-row">
                        <span class="cmp-dot" [style.background]="seg.color"></span>
                        <span class="pie-leg-label">{{ seg.label }}</span>
                        <span class="pie-leg-pct">{{ seg.pct }}%</span>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="widget-nodata">Sem dados para o período.</div>
              }
            }

            <!-- ── EVOLUTION ── -->
            @if (w.style === 'evolution') {
              @if (hasSeries(w.id)) {
                <div class="evo">
                  <svg [attr.viewBox]="'0 0 ' + EVO_W + ' ' + EVO_H" class="evo-svg" preserveAspectRatio="none">
                    @for (yl of evoYLines(w.id); track yl.py) {
                      <line [attr.x1]="PAD_L" [attr.x2]="EVO_W - PAD_R" [attr.y1]="yl.py" [attr.y2]="yl.py"
                            stroke="#eef0f2" stroke-width="1"/>
                      <text [attr.x]="PAD_L - 3" [attr.y]="yl.py + 3" text-anchor="end" font-size="8" fill="#9ca3af">{{ yl.label }}</text>
                    }
                    @for (mx of evoMonths(w.id); track $index) {
                      <text [attr.x]="evoX($index, evoMonths(w.id).length)" [attr.y]="EVO_H - 4"
                            text-anchor="middle" font-size="8" fill="#9ca3af">{{ mx }}</text>
                    }
                    @for (line of data()[w.id]?.series?.lines || []; track line.label) {
                      <polyline [attr.points]="evoPoints(w.id, line.points)" fill="none"
                                [attr.stroke]="line.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                      @for (p of line.points; track $index) {
                        <circle [attr.cx]="evoX($index, line.points.length)" [attr.cy]="evoY(w.id, p)" r="2" [attr.fill]="line.color"/>
                      }
                    }
                  </svg>
                  <div class="pie-legend">
                    @for (line of data()[w.id]?.series?.lines || []; track line.label) {
                      <div class="pie-leg-row">
                        <span class="cmp-dot" [style.background]="line.color"></span>
                        <span class="pie-leg-label">{{ line.label }}</span>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="widget-nodata">Sem histórico para exibir.</div>
              }
            }

            <!-- ── BAR ── -->
            @if (w.style === 'bar') {
              @if (barValues(w.id).length > 0) {
                <div class="bar">
                  <svg [attr.viewBox]="'0 0 ' + BAR_W + ' ' + BAR_H" class="bar-svg" preserveAspectRatio="none">
                    @for (yl of barYLines(w.id); track yl.py) {
                      <line [attr.x1]="PAD_L" [attr.x2]="BAR_W - PAD_R" [attr.y1]="yl.py" [attr.y2]="yl.py"
                            stroke="#eef0f2" stroke-width="1"/>
                      <text [attr.x]="PAD_L - 3" [attr.y]="yl.py + 3" text-anchor="end" font-size="8" fill="#9ca3af">{{ yl.label }}</text>
                    }
                    @for (v of barValues(w.id); track $index) {
                      <rect [attr.x]="barX($index, barValues(w.id).length)" [attr.y]="barY(w.id, v.value)"
                            [attr.width]="barW(barValues(w.id).length)" [attr.height]="barH(w.id, v.value)"
                            [attr.fill]="v.color" rx="2"/>
                      <text [attr.x]="barX($index, barValues(w.id).length) + barW(barValues(w.id).length)/2"
                            [attr.y]="BAR_H - 4" text-anchor="middle" font-size="8" fill="#9ca3af">{{ v.label }}</text>
                    }
                  </svg>
                  <div class="pie-legend">
                    @for (v of barValues(w.id); track v.label) {
                      <div class="pie-leg-row">
                        <span class="cmp-dot" [style.background]="v.color"></span>
                        <span class="pie-leg-label">{{ v.label }}</span>
                        <span class="pie-leg-pct">{{ v.value | appCurrency }}</span>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="widget-nodata">Sem dados para exibir.</div>
              }
            }

            <!-- ── GAUGE ── -->
            @if (w.style === 'gauge') {
              @if (gaugeValue(w.id) > 0) {
                <div class="gauge">
                  <svg viewBox="0 0 120 70" class="gauge-svg">
                    <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#f3f4f6" stroke-width="12" stroke-linecap="round"/>
                    <path d="M10 60 A50 50 0 0 1 110 60" fill="none" [attr.stroke]="gaugeColor(w.id)" stroke-width="12"
                          stroke-linecap="round" [attr.stroke-dasharray]="gaugeDash(w.id) + ' 314'"/>
                    <text x="60" y="50" text-anchor="middle" font-size="10" fill="#9ca3af">Atual</text>
                    <text x="60" y="62" text-anchor="middle" font-size="12" font-weight="700" fill="#111">
                      {{ gaugeValueShort(w.id) }}
                    </text>
                  </svg>
                  <div class="gauge-info">
                    <span class="gauge-label">{{ gaugeLabel(w.id) }}</span>
                    <span class="gauge-pct">{{ gaugePct(w.id) }}%</span>
                  </div>
                </div>
              } @else {
                <div class="widget-nodata">Sem dados para exibir.</div>
              }
            }

          }
        </div>
      }
    </div>
  }

  <!-- ══════════════ BUILDER MODAL ══════════════ -->
  @if (builderOpen()) {
    <div class="modal-backdrop" (click)="closeBuilder()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal__head">
          <h2>{{ editingId() ? 'Editar widget' : 'Novo widget' }}</h2>
          <button class="modal-close" (click)="closeBuilder()">✕</button>
        </div>

        <!-- Style -->
        <div class="fld">
          <label>Estilo de visualização</label>
          <div class="style-grid">
            <button type="button" class="style-opt" [class.active]="draftStyle() === 'compare'" (click)="setStyle('compare')">
              <svg width="28" height="20" viewBox="0 0 28 20"><rect x="2" y="4" width="10" height="12" rx="1.5" fill="currentColor" opacity=".85"/><rect x="16" y="8" width="10" height="8" rx="1.5" fill="currentColor" opacity=".45"/></svg>
              <span>Comparativo</span>
            </button>
            <button type="button" class="style-opt" [class.active]="draftStyle() === 'evolution'" (click)="setStyle('evolution')">
              <svg width="28" height="20" viewBox="0 0 28 20"><polyline points="2,16 9,8 15,12 26,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Evolução</span>
            </button>
            <button type="button" class="style-opt" [class.active]="draftStyle() === 'pie'" (click)="setStyle('pie')">
              <svg width="24" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="5" opacity=".45"/><path d="M10 2 a8 8 0 0 1 8 8 l-8 0 z" fill="currentColor"/></svg>
              <span>Pizza</span>
            </button>
            <button type="button" class="style-opt" [class.active]="draftStyle() === 'bar'" (click)="setStyle('bar')">
              <svg width="28" height="20" viewBox="0 0 28 20"><rect x="3" y="10" width="6" height="8" rx="1" fill="currentColor" opacity=".45"/><rect x="11" y="5" width="6" height="13" rx="1" fill="currentColor" opacity=".85"/><rect x="19" y="8" width="6" height="10" rx="1" fill="currentColor" opacity=".65"/></svg>
              <span>Barras</span>
            </button>
            <button type="button" class="style-opt" [class.active]="draftStyle() === 'gauge'" (click)="setStyle('gauge')">
              <svg width="28" height="20" viewBox="0 0 28 20"><path d="M4 16 A10 10 0 0 1 24 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M4 16 A10 10 0 0 1 14 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".45"/></svg>
              <span>Medidor</span>
            </button>
          </div>
          <span class="fld-hint">{{ styleHint() }}</span>
        </div>

        <!-- Source picker -->
        <div class="fld">
          <label>{{ draftStyle() === 'evolution' ? 'Escolha 1 registro' : (draftStyle() === 'compare' ? 'Escolha 1 ou 2 registros' : 'Escolha os registros') }}</label>
          @if (loadingCatalog()) {
            <div class="widget-nodata">Carregando registros…</div>
          } @else {
            @for (grp of catalogGroups(); track grp.type) {
              @if (grp.items.length) {
                <div class="src-group">
                  <span class="src-group__label">{{ typeLabel(grp.type) }}</span>
                  <div class="src-items">
                    @for (it of grp.items; track it.type + it.refId) {
                      <button type="button" class="src-chip" [class.selected]="isSelected(it)"
                              [disabled]="!isSelected(it) && !canSelectMore()"
                              (click)="toggleSource(it)">
                        <span class="cmp-dot" [style.background]="it.color"></span>
                        <span>{{ it.label }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            }
            @if (!hasCatalog()) {
              <div class="widget-nodata">Nenhum registro disponível. Cadastre categorias, cartões, empréstimos ou assinaturas de IA.</div>
            }
          }
        </div>

        <!-- Title -->
        <div class="fld">
          <label>Título do widget</label>
          <input class="inp" [(ngModel)]="draftTitle" placeholder="Ex: Alimentação vs Transporte" />
        </div>

        <div class="modal__foot">
          <button class="btn-secondary" (click)="closeBuilder()">Cancelar</button>
          <button class="btn-primary" [disabled]="!canSave()" (click)="saveWidget()">Salvar widget</button>
        </div>
      </div>
    </div>
  }
</section>
  `,
  styles: [`
  .cdash { margin: 1.25rem 0; }
  .cdash__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .75rem; }
  .section-label { font-size: .78rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; }
  .btn-add-widget { border: 1.5px solid #16a34a; background: #f0fdf4; color: #16a34a; font-weight: 600;
    font-size: .8rem; padding: .4rem .8rem; border-radius: .5rem; cursor: pointer; transition: all .15s; }
  .btn-add-widget:hover { background: #16a34a; color: #fff; }
  .btn-add-widget--lg { font-size: .9rem; padding: .6rem 1.2rem; margin-top: .5rem; }

  .cdash-empty { background: #fff; border: 1.5px dashed #d1d5db; border-radius: .75rem;
    padding: 2rem 1.5rem; text-align: center; }
  .cdash-empty__icon { font-size: 2rem; }
  .cdash-empty__title { font-weight: 700; color: #111; margin: .5rem 0 .25rem; }
  .cdash-empty__sub { font-size: .82rem; color: #6b7280; max-width: 420px; margin: 0 auto; }

  .widget-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  .widget { background: #fff; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.07); padding: 1.1rem 1.25rem; }
  .widget--wide { grid-column: 1 / -1; }
  .widget__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .9rem; }
  .widget__title { font-size: .92rem; font-weight: 700; color: #111; }
  .widget__actions { display: flex; gap: .35rem; }
  .wbtn { border: none; background: #f3f4f6; color: #6b7280; width: 26px; height: 26px; border-radius: .4rem;
    cursor: pointer; font-size: .8rem; line-height: 1; transition: all .12s; }
  .wbtn:hover { background: #e5e7eb; color: #111; }
  .wbtn--del:hover { background: #fee2e2; color: #dc2626; }

  .widget-loading { display: flex; flex-direction: column; gap: .5rem; }
  .wskel { height: 22px; border-radius: .4rem; background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
    background-size: 200% 100%; animation: wsh 1.4s infinite; }
  .wskel:nth-child(2) { width: 60%; }
  @keyframes wsh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .widget-nodata { text-align: center; color: #9ca3af; font-size: .82rem; padding: 1.5rem 0; }

  /* Compare */
  .cmp { display: flex; flex-direction: column; gap: .6rem; }
  .cmp-item { display: flex; align-items: center; gap: .55rem; }
  .cmp-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .cmp-label { flex: 1; font-size: .85rem; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cmp-val { font-size: 1rem; font-weight: 700; color: #111; }
  .cmp-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin-top: .2rem; background: #f3f4f6; }
  .cmp-bar__seg { height: 100%; }
  .cmp-diff { font-size: .78rem; color: #dc2626; font-weight: 600; }
  .cmp-diff--up { color: #16a34a; }

  /* Pie */
  .pie { display: flex; align-items: center; gap: 1rem; }
  .pie-svg { width: 120px; height: 120px; flex-shrink: 0; }
  .pie-legend { flex: 1; display: flex; flex-direction: column; gap: .4rem; min-width: 0; }
  .pie-leg-row { display: flex; align-items: center; gap: .5rem; }
  .pie-leg-label { flex: 1; font-size: .8rem; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pie-leg-pct { font-size: .78rem; font-weight: 700; color: #6b7280; }

  /* Evolution */
  .evo-svg { width: 100%; height: 160px; }

  /* Bar */
  .bar-svg { width: 100%; height: 140px; }

  /* Gauge */
  .gauge { display: flex; flex-direction: column; align-items: center; gap: .5rem; }
  .gauge-svg { width: 120px; height: 70px; }
  .gauge-info { display: flex; align-items: center; gap: .5rem; }
  .gauge-label { font-size: .8rem; color: #374151; }
  .gauge-pct { font-size: .78rem; font-weight: 700; color: #6b7280; }

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex;
    align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: #fff; border-radius: .9rem; width: 100%; max-width: 520px; max-height: 90vh;
    overflow-y: auto; padding: 1.5rem; }
  .modal__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .modal__head h2 { margin: 0; font-size: 1.15rem; color: #111; }
  .modal-close { border: none; background: none; font-size: 1.1rem; color: #9ca3af; cursor: pointer; }
  .fld { margin-bottom: 1.1rem; }
  .fld label { display: block; font-size: .82rem; font-weight: 600; color: #374151; margin-bottom: .45rem; }
  .fld-hint { display: block; font-size: .72rem; color: #9ca3af; margin-top: .35rem; }
  .inp { width: 100%; padding: .6rem .75rem; border: 1.5px solid #e5e7eb; border-radius: .5rem; font-size: .9rem; }
  .inp:focus { outline: none; border-color: #16a34a; }

  .style-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: .5rem; }
  .style-opt { display: flex; flex-direction: column; align-items: center; gap: .4rem; padding: .7rem .5rem;
    border: 1.5px solid #e5e7eb; border-radius: .6rem; background: #fff; cursor: pointer; color: #6b7280;
    font-size: .78rem; font-weight: 600; transition: all .15s; }
  .style-opt:hover { border-color: #9ca3af; }
  .style-opt.active { border-color: #16a34a; background: #f0fdf4; color: #16a34a; }

  .src-group { margin-bottom: .7rem; }
  .src-group__label { font-size: .72rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; }
  .src-items { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .35rem; }
  .src-chip { display: inline-flex; align-items: center; gap: .4rem; padding: .35rem .7rem; border-radius: 2rem;
    border: 1.5px solid #e5e7eb; background: #fff; font-size: .8rem; color: #374151; cursor: pointer; transition: all .12s; }
  .src-chip:hover:not(:disabled) { border-color: #9ca3af; }
  .src-chip.selected { border-color: #16a34a; background: #f0fdf4; color: #16a34a; font-weight: 600; }
  .src-chip:disabled { opacity: .4; cursor: not-allowed; }

  .modal__foot { display: flex; justify-content: flex-end; gap: .6rem; margin-top: .5rem; }
  .btn-secondary { padding: .6rem 1.1rem; border: 1.5px solid #e5e7eb; background: #fff; border-radius: .5rem;
    font-weight: 600; color: #6b7280; cursor: pointer; }
  .btn-primary { padding: .6rem 1.3rem; border: none; background: #16a34a; color: #fff; border-radius: .5rem;
    font-weight: 700; cursor: pointer; }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  @media (max-width: 720px) {
    .widget-grid { grid-template-columns: 1fr; }
  }
  `]
})
export class ConfigurableDashboardComponent implements OnInit {
  private api = inject(ApiService);

  // SVG constants
  readonly C = 2 * Math.PI * 38;
  readonly EVO_W = 520; readonly EVO_H = 160;
  readonly PAD_L = 34; readonly PAD_R = 12; readonly PAD_T = 12; readonly PAD_B = 22;
  readonly BAR_W = 520; readonly BAR_H = 140;

  widgets = signal<DashWidget[]>([]);
  data    = signal<Record<string, WidgetData>>({});

  // Catalog
  catalog        = signal<CatalogItem[]>([]);
  loadingCatalog = signal(false);
  catalogLoaded  = false;

  // Builder state
  builderOpen  = signal(false);
  editingId    = signal<string | null>(null);
  draftStyle   = signal<WidgetStyle>('compare');
  draftSources = signal<WidgetSource[]>([]);
  draftTitle   = '';

  private storageKey = 'dsfr_dash_widgets';

  ngOnInit() {
    const uid = this.userId();
    this.storageKey = `dsfr_dash_widgets_${uid}`;
    this.loadWidgets();
  }

  private userId(): string {
    try { return JSON.parse(localStorage.getItem('user') || '{}').id || 'anon'; }
    catch { return 'anon'; }
  }

  // ── Persistence ──
  private loadWidgets() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const list: DashWidget[] = raw ? JSON.parse(raw) : [];
      this.widgets.set(list);
      list.forEach(w => this.loadWidgetData(w));
    } catch { this.widgets.set([]); }
  }
  private persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.widgets()));
  }

  // ── Builder ──
  openBuilder() {
    this.editingId.set(null);
    this.draftStyle.set('compare');
    this.draftSources.set([]);
    this.draftTitle = '';
    this.builderOpen.set(true);
    this.ensureCatalog();
  }
  editWidget(w: DashWidget) {
    this.editingId.set(w.id);
    this.draftStyle.set(w.style);
    this.draftSources.set([...w.sources]);
    this.draftTitle = w.title;
    this.builderOpen.set(true);
    this.ensureCatalog();
  }
  closeBuilder() { this.builderOpen.set(false); }

  setStyle(s: WidgetStyle) {
    this.draftStyle.set(s);
    // Trim selection to fit new style limits
    const max = this.maxSources();
    if (this.draftSources().length > max) {
      this.draftSources.set(this.draftSources().slice(0, max));
    }
  }

  maxSources(): number {
    const s = this.draftStyle();
    if (s === 'evolution') return 1;
    if (s === 'compare') return 2;
    if (s === 'gauge') return 1;
    return 8; // pie, bar
  }
  canSelectMore(): boolean { return this.draftSources().length < this.maxSources(); }

  styleHint(): string {
    switch (this.draftStyle()) {
      case 'compare':   return 'Compare 1 ou 2 registros lado a lado.';
      case 'evolution': return 'Acompanhe a evolução de 1 registro nos últimos 6 meses.';
      case 'pie':       return 'Distribuição proporcional entre vários registros.';
      case 'bar':       return 'Barras verticais comparando valores dos registros.';
      case 'gauge':     return 'Medidor de progresso com base no valor total.';
      default:          return '';
    }
  }

  isSelected(it: CatalogItem): boolean {
    return this.draftSources().some(s => s.type === it.type && s.refId === it.refId);
  }
  toggleSource(it: CatalogItem) {
    const cur = this.draftSources();
    if (this.isSelected(it)) {
      this.draftSources.set(cur.filter(s => !(s.type === it.type && s.refId === it.refId)));
    } else {
      if (!this.canSelectMore()) return;
      const color = it.color || PALETTE[cur.length % PALETTE.length];
      this.draftSources.set([...cur, { type: it.type, refId: it.refId, label: it.label, color }]);
    }
    // Auto-title suggestion
    if (!this.draftTitle) this.draftTitle = this.suggestTitle();
  }

  private suggestTitle(): string {
    const s = this.draftSources();
    if (!s.length) return '';
    if (this.draftStyle() === 'compare' && s.length === 2) return `${s[0].label} vs ${s[1].label}`;
    if (s.length === 1) return s[0].label;
    return `${TYPE_LABEL[s[0].type]} · distribuição`;
  }

  canSave(): boolean {
    const n = this.draftSources().length;
    if (this.draftStyle() === 'evolution') return n === 1;
    if (this.draftStyle() === 'compare')   return n >= 1 && n <= 2;
    if (this.draftStyle() === 'gauge')     return n === 1;
    return n >= 2; // pie, bar
  }

  saveWidget() {
    if (!this.canSave()) return;
    const title = (this.draftTitle || this.suggestTitle() || 'Widget').trim();
    const id = this.editingId() ?? Math.random().toString(36).slice(2);
    const w: DashWidget = { id, title, style: this.draftStyle(), sources: this.draftSources() };
    const list = this.editingId()
      ? this.widgets().map(x => x.id === id ? w : x)
      : [...this.widgets(), w];
    this.widgets.set(list);
    this.persist();
    this.loadWidgetData(w);
    this.builderOpen.set(false);
  }

  removeWidget(id: string) {
    this.widgets.set(this.widgets().filter(w => w.id !== id));
    this.persist();
    const d = { ...this.data() }; delete d[id]; this.data.set(d);
  }

  // ── Catalog loading ──
  private ensureCatalog() { this.ensureCatalogThen(() => {}); }

  hasCatalog(): boolean { return this.catalog().length > 0; }
  typeLabel(t: SourceType): string { return TYPE_LABEL[t]; }

  catalogGroups = computed(() => {
    const order: SourceType[] = ['category', 'card', 'debt', 'ai'];
    return order.map(type => ({ type, items: this.catalog().filter(i => i.type === type) }));
  });

  private catalogItem(src: WidgetSource): CatalogItem | undefined {
    return this.catalog().find(i => i.type === src.type && i.refId === src.refId);
  }

  // ── Month helpers ──
  private monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  private lastMonths(n: number): { key: string; label: string; start: string; end: string }[] {
    const now = new Date();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = this.monthKey(d);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      out.push({
        key,
        label: PT_MONTHS_SHORT[d.getMonth()],
        start: `${key}-01`,
        end: `${key}-${String(last).padStart(2, '0')}`,
      });
    }
    return out;
  }

  // ── Data fetching ──
  private setWD(id: string, partial: Partial<WidgetData>) {
    this.data.set({ ...this.data(), [id]: { ...(this.data()[id] ?? this.emptyWD()), ...partial } });
  }
  private emptyWD(): WidgetData {
    return { loading: false, values: [], series: { months: [], lines: [] } };
  }

  private loadWidgetData(w: DashWidget) {
    this.setWD(w.id, { loading: true });
    // Catalog provides raw values for debt/ai and colors
    this.ensureCatalogThen(() => this.resolveWidget(w));
  }

  private ensureCatalogThen(cb: () => void) {
    if (this.catalogLoaded) { cb(); return; }
    this.loadingCatalog.set(true);
    forkJoin({
      cats:  this.api.get<any>('/categories').pipe(catchError(() => of({ data: [] }))),
      cards: this.api.get<any>('/credit-cards').pipe(catchError(() => of({ data: [] }))),
      debts: this.api.get<any>('/debts').pipe(catchError(() => of({ data: [] }))),
      ai:    this.api.get<any>('/ai-subscriptions').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(res => {
      const items: CatalogItem[] = [];
      (res.cats.data ?? []).forEach((c: any, i: number) =>
        items.push({ type: 'category', refId: c.id, label: c.name, color: c.color || PALETTE[i % PALETTE.length], icon: c.icon, raw: c }));
      (res.cards.data ?? []).forEach((c: any, i: number) =>
        items.push({ type: 'card', refId: c.id, label: c.name, color: c.color || PALETTE[i % PALETTE.length], raw: c }));
      (res.debts.data ?? []).forEach((d: any, i: number) =>
        items.push({ type: 'debt', refId: d.id, label: d.name, color: PALETTE[(i + 2) % PALETTE.length], raw: d }));
      (res.ai.data ?? []).forEach((a: any, i: number) =>
        items.push({ type: 'ai', refId: a.id, label: a.name, color: a.color || PALETTE[(i + 4) % PALETTE.length], raw: a }));
      this.catalog.set(items);
      this.catalogLoaded = true;
      this.loadingCatalog.set(false);
      cb();
    });
  }

  private resolveWidget(w: DashWidget) {
    if (w.style === 'evolution') {
      const src = w.sources[0];
      if (!src) { this.setWD(w.id, { loading: false }); return; }
      const months = this.lastMonths(6);
      this.series$(src, months).subscribe(points => {
        this.setWD(w.id, {
          loading: false,
          series: { months: months.map(m => m.label), lines: [{ label: src.label, color: src.color, points }] },
        });
      });
    } else {
      // compare / pie → current value per source
      forkJoin(w.sources.map(s => this.currentValue$(s).pipe(
        map(value => ({ label: s.label, value, color: s.color })),
        catchError(() => of({ label: s.label, value: 0, color: s.color })),
      ))).subscribe(values => {
        this.setWD(w.id, { loading: false, values });
      });
    }
  }

  private currentValue$(src: WidgetSource): Observable<number> {
    const m = this.lastMonths(1)[0];
    switch (src.type) {
      case 'category':
        return this.api.get<any>(`/reports/categories?date_from=${m.start}&date_to=${m.end}`).pipe(
          map(r => {
            const row = (r.data ?? []).find((x: any) => x.category_id === src.refId || x.id === src.refId);
            return row ? Math.abs(row.total ?? 0) : 0;
          }), catchError(() => of(0)));
      case 'card':
        return this.api.get<any>(`/reports/cards/${src.refId}/invoices`).pipe(
          map(r => {
            const row = (r.data ?? []).find((x: any) => x.month === m.key);
            return row ? Math.abs(row.total ?? row.expense ?? 0) : 0;
          }), catchError(() => of(0)));
      case 'debt': {
        const it = this.catalogItem(src);
        return of(Math.abs(it?.raw?.remaining_balance ?? 0));
      }
      case 'ai': {
        const it = this.catalogItem(src);
        return of(Math.abs(it?.raw?.monthly_cost ?? 0));
      }
    }
  }

  private series$(src: WidgetSource, months: { key: string; start: string; end: string }[]): Observable<number[]> {
    switch (src.type) {
      case 'category':
        return forkJoin(months.map(m =>
          this.api.get<any>(`/reports/categories?date_from=${m.start}&date_to=${m.end}`).pipe(
            map(r => {
              const row = (r.data ?? []).find((x: any) => x.category_id === src.refId || x.id === src.refId);
              return row ? Math.abs(row.total ?? 0) : 0;
            }), catchError(() => of(0))))
        );
      case 'card':
        return this.api.get<any>(`/reports/cards/${src.refId}/invoices`).pipe(
          map(r => {
            const byMonth: Record<string, number> = {};
            (r.data ?? []).forEach((x: any) => { byMonth[x.month] = Math.abs(x.total ?? x.expense ?? 0); });
            return months.map(m => byMonth[m.key] ?? 0);
          }), catchError(() => of(months.map(() => 0))));
      case 'debt': {
        const it = this.catalogItem(src);
        const v = Math.abs(it?.raw?.remaining_balance ?? 0);
        return of(months.map(() => v));
      }
      case 'ai': {
        const it = this.catalogItem(src);
        const v = Math.abs(it?.raw?.monthly_cost ?? 0);
        return of(months.map(() => v));
      }
    }
  }

  // ── Compare helpers ──
  comparePct(id: string): number {
    const v = this.data()[id]?.values ?? [];
    if (v.length < 2) return 50;
    const total = v[0].value + v[1].value;
    return total > 0 ? (v[0].value / total) * 100 : 50;
  }
  compareDiff(id: string): number {
    const v = this.data()[id]?.values ?? [];
    if (v.length < 2) return 0;
    return v[0].value - v[1].value;
  }
  absDiff(id: string): number { return Math.abs(this.compareDiff(id)); }

  // ── Pie helpers ──
  pieTotal(id: string): number {
    return (this.data()[id]?.values ?? []).reduce((s, v) => s + v.value, 0);
  }
  pieTotalShort(id: string): string {
    const t = this.pieTotal(id);
    if (t >= 1e6) return (t / 1e6).toFixed(1) + 'M';
    if (t >= 1e3) return (t / 1e3).toFixed(1) + 'k';
    return t.toFixed(0);
  }
  pieSegments(id: string) {
    const vals = this.data()[id]?.values ?? [];
    const total = this.pieTotal(id);
    if (!total) return [];
    let acc = 0;
    return vals.map(v => {
      const frac = v.value / total;
      const dash = frac * this.C;
      const seg = { label: v.label, color: v.color, dash, offset: this.C - acc, pct: Math.round(frac * 100) };
      acc += dash;
      return seg;
    });
  }

  // ── Evolution helpers ──
  hasSeries(id: string): boolean {
    const lines = this.data()[id]?.series?.lines ?? [];
    return lines.length > 0 && lines.some(l => l.points.some(p => p > 0));
  }
  evoMonths(id: string): string[] { return this.data()[id]?.series?.months ?? []; }
  private evoMax(id: string): number {
    const lines = this.data()[id]?.series?.lines ?? [];
    return Math.max(...lines.flatMap(l => l.points), 1) * 1.15;
  }
  evoX(i: number, n: number): number {
    const W = this.EVO_W - this.PAD_L - this.PAD_R;
    return this.PAD_L + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  }
  evoY(id: string, v: number): number {
    const H = this.EVO_H - this.PAD_T - this.PAD_B;
    return this.PAD_T + H - (v / this.evoMax(id)) * H;
  }
  evoPoints(id: string, points: number[]): string {
    return points.map((v, i) => `${this.evoX(i, points.length)},${this.evoY(id, v)}`).join(' ');
  }
  evoYLines(id: string) {
    const max = this.evoMax(id);
    const H = this.EVO_H - this.PAD_T - this.PAD_B;
    const fmt = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0);
    return [0, 0.5, 1].map(t => ({ py: this.PAD_T + H - t * H, label: fmt(t * max) }));
  }

  // ── Bar helpers ──
  barValues(id: string) { return this.data()[id]?.values ?? []; }
  private barMax(id: string): number {
    const vals = this.barValues(id);
    return Math.max(...vals.map(v => v.value), 1) * 1.15;
  }
  barYLines(id: string) {
    const max = this.barMax(id);
    const H = this.BAR_H - this.PAD_T - this.PAD_B;
    const fmt = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0);
    return [0, 0.5, 1].map(t => ({ py: this.PAD_T + H - t * H, label: fmt(t * max) }));
  }
  barX(i: number, n: number): number {
    const W = this.BAR_W - this.PAD_L - this.PAD_R;
    return this.PAD_L + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  }
  barW(n: number): number {
    const W = this.BAR_W - this.PAD_L - this.PAD_R;
    return Math.max(8, Math.floor(W / (n * 3 + 1)) - 2);
  }
  barY(id: string, v: number): number {
    const H = this.BAR_H - this.PAD_T - this.PAD_B;
    return this.PAD_T + H - (v / this.barMax(id)) * H;
  }
  barH(id: string, v: number): number {
    const H = this.BAR_H - this.PAD_T - this.PAD_B;
    return (v / this.barMax(id)) * H;
  }

  // ── Gauge helpers ──
  gaugeValue(id: string): number {
    const v = this.data()[id]?.values?.[0]?.value ?? 0;
    return Math.abs(v);
  }
  gaugeLabel(id: string): string {
    return this.data()[id]?.values?.[0]?.label ?? '';
  }
  gaugeColor(id: string): string {
    return this.data()[id]?.values?.[0]?.color ?? '#6366f1';
  }
  gaugePct(id: string): number {
    const v = this.gaugeValue(id);
    // Use a fixed target of 5000 for percentage, or use the max of other values if available
    const target = 5000;
    return Math.min(100, Math.round((v / target) * 100));
  }
  gaugeDash(id: string): number {
    const pct = this.gaugePct(id) / 100;
    return pct * 314; // 2 * PI * 50 ≈ 314
  }
  gaugeValueShort(id: string): string {
    const t = this.gaugeValue(id);
    if (t >= 1e6) return (t / 1e6).toFixed(1) + 'M';
    if (t >= 1e3) return (t / 1e3).toFixed(1) + 'k';
    return t.toFixed(0);
  }
}
