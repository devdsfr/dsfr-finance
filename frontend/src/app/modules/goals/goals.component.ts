import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';

// ── Chart geometry constants ──────────────────────────────────────────────
const RING_R   = 52;                        // ring circle radius
const RING_C   = +(2 * Math.PI * RING_R).toFixed(2); // ≈ 326.73
const GAUGE_R  = 72;                        // gauge semi-circle radius
const GAUGE_C  = +(Math.PI * GAUGE_R).toFixed(2);    // ≈ 226.19  (half circumference)

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppCurrencyPipe, MoneyMaskDirective],
  template: `
<div class="goals-page">

  <!-- ── Page header ─────────────────────────────────────────────────── -->
  <div class="page-header">
    <div>
      <h1 class="page-title">🎯 Objetivos</h1>
      <p class="page-sub">Acompanhe suas metas financeiras com gráficos em tempo real</p>
    </div>
    <button class="btn-new" (click)="openForm()">+ Novo Objetivo</button>
  </div>

  <!-- ── Empty state ─────────────────────────────────────────────────── -->
  @if (!loading() && goals().length === 0) {
    <div class="empty-state">
      <div class="empty-icon">🎯</div>
      <h2>Nenhum objetivo ainda</h2>
      <p>Crie seu primeiro objetivo financeiro e acompanhe seu progresso com gráficos interativos.</p>
      <button class="btn-new" (click)="openForm()">Criar primeiro objetivo</button>
    </div>
  }

  <!-- ── Loading skeleton ──────────────────────────────────────────── -->
  @if (loading()) {
    <div class="goal-grid">
      @for (i of [1,2,3]; track i) {
        <div class="goal-card goal-skel">
          <div class="skel sk-title"></div>
          <div class="skel sk-chart"></div>
          <div class="skel sk-bar"></div>
        </div>
      }
    </div>
  }

  <!-- ── Goal cards grid ─────────────────────────────────────────────── -->
  @if (!loading() && goals().length > 0) {
    <div class="goal-grid">
      @for (g of goals(); track g.id) {
        <div class="goal-card" [style.--goal-color]="g.color">

          <!-- Card header -->
          <div class="gc-header">
            <div class="gc-icon">{{ g.icon }}</div>
            <div class="gc-meta">
              <div class="gc-name">{{ g.name }}</div>
              <span class="gc-badge" [class]="'gc-badge--' + g.type">{{ typeLabel(g.type) }}</span>
            </div>
            <div class="gc-actions">
              <button class="gc-btn" title="Editar" (click)="openForm(g)">✏️</button>
              <button class="gc-btn gc-btn--del" title="Excluir" (click)="deleteGoal(g.id)">🗑️</button>
            </div>
          </div>

          <!-- ── Chart area ─────────────────────────────────────────── -->
          <div class="gc-chart">

            <!-- 1. ANEL (Ring) ─────────────────────────────────────── -->
            @if (g.chart_style === 'ring') {
              <svg viewBox="0 0 130 130" class="chart-svg chart-svg--ring">
                <circle cx="65" cy="65" r="52" fill="none" stroke="#f3f4f6" stroke-width="12"/>
                <circle cx="65" cy="65" r="52" fill="none"
                        [attr.stroke]="progressColor(g)"
                        stroke-width="12"
                        stroke-linecap="round"
                        [attr.stroke-dasharray]="ringDash(g)"
                        stroke-dashoffset="81.7"
                        transform="rotate(-90 65 65)"/>
                <text x="65" y="60" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">
                  {{ g.progress_pct | number:'1.0-0' }}%
                </text>
                <text x="65" y="76" text-anchor="middle" font-size="10" fill="#9ca3af">{{ currentLabel(g) }}</text>
                <text x="65" y="90" text-anchor="middle" font-size="10" fill="#6b7280" font-weight="600">
                  {{ g.current_amount | appCurrency }}
                </text>
              </svg>
            }

            <!-- 2. BARRAS (Bar) ────────────────────────────────────── -->
            @if (g.chart_style === 'bar') {
              <svg viewBox="0 0 280 140" class="chart-svg chart-svg--bar">
                <!-- Target line -->
                <line x1="10" [attr.x2]="270" [attr.y1]="targetLineY(g)" [attr.y2]="targetLineY(g)"
                      stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="272" [attr.y]="targetLineY(g) + 4" font-size="8" fill="#dc2626">Meta</text>
                <!-- Bars -->
                @for (d of g.monthly_data; track d.month; let i = $index) {
                  <rect
                    [attr.x]="14 + i * 42"
                    [attr.y]="115 - barH(d.amount, g)"
                    width="28"
                    [attr.height]="barH(d.amount, g)"
                    rx="3"
                    [attr.fill]="d.amount >= g.target_amount ? '#dc2626' : progressColor(g)"
                    fill-opacity="0.85"/>
                  <text
                    [attr.x]="28 + i * 42"
                    y="128"
                    text-anchor="middle"
                    font-size="8"
                    fill="#9ca3af">{{ monthShort(d.month) }}</text>
                }
                <!-- Current value label -->
                <text x="10" y="11" font-size="9" fill="#374151" font-weight="600">
                  Atual: {{ g.current_amount | appCurrency }}
                </text>
              </svg>
            }

            <!-- 3. TERMÔMETRO (Thermometer) ────────────────────────── -->
            @if (g.chart_style === 'thermometer') {
              <svg viewBox="0 0 100 180" class="chart-svg chart-svg--thermo">
                <!-- Tube background -->
                <rect x="38" y="18" width="24" height="120" rx="12" fill="#f3f4f6"/>
                <!-- Fill -->
                <rect [attr.x]="38" [attr.y]="thermoY(g)" width="24"
                      [attr.height]="138 - thermoY(g)" rx="12"
                      [attr.fill]="progressColor(g)"/>
                <!-- Scale marks -->
                @for (pct of [25, 50, 75]; track pct) {
                  <line [attr.x1]="34" x2="38" [attr.y1]="138 - pct*1.2" [attr.y2]="138 - pct*1.2"
                        stroke="#d1d5db" stroke-width="1"/>
                  <text x="31" [attr.y]="142 - pct*1.2" text-anchor="end" font-size="7" fill="#9ca3af">
                    {{ pct }}%
                  </text>
                }
                <text x="31" y="21" text-anchor="end" font-size="7" fill="#9ca3af">100%</text>
                <!-- Bulb -->
                <circle cx="50" cy="152" r="20" [attr.fill]="progressColor(g)"/>
                <!-- Bulb shine -->
                <circle cx="43" cy="146" r="4" fill="rgba(255,255,255,0.3)"/>
                <!-- Value in bulb -->
                <text x="50" y="156" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">
                  {{ g.progress_pct | number:'1.0-0' }}%
                </text>
                <!-- Labels -->
                <text x="50" y="13" text-anchor="middle" font-size="9" fill="#374151" font-weight="600">
                  {{ g.current_amount | appCurrency }}
                </text>
              </svg>
            }

            <!-- 4. LINHA (Line + projection) ──────────────────────── -->
            @if (g.chart_style === 'line') {
              <svg viewBox="0 0 280 140" class="chart-svg chart-svg--line">
                <!-- Grid lines -->
                @for (pct of [0, 50, 100]; track pct) {
                  <line x1="10" x2="270" [attr.y1]="110 - pct*0.9" [attr.y2]="110 - pct*0.9"
                        stroke="#f3f4f6" stroke-width="1"/>
                  <text x="8" [attr.y]="114 - pct*0.9" text-anchor="end" font-size="7" fill="#d1d5db">
                    {{ pct }}%
                  </text>
                }
                <!-- Target line -->
                <line x1="10" x2="270" [attr.y1]="20" [attr.y2]="20"
                      stroke="#dc2626" stroke-width="1" stroke-dasharray="5 3"/>
                <!-- Gradient def -->
                <defs>
                  <linearGradient [attr.id]="'grad-' + g.id" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" [attr.stop-color]="progressColor(g)" stop-opacity="0.4"/>
                    <stop offset="100%" [attr.stop-color]="progressColor(g)" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <!-- Area fill -->
                <polyline [attr.points]="lineAreaPoints(g)"
                          [attr.fill]="'url(#grad-' + g.id + ')'" fill-opacity="0.15" stroke="none"/>
                <!-- Line -->
                <polyline [attr.points]="linePoints(g)" fill="none"
                          [attr.stroke]="progressColor(g)" stroke-width="2.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                <!-- Data dots -->
                @for (pt of lineDataPoints(g); track pt.x) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5"
                          fill="#fff" [attr.stroke]="progressColor(g)" stroke-width="2"/>
                }
                <!-- Month labels -->
                @for (d of g.monthly_data; track d.month; let i = $index) {
                  <text [attr.x]="lineX(i, g)" y="128"
                        text-anchor="middle" font-size="8" fill="#9ca3af">{{ monthShort(d.month) }}</text>
                }
                <!-- Current value -->
                <text x="10" y="12" font-size="9" fill="#374151" font-weight="600">
                  {{ g.current_amount | appCurrency }} / {{ g.target_amount | appCurrency }}
                </text>
              </svg>
            }

            <!-- 5. VELOCÍMETRO (Gauge) ─────────────────────────────── -->
            @if (g.chart_style === 'gauge') {
              <svg viewBox="0 0 180 110" class="chart-svg chart-svg--gauge">
                <!-- Color zone: green 0-60% -->
                <path d="M 18,95 A 72,72 0 0 1 162,95" fill="none" stroke="#dcfce7" stroke-width="16" stroke-linecap="butt"/>
                <!-- Color zone: yellow 60-80% -->
                <path d="M 18,95 A 72,72 0 0 1 162,95" fill="none" stroke="#fef9c3" stroke-width="16" stroke-linecap="butt"
                      [attr.stroke-dasharray]="(0.8 * gaugeC) + ' ' + gaugeC"
                      [attr.stroke-dashoffset]="-(0.6 * gaugeC)"/>
                <!-- Color zone: red 80-100% -->
                <path d="M 18,95 A 72,72 0 0 1 162,95" fill="none" stroke="#fee2e2" stroke-width="16" stroke-linecap="butt"
                      [attr.stroke-dasharray]="(0.2 * gaugeC) + ' ' + gaugeC"
                      [attr.stroke-dashoffset]="-(0.8 * gaugeC)"/>
                <!-- Track -->
                <path d="M 18,95 A 72,72 0 0 1 162,95" fill="none" stroke="#e5e7eb" stroke-width="14" stroke-linecap="round"/>
                <!-- Fill arc -->
                <path d="M 18,95 A 72,72 0 0 1 162,95" fill="none"
                      [attr.stroke]="progressColor(g)"
                      stroke-width="14"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="gaugeDash(g)"
                      stroke-dashoffset="0"/>
                <!-- Needle -->
                <line x1="90" y1="95"
                      [attr.x2]="gaugeNeedleX(g)" [attr.y2]="gaugeNeedleY(g)"
                      [attr.stroke]="progressColor(g)" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="90" cy="95" r="5" [attr.fill]="progressColor(g)"/>
                <!-- Scale labels -->
                <text x="14" y="108" font-size="8" fill="#9ca3af">0%</text>
                <text x="86" y="20" text-anchor="middle" font-size="8" fill="#9ca3af">50%</text>
                <text x="164" y="108" text-anchor="end" font-size="8" fill="#9ca3af">100%</text>
                <!-- Center value -->
                <text x="90" y="78" text-anchor="middle" font-size="20" font-weight="700" [attr.fill]="progressColor(g)">
                  {{ g.progress_pct | number:'1.0-0' }}%
                </text>
              </svg>
            }

          </div>

          <!-- Card footer -->
          <div class="gc-footer">
            <div class="gc-progress-bar">
              <div class="gc-progress-fill"
                   [style.width]="(g.progress_pct > 100 ? 100 : g.progress_pct) + '%'"
                   [style.background]="progressColor(g)"></div>
            </div>
            <div class="gc-stats">
              <div class="gc-stat">
                <span class="gc-stat__label">{{ currentLabel(g) }}</span>
                <span class="gc-stat__val">{{ g.current_amount | appCurrency }}</span>
              </div>
              <div class="gc-stat gc-stat--right">
                <span class="gc-stat__label">Meta</span>
                <span class="gc-stat__val">{{ g.target_amount | appCurrency }}</span>
              </div>
            </div>
            @if (g.target_date) {
              <div class="gc-deadline" [class.gc-deadline--urgent]="daysLeft(g) < 30">
                @if (daysLeft(g) > 0) {
                  ⏱ {{ daysLeft(g) }} dias restantes
                } @else {
                  ⚠️ Prazo encerrado
                }
              </div>
            }
          </div>

        </div>
      }
    </div>
  }

  <!-- ── Form modal ──────────────────────────────────────────────────── -->
  @if (showForm()) {
    <div class="overlay" (click)="closeForm()">
      <div class="form-modal" (click)="$event.stopPropagation()">

        <div class="fm-header">
          <h2>{{ editingId() ? 'Editar Objetivo' : 'Novo Objetivo' }}</h2>
          <button class="fm-close" (click)="closeForm()">✕</button>
        </div>

        <div class="fm-body">

          <!-- Name field -->
          <div class="fm-label">Nome do objetivo</div>
          <input [(ngModel)]="form.name" name="name" class="fm-input"
                 placeholder="Ex: Viagem, Reserva de emergência…" required
                 style="width:100%;margin-bottom:.75rem" />

          <!-- Icon picker -->
          <div class="fm-label">Ícone</div>
          <div class="fm-icon-pick">
            @for (ic of iconOpts; track ic) {
              <button type="button" class="icon-btn" [class.icon-btn--sel]="form.icon === ic"
                      (click)="form.icon = ic">{{ ic }}</button>
            }
          </div>

          <!-- Type selector -->
          <div class="fm-label">Tipo de objetivo</div>
          <div class="type-grid">
            @for (t of typeOpts; track t.value) {
              <button type="button" class="type-opt" [class.type-opt--sel]="form.type === t.value"
                      (click)="form.type = t.value; onTypeChange()">
                <span class="type-opt__icon">{{ t.icon }}</span>
                <span class="type-opt__label">{{ t.label }}</span>
                <span class="type-opt__desc">{{ t.desc }}</span>
              </button>
            }
          </div>

          <!-- Category selector (only for category type) -->
          @if (form.type === 'category') {
            <div class="fm-label">Categoria</div>
            <select [(ngModel)]="form.category_id" name="category_id" class="fm-select">
              <option value="">Selecione uma categoria</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
              }
            </select>
          }

          <!-- Account selector (only for saving type) -->
          @if (form.type === 'saving') {
            <div class="fm-label">Conta (opcional)</div>
            <select [(ngModel)]="form.account_id" name="account_id" class="fm-select">
              <option value="">Todas as contas</option>
              @for (acc of accounts(); track acc.id) {
                <option [value]="acc.id">{{ acc.name }}</option>
              }
            </select>
          }

          <!-- Target amount + date -->
          <div class="fm-row fm-row--2">
            <div>
              <div class="fm-label">Meta (R$)</div>
              <div class="amount-wrap">
                <span class="currency-prefix">R$</span>
                <input [(ngModel)]="form.target_amount" name="target_amount"
                       type="text" inputmode="decimal" appMoneyMask
                       class="fm-input" placeholder="0,00" required />
              </div>
            </div>
            <div>
              <div class="fm-label">Prazo (opcional)</div>
              <input [(ngModel)]="form.target_date" name="target_date" type="date"
                     class="fm-input" />
            </div>
          </div>

          <!-- Chart style -->
          <div class="fm-label">Estilo do gráfico</div>
          <div class="chart-style-grid">
            @for (cs of chartStyleOpts; track cs.value) {
              <button type="button" class="cs-opt" [class.cs-opt--sel]="form.chart_style === cs.value"
                      (click)="form.chart_style = cs.value">
                <div class="cs-preview">
                  <!-- Mini SVG preview per style -->
                  @if (cs.value === 'ring') {
                    <svg viewBox="0 0 40 40" width="40" height="40">
                      <circle cx="20" cy="20" r="14" fill="none" stroke="#e5e7eb" stroke-width="4"/>
                      <circle cx="20" cy="20" r="14" fill="none" stroke="#2e7736" stroke-width="4"
                              stroke-dasharray="52 88" stroke-dashoffset="22"
                              transform="rotate(-90 20 20)"/>
                      <text x="20" y="24" text-anchor="middle" font-size="8" font-weight="700" fill="#111">60%</text>
                    </svg>
                  }
                  @if (cs.value === 'bar') {
                    <svg viewBox="0 0 40 40" width="40" height="40">
                      <rect x="4" y="22" width="6" height="14" rx="1" fill="#2e7736" fill-opacity="0.5"/>
                      <rect x="12" y="16" width="6" height="20" rx="1" fill="#2e7736" fill-opacity="0.7"/>
                      <rect x="20" y="10" width="6" height="26" rx="1" fill="#2e7736"/>
                      <rect x="28" y="18" width="6" height="18" rx="1" fill="#2e7736" fill-opacity="0.6"/>
                      <line x1="2" x2="38" y1="8" y2="8" stroke="#dc2626" stroke-width="1" stroke-dasharray="3 2"/>
                    </svg>
                  }
                  @if (cs.value === 'thermometer') {
                    <svg viewBox="0 0 40 40" width="40" height="40">
                      <rect x="16" y="4" width="8" height="24" rx="4" fill="#e5e7eb"/>
                      <rect x="16" y="16" width="8" height="12" rx="4" fill="#2e7736"/>
                      <circle cx="20" cy="32" r="6" fill="#2e7736"/>
                    </svg>
                  }
                  @if (cs.value === 'line') {
                    <svg viewBox="0 0 40 40" width="40" height="40">
                      <polyline points="4,32 12,24 20,26 28,14 36,10"
                                fill="none" stroke="#2e7736" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="4" cy="32" r="2" fill="#2e7736"/>
                      <circle cx="20" cy="26" r="2" fill="#2e7736"/>
                      <circle cx="36" cy="10" r="2" fill="#2e7736"/>
                      <line x1="2" x2="38" y1="8" y2="8" stroke="#dc2626" stroke-width="1" stroke-dasharray="3 2"/>
                    </svg>
                  }
                  @if (cs.value === 'gauge') {
                    <svg viewBox="0 0 40 30" width="40" height="30">
                      <path d="M 4,28 A 16,16 0 0 1 36,28" fill="none" stroke="#e5e7eb" stroke-width="5" stroke-linecap="round"/>
                      <path d="M 4,28 A 16,16 0 0 1 36,28" fill="none" stroke="#2e7736" stroke-width="5"
                            stroke-dasharray="30 50" stroke-linecap="round"/>
                      <line x1="20" y1="28" x2="28" y2="13" stroke="#2e7736" stroke-width="1.5" stroke-linecap="round"/>
                      <circle cx="20" cy="28" r="2.5" fill="#2e7736"/>
                    </svg>
                  }
                </div>
                <span class="cs-name">{{ cs.label }}</span>
              </button>
            }
          </div>

          <!-- Color picker -->
          <div class="fm-label">Cor</div>
          <div class="color-row">
            @for (col of colorOpts; track col) {
              <button type="button" class="color-dot" [style.background]="col"
                      [class.color-dot--sel]="form.color === col"
                      (click)="form.color = col"></button>
            }
          </div>

        </div>

        <div class="fm-footer">
          <button type="button" class="fm-btn fm-btn--cancel" (click)="closeForm()">Cancelar</button>
          <button type="button" class="fm-btn fm-btn--save" [disabled]="savingGoal()"
                  (click)="saveGoal()">
            {{ savingGoal() ? 'Salvando…' : (editingId() ? 'Salvar' : 'Criar objetivo') }}
          </button>
        </div>

      </div>
    </div>
  }

</div>
  `,
  styles: [`
    /* ── Page ── */
    .goals-page { padding-bottom: 2rem; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 800; color: #111827; }
    .page-sub { margin: .25rem 0 0; font-size: .85rem; color: #9ca3af; }
    .btn-new {
      padding: .6rem 1.25rem; background: #2e7736; color: #fff;
      border: none; border-radius: .5rem; font-size: .875rem; font-weight: 700;
      cursor: pointer; white-space: nowrap; transition: background .15s;
    }
    .btn-new:hover { background: #236029; }

    /* ── Empty state ── */
    .empty-state {
      text-align: center; padding: 4rem 2rem;
      background: #fff; border-radius: .75rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
    }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
    .empty-state h2 { margin: 0 0 .5rem; color: #111827; }
    .empty-state p { color: #6b7280; margin: 0 0 1.5rem; }

    /* ── Skeleton ── */
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    .skel {
      border-radius: .5rem;
      background: linear-gradient(90deg,#ececec 25%,#d8d8d8 50%,#ececec 75%);
      background-size: 1200px 100%;
      animation: shimmer 1.5s infinite;
    }
    .goal-skel { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; min-height: 320px; }
    .sk-title  { height: 1.1rem; width: 60%; }
    .sk-chart  { flex: 1; min-height: 160px; border-radius: .75rem; }
    .sk-bar    { height: .75rem; }

    /* ── Grid ── */
    .goal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }

    /* ── Goal card ── */
    .goal-card {
      background: #fff; border-radius: .875rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      display: flex; flex-direction: column;
      overflow: hidden;
      border-top: 3px solid var(--goal-color, #2e7736);
      transition: box-shadow .2s;
    }
    .goal-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); }

    /* Card header */
    .gc-header {
      display: flex; align-items: center; gap: .75rem;
      padding: 1rem 1rem .5rem;
    }
    .gc-icon {
      width: 40px; height: 40px; border-radius: .5rem;
      background: #f9fafb; display: flex; align-items: center;
      justify-content: center; font-size: 1.4rem; flex-shrink: 0;
    }
    .gc-meta { flex: 1; min-width: 0; }
    .gc-name { font-size: .95rem; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gc-badge {
      display: inline-block; padding: .15rem .5rem; border-radius: 2rem;
      font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      margin-top: .2rem;
    }
    .gc-badge--category   { background: #ede9fe; color: #7c3aed; }
    .gc-badge--saving     { background: #dcfce7; color: #16a34a; }
    .gc-badge--patrimony  { background: #dbeafe; color: #2563eb; }
    .gc-badge--debt       { background: #fee2e2; color: #dc2626; }
    .gc-actions { display: flex; gap: .25rem; flex-shrink: 0; }
    .gc-btn {
      background: none; border: none; cursor: pointer;
      padding: .3rem; border-radius: .375rem; font-size: .95rem;
      opacity: .5; transition: opacity .15s, background .15s;
    }
    .gc-btn:hover { opacity: 1; background: #f3f4f6; }
    .gc-btn--del:hover { background: #fee2e2; }

    /* Chart area */
    .gc-chart {
      padding: .5rem 1rem; display: flex; justify-content: center; align-items: center;
      min-height: 160px;
    }
    .chart-svg { width: 100%; max-width: 280px; }
    .chart-svg--ring { max-width: 160px; }
    .chart-svg--thermo { max-width: 100px; }
    .chart-svg--gauge { max-width: 200px; }

    /* Card footer */
    .gc-footer { padding: .5rem 1rem 1rem; }
    .gc-progress-bar {
      height: 6px; background: #f3f4f6; border-radius: 3px;
      overflow: hidden; margin-bottom: .75rem;
    }
    .gc-progress-fill {
      height: 100%; border-radius: 3px;
      transition: width .5s ease;
    }
    .gc-stats { display: flex; justify-content: space-between; margin-bottom: .5rem; }
    .gc-stat { display: flex; flex-direction: column; gap: .1rem; }
    .gc-stat--right { align-items: flex-end; }
    .gc-stat__label { font-size: .7rem; color: #9ca3af; }
    .gc-stat__val { font-size: .875rem; font-weight: 700; color: #111827; }
    .gc-deadline {
      text-align: center; font-size: .75rem; color: #6b7280;
      padding: .25rem .5rem; background: #f9fafb;
      border-radius: .375rem;
    }
    .gc-deadline--urgent { color: #dc2626; background: #fef2f2; }

    /* ── Overlay + modal ── */
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 1rem;
    }
    .form-modal {
      background: #fff; border-radius: .875rem;
      width: 100%; max-width: 520px;
      max-height: 92vh; overflow-y: auto;
      box-shadow: 0 24px 48px rgba(0,0,0,.22);
      display: flex; flex-direction: column;
    }
    .fm-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem 0;
    }
    .fm-header h2 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #111827; }
    .fm-close {
      width: 28px; height: 28px; border-radius: 50%; border: none;
      background: #f3f4f6; color: #6b7280; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .fm-close:hover { background: #e5e7eb; }
    .fm-body { padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: .75rem; }
    .fm-footer {
      padding: 1rem 1.5rem; display: flex; gap: .75rem; justify-content: flex-end;
      border-top: 1px solid #f3f4f6;
    }

    /* Form fields */
    .fm-label { font-size: .78rem; font-weight: 600; color: #374151; margin-bottom: -.25rem; }
    .fm-input {
      width: 100%; padding: .5rem .75rem; border: 1px solid #e5e7eb;
      border-radius: .5rem; font-size: .875rem; outline: none; box-sizing: border-box;
    }
    .fm-input:focus { border-color: #2e7736; }
    .fm-input--flex { flex: 1; }
    .fm-select {
      width: 100%; padding: .5rem .75rem; border: 1px solid #e5e7eb;
      border-radius: .5rem; font-size: .875rem; outline: none; background: #fff;
    }
    .fm-select:focus { border-color: #2e7736; }
    .fm-row { display: flex; gap: .75rem; align-items: flex-end; }
    .fm-row--2 > * { flex: 1; }
    .amount-wrap { display: flex; align-items: center; gap: .25rem; border: 1px solid #e5e7eb; border-radius: .5rem; padding: .5rem .75rem; }
    .amount-wrap:focus-within { border-color: #2e7736; }
    .currency-prefix { font-size: .8rem; color: #9ca3af; white-space: nowrap; }
    .amount-wrap .fm-input { border: none; padding: 0; width: 100%; }
    .amount-wrap .fm-input:focus { border-color: transparent; }

    /* Icon picker */
    .fm-icon-pick { display: flex; flex-wrap: wrap; gap: .3rem; flex-shrink: 0; }
    .icon-btn {
      width: 32px; height: 32px; border-radius: .375rem; border: 2px solid transparent;
      background: #f9fafb; cursor: pointer; font-size: 1rem;
      display: flex; align-items: center; justify-content: center;
    }
    .icon-btn--sel { border-color: #2e7736; background: #f0fdf4; }

    /* Type grid */
    .type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
    .type-opt {
      display: flex; flex-direction: column; gap: .15rem; padding: .75rem;
      border: 2px solid #e5e7eb; border-radius: .625rem; cursor: pointer;
      background: #fff; text-align: left; transition: border-color .15s, background .15s;
    }
    .type-opt:hover { border-color: #9ca3af; }
    .type-opt--sel { border-color: #2e7736; background: #f0fdf4; }
    .type-opt__icon { font-size: 1.3rem; }
    .type-opt__label { font-size: .8rem; font-weight: 700; color: #111827; }
    .type-opt__desc { font-size: .7rem; color: #9ca3af; }

    /* Chart style grid */
    .chart-style-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: .4rem; }
    .cs-opt {
      display: flex; flex-direction: column; align-items: center; gap: .3rem;
      padding: .5rem .3rem; border: 2px solid #e5e7eb; border-radius: .5rem;
      cursor: pointer; background: #fff; transition: border-color .15s;
    }
    .cs-opt:hover { border-color: #9ca3af; }
    .cs-opt--sel { border-color: #2e7736; background: #f0fdf4; }
    .cs-preview { display: flex; align-items: center; justify-content: center; height: 40px; }
    .cs-name { font-size: .65rem; color: #6b7280; font-weight: 600; text-align: center; }

    /* Color picker */
    .color-row { display: flex; gap: .5rem; flex-wrap: wrap; }
    .color-dot {
      width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid transparent; cursor: pointer;
      transition: transform .15s;
    }
    .color-dot:hover { transform: scale(1.15); }
    .color-dot--sel { border-color: #111827; box-shadow: 0 0 0 2px #fff inset; }

    /* Form buttons */
    .fm-btn {
      padding: .55rem 1.25rem; border: none; border-radius: .5rem;
      font-size: .875rem; font-weight: 600; cursor: pointer;
    }
    .fm-btn--cancel { background: #f3f4f6; color: #374151; }
    .fm-btn--cancel:hover { background: #e5e7eb; }
    .fm-btn--save { background: #2e7736; color: #fff; }
    .fm-btn--save:hover { background: #236029; }
    .fm-btn--save:disabled { opacity: .6; cursor: default; }
  `]
})
export class GoalsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  // ── Data ────────────────────────────────────────────────────────────────
  goals      = signal<any[]>([]);
  categories = signal<any[]>([]);
  accounts   = signal<any[]>([]);
  loading    = signal(true);

  // ── Form state ──────────────────────────────────────────────────────────
  showForm    = signal(false);
  editingId   = signal('');
  savingGoal  = signal(false);

  form: any = this.emptyForm();

  // ── Options ─────────────────────────────────────────────────────────────
  typeOpts = [
    { value: 'saving',    icon: '💰', label: 'Economia',   desc: 'Poupar X reais' },
    { value: 'category',  icon: '🏷️', label: 'Categoria',  desc: 'Limite de gasto' },
    { value: 'patrimony', icon: '📈', label: 'Patrimônio', desc: 'Crescer patrimônio' },
    { value: 'debt',      icon: '💳', label: 'Dívida',     desc: 'Quitar dívidas' },
  ];

  chartStyleOpts = [
    { value: 'ring',         label: 'Anel' },
    { value: 'bar',          label: 'Barras' },
    { value: 'thermometer',  label: 'Termôm.' },
    { value: 'line',         label: 'Linha' },
    { value: 'gauge',        label: 'Velocím.' },
  ];

  iconOpts = ['🎯','💰','🏠','🚗','✈️','🎓','💊','🛒','📱','💎','🏖️','🐾'];

  colorOpts = [
    '#2e7736','#2563eb','#7c3aed','#dc2626',
    '#d97706','#0891b2','#be185d','#374151',
  ];

  // ── Geometry constants exposed to template ───────────────────────────────
  readonly gaugeC = GAUGE_C;

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    forkJoin({
      goals: this.api.get<any>('/goals').pipe(catchError(() => of({ data: [] }))),
      cats:  this.api.get<any>('/categories').pipe(catchError(() => of({ data: [] }))),
      accs:  this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] }))),
    }).subscribe(res => {
      this.goals.set(res.goals.data ?? []);
      this.categories.set((res.cats.data ?? []).filter((c: any) => c.type === 'expense'));
      this.accounts.set(res.accs.data ?? []);
      this.loading.set(false);
    });
  }

  // ── Form helpers ─────────────────────────────────────────────────────────
  emptyForm() {
    return {
      name: '', type: 'saving', target_amount: null, target_date: '',
      category_id: '', account_id: '', chart_style: 'ring',
      color: '#2e7736', icon: '🎯',
    };
  }

  openForm(goal?: any) {
    if (goal) {
      this.editingId.set(goal.id);
      this.form = {
        name: goal.name, type: goal.type,
        target_amount: goal.target_amount, target_date: goal.target_date ?? '',
        category_id: goal.category_id ?? '', account_id: goal.account_id ?? '',
        chart_style: goal.chart_style, color: goal.color, icon: goal.icon,
      };
    } else {
      this.editingId.set('');
      this.form = this.emptyForm();
    }
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  onTypeChange() {
    this.form.category_id = '';
    this.form.account_id  = '';
  }

  saveGoal() {
    if (!this.form.name || !this.form.target_amount) {
      this.toast.error('Preencha nome e meta');
      return;
    }
    this.savingGoal.set(true);
    const payload = {
      ...this.form,
      target_amount:  parseFloat(String(this.form.target_amount).replace(',', '.')),
      target_date:    this.form.target_date || null,
      category_id:    this.form.category_id || null,
      account_id:     this.form.account_id  || null,
    };
    const req = this.editingId()
      ? this.api.put<any>(`/goals/${this.editingId()}`, payload)
      : this.api.post<any>('/goals', payload);

    req.subscribe({
      next: saved => {
        if (this.editingId()) {
          this.goals.update(gs => gs.map(g => g.id === saved.id ? saved : g));
          this.toast.success('Objetivo atualizado!');
        } else {
          this.goals.update(gs => [...gs, saved]);
          this.toast.success('Objetivo criado!');
        }
        this.savingGoal.set(false);
        this.closeForm();
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar');
        this.savingGoal.set(false);
      }
    });
  }

  deleteGoal(id: string) {
    if (!confirm('Excluir este objetivo?')) return;
    this.api.delete<any>(`/goals/${id}`).subscribe(() => {
      this.goals.update(gs => gs.filter(g => g.id !== id));
      this.toast.success('Objetivo excluído');
    });
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  typeLabel(type: string): string {
    return this.typeOpts.find(t => t.value === type)?.label ?? type;
  }

  currentLabel(g: any): string {
    if (g.type === 'category')  return 'Gasto atual';
    if (g.type === 'debt')      return 'Pago até agora';
    if (g.type === 'patrimony') return 'Patrimônio atual';
    return 'Economizado';
  }

  daysLeft(g: any): number {
    if (!g.target_date) return 0;
    const ms = new Date(g.target_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  progressColor(g: any): string {
    const pct = g.progress_pct ?? 0;
    // Category = spending limit: warn as it approaches target
    if (g.type === 'category') {
      if (pct >= 90) return '#dc2626';
      if (pct >= 70) return '#f59e0b';
      return g.color || '#2e7736';
    }
    // Accumulation goal: celebrate progress
    if (pct >= 90) return '#16a34a';
    if (pct >= 50) return g.color || '#2e7736';
    if (pct >= 25) return '#f59e0b';
    return '#dc2626';
  }

  monthShort(month: string): string {
    const [y, m] = month.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  }

  // ── Ring chart ────────────────────────────────────────────────────────────
  ringDash(g: any): string {
    const filled = (Math.min(g.progress_pct, 100) / 100) * RING_C;
    return `${filled.toFixed(2)} ${RING_C}`;
  }

  // ── Bar chart ─────────────────────────────────────────────────────────────
  private barMax(g: any): number {
    const amounts = (g.monthly_data ?? []).map((d: any) => d.amount);
    return Math.max(...amounts, g.target_amount * 1.05, 1);
  }

  barH(amount: number, g: any): number {
    return Math.max(2, Math.round((amount / this.barMax(g)) * 100));
  }

  targetLineY(g: any): number {
    return Math.max(4, Math.round(115 - (g.target_amount / this.barMax(g)) * 100));
  }

  // ── Thermometer ────────────────────────────────────────────────────────────
  thermoY(g: any): number {
    const pct = Math.min(g.progress_pct, 100);
    // tube: y=18 (top) to y=138 (bottom), height=120
    return Math.round(18 + 120 * (1 - pct / 100));
  }

  // ── Line chart ─────────────────────────────────────────────────────────────
  private lineCoords(g: any): { x: number; y: number }[] {
    const data: any[] = g.monthly_data ?? [];
    if (!data.length) return [];
    const maxA = this.barMax(g);
    // viewBox 280x140, usable: x=20..270, y=20..115
    return data.map((d, i) => ({
      x: this.lineX(i, g),
      y: Math.round(115 - Math.max(0, Math.min(d.amount, maxA)) / maxA * 90),
    }));
  }

  lineX(i: number, g: any): number {
    const n = (g.monthly_data ?? []).length || 1;
    return Math.round(20 + (i / Math.max(n - 1, 1)) * 245);
  }

  linePoints(g: any): string {
    return this.lineCoords(g).map(p => `${p.x},${p.y}`).join(' ');
  }

  lineAreaPoints(g: any): string {
    const coords = this.lineCoords(g);
    if (!coords.length) return '';
    const last = coords[coords.length - 1];
    const first = coords[0];
    return coords.map(p => `${p.x},${p.y}`).join(' ') + ` ${last.x},115 ${first.x},115`;
  }

  lineDataPoints(g: any): { x: number; y: number }[] {
    return this.lineCoords(g);
  }

  // ── Gauge chart ────────────────────────────────────────────────────────────
  gaugeDash(g: any): string {
    const filled = (Math.min(g.progress_pct, 100) / 100) * GAUGE_C;
    return `${filled.toFixed(2)} ${GAUGE_C}`;
  }

  gaugeNeedleX(g: any): number {
    // angle: 180° at 0%, 0° at 100% (left to right semi-circle)
    // cx=90, r=65 (shorter than GAUGE_R for the needle)
    const angle = Math.PI * (1 - Math.min(g.progress_pct, 100) / 100);
    return +(90 + 62 * Math.cos(angle)).toFixed(2);
  }

  gaugeNeedleY(g: any): number {
    const angle = Math.PI * (1 - Math.min(g.progress_pct, 100) / 100);
    return +(95 - 62 * Math.sin(angle)).toFixed(2);
  }
}
