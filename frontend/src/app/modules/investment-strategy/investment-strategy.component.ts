import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PlanService } from '../../core/services/plan.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

interface PortfolioClass { class_name: string; ideal_pct: number; }
interface Portfolio {
  id: string; name: string; icon: string; color: string;
  display_order: number; classes: PortfolioClass[];
}
interface MonthClass { class_name: string; current_value: number; allocation: number; }
interface MonthEntry {
  id?: string; portfolio_id: string; month: string;
  contribution: number; classes: MonthClass[]; prefilled?: boolean;
}
interface HistoryPoint {
  month: string; portfolio_id: string; contribution: number; total_value: number;
}
interface InvestmentAsset {
  id: string; class_name: string; sector: string; ticker: string; display_order: number;
}

interface ClassRow {
  class_name: string;
  ideal_pct: number;
  current_value: number;
  current_pct: number;
  allocation: number;
}

const CLASS_META: Record<string, { label: string; icon: string; color: string }> = {
  acoes:        { label: 'Ações',        icon: '📈', color: '#dc2626' },
  exterior:     { label: 'Exterior',     icon: '🌎', color: '#16a34a' },
  etfs:         { label: 'ETFs',         icon: '📊', color: '#2563eb' },
  fiis:         { label: 'FIIs',         icon: '🏢', color: '#7c3aed' },
  renda_fixa:   { label: 'Renda Fixa',   icon: '🏦', color: '#ea580c' },
  criptomoedas: { label: 'Criptomoedas', icon: '₿',  color: '#db2777' },
};
const CLASS_ORDER = ['acoes', 'exterior', 'etfs', 'fiis', 'renda_fixa', 'criptomoedas'];

const STOCK_SECTORS = [
  'Bancos', 'Energia e Petróleo', 'Metalurgia e Mineração', 'Bebidas', 'Seguros',
  'Saneamento', 'Telecomunicações', 'Tecnologia', 'Varejo', 'Saúde',
  'Infraestrutura', 'Roupas e Calçados', 'Educação', 'Papel e Celulose', 'Outros',
];
const FII_SECTORS = [
  'Shoppings', 'Galpão Logístico', 'Laje Corporativa', 'Papel', 'Híbridos',
  'Fiagros', 'Hedge', 'Residenciais', 'Outros',
];
function sectorsFor(className: string): string[] {
  if (className === 'acoes' || className === 'exterior') return STOCK_SECTORS;
  if (className === 'fiis') return FII_SECTORS;
  return ['Outros'];
}

const PORTFOLIO_ICONS = ['👤', '👦', '👧', '👶', '👨', '👩', '🎓', '🏠', '💼', '🐷'];
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

// Distributes a contribution across classes, prioritising underweight ones.
function computeAllocations(rows: { ideal_pct: number; current_value: number }[], contribution: number): number[] {
  if (contribution <= 0) return rows.map(() => 0);
  const totalCurrent = rows.reduce((s, r) => s + (+r.current_value || 0), 0);
  const totalFuture = totalCurrent + contribution;
  const diffs = rows.map(r => ((+r.ideal_pct || 0) / 100) * totalFuture - (+r.current_value || 0));
  const sumPositive = diffs.reduce((s, d) => s + Math.max(0, d), 0);

  if (sumPositive <= 0) return rows.map(r => contribution * ((+r.ideal_pct || 0) / 100));
  if (sumPositive <= contribution) {
    const remainder = contribution - sumPositive;
    return rows.map((r, i) => Math.max(0, diffs[i]) + remainder * ((+r.ideal_pct || 0) / 100));
  }
  return diffs.map(d => Math.max(0, d) * (contribution / sumPositive));
}

@Component({
  selector: 'app-investment-strategy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MoneyMaskDirective, ConfirmModalComponent],
  template: `
    @if (!plan.isPremium()) {
      <div class="upsell-card">
        <div class="upsell-icon">🔒</div>
        <h2>Recurso Premium</h2>
        <p>Monte carteiras separadas (você, filhos, etc.), defina a alocação ideal de cada uma e registre
           os aportes mês a mês para acompanhar a evolução ao longo do ano.</p>
        <a routerLink="/plan" class="btn btn--primary">Ver planos</a>
      </div>
    } @else {

    <div class="page-header">
      <h1>Estratégia de Investimentos</h1>
    </div>

    <div class="tabs">
      <button class="tab" [class.tab--active]="tab() === 'rebalance'" (click)="tab.set('rebalance')">⚖️ Rebalanceamento</button>
      <button class="tab" [class.tab--active]="tab() === 'history'" (click)="switchToHistory()">📅 Histórico</button>
      <button class="tab" [class.tab--active]="tab() === 'sectors'" (click)="tab.set('sectors')">🗂️ Setores</button>
      <button class="tab" [class.tab--active]="tab() === 'calc'" (click)="tab.set('calc')">🧮 Calculadora</button>
    </div>

    @if (loading()) {
      <div class="skel-wrap">
        @for (i of [1,2,3]; track i) { <div class="skel-block skel-row"></div> }
      </div>
    }

    <!-- ══ TAB: Rebalanceamento ═══════════════════════════════════════ -->
    @if (!loading() && tab() === 'rebalance') {

      <!-- Month navigation -->
      <div class="month-nav">
        <button class="nav-arrow" (click)="changeMonth(-1)" title="Mês anterior">‹</button>
        <span class="month-label">{{ monthLabel(month()) }}</span>
        <button class="nav-arrow" (click)="changeMonth(1)" title="Próximo mês">›</button>
        @if (entry()?.prefilled) {
          <span class="prefill-tag" title="Valores herdados do mês anterior. Salve para registrar este mês.">
            ⤵ herdado do mês anterior
          </span>
        }
      </div>

      <!-- Portfolio selector -->
      <div class="pf-tabs">
        @for (p of portfolios(); track p.id) {
          <button class="pf-tab" [class.pf-tab--active]="selectedId() === p.id"
                  [style.borderColor]="selectedId() === p.id ? p.color : 'transparent'"
                  (click)="selectPortfolio(p.id)">
            <span>{{ p.icon }} {{ p.name }}</span>
            @if (savedMonths().has(p.id)) { <span class="pf-check" title="Mês salvo">✓</span> }
          </button>
        }
        <button class="btn btn--ghost btn--sm pf-add" (click)="openPortfolioForm()">+ Nova carteira</button>
      </div>

      @if (portfolios().length === 0) {
        <div class="empty-card">
          <div class="empty-icon">💼</div>
          <h3>Nenhuma carteira cadastrada</h3>
          <p>Crie uma carteira para cada perfil de investimento — você, seus filhos, ou qualquer objetivo separado.</p>
          <button class="btn btn--primary" (click)="openPortfolioForm()">Criar primeira carteira</button>
        </div>
      } @else {
       @if (selected(); as pf) {

        <!-- Summary cards -->
        <div class="rb-top">
          <div class="scard">
            <span class="scard__l">Patrimônio de {{ pf.name }}</span>
            <span class="scard__v">{{ totalCurrent() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
          </div>
          <div class="scard scard--edit">
            <span class="scard__l">Aporte deste mês</span>
            <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="contribution"
                   name="contribution" class="input scard__input" />
          </div>
          <div class="scard">
            <span class="scard__l">Total após aporte</span>
            <span class="scard__v">{{ (totalCurrent() + contribution) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
          </div>
          <div class="scard scard--accent">
            <span class="scard__l">Consolidado (todas)</span>
            <span class="scard__v">{{ consolidatedTotal() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
            <span class="scard__sub">Aporte total: {{ consolidatedContribution() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel__head">
            <h3><span [style.color]="pf.color">{{ pf.icon }}</span> {{ pf.name }}</h3>
            <div class="panel__actions">
              <button class="icon-btn" (click)="openPortfolioForm(pf)" title="Editar carteira">✎</button>
              <button class="icon-btn icon-btn--danger" (click)="removePortfolio(pf)" title="Excluir carteira">🗑</button>
            </div>
          </div>

          <table class="rtable">
            <thead>
              <tr>
                <th class="left">Classe</th>
                <th>% Ideal</th>
                <th>Valor Atual</th>
                <th>% Atual</th>
                <th>Quanto Colocar</th>
              </tr>
            </thead>
            <tbody>
              @for (row of classRows(); track row.class_name) {
                <tr>
                  <td class="left">
                    <span class="class-chip" [style.background]="meta(row.class_name).color + '22'"
                          [style.color]="meta(row.class_name).color">
                      {{ meta(row.class_name).icon }} {{ meta(row.class_name).label }}
                    </span>
                  </td>
                  <td>
                    <input type="number" min="0" max="100" step="1" class="input input--pct"
                           [ngModel]="idealPct(row.class_name)"
                           (ngModelChange)="setIdealPct(row.class_name, $event)"
                           [name]="'ideal_' + row.class_name" />
                  </td>
                  <td>
                    <input type="text" inputmode="decimal" appMoneyMask class="input input--money"
                           [ngModel]="currentValue(row.class_name)"
                           (ngModelChange)="setCurrentValue(row.class_name, $event)"
                           [name]="'val_' + row.class_name" />
                  </td>
                  <td class="num">{{ row.current_pct | number:'1.0-1' }}%</td>
                  <td class="num alloc" [class.alloc--zero]="row.allocation <= 0">
                    {{ row.allocation | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td class="left"><strong>Total</strong></td>
                <td [class.warn]="idealPctTotal() !== 100"><strong>{{ idealPctTotal() }}%</strong></td>
                <td><strong>{{ totalCurrent() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></td>
                <td class="num"><strong>100%</strong></td>
                <td class="num"><strong>{{ contribution | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></td>
              </tr>
            </tfoot>
          </table>

          @if (idealPctTotal() !== 100) {
            <p class="warn-msg">⚠️ A soma dos percentuais ideais está em {{ idealPctTotal() }}%, deveria ser 100%.</p>
          }
          <div class="rb-actions">
            <button class="btn btn--primary" (click)="saveMonth()" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : 'Salvar ' + monthLabel(month()) }}
            </button>
          </div>
        </div>
       }
      }
    }

    <!-- ══ TAB: Histórico ═══════════════════════════════════════════════ -->
    @if (!loading() && tab() === 'history') {
      @if (history().length === 0) {
        <div class="empty-card">
          <div class="empty-icon">📅</div>
          <h3>Nenhum mês registrado ainda</h3>
          <p>Salve um mês na aba Rebalanceamento para começar a construir seu histórico.</p>
        </div>
      } @else {

        <!-- Consolidated summary -->
        <div class="rb-top">
          <div class="scard scard--accent">
            <span class="scard__l">Patrimônio total (último mês)</span>
            <span class="scard__v">{{ lastMonthTotal() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
          </div>
          <div class="scard">
            <span class="scard__l">Aportado no ano</span>
            <span class="scard__v">{{ yearContribution() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
          </div>
          <div class="scard">
            <span class="scard__l">Meses registrados</span>
            <span class="scard__v">{{ historyMonths().length }}</span>
          </div>
        </div>

        <!-- Evolution chart -->
        <div class="panel">
          <h3>📈 Evolução do patrimônio</h3>
          <div class="chart-legend">
            @for (p of portfolios(); track p.id) {
              <span class="legend-item"><i class="legend-dot" [style.background]="p.color"></i>{{ p.icon }} {{ p.name }}</span>
            }
            <span class="legend-item"><i class="legend-dot legend-dot--bar"></i>Aporte total</span>
          </div>
          <svg class="chart" [attr.viewBox]="'0 0 ' + CH_W + ' ' + CH_H" preserveAspectRatio="none">
            <!-- grid -->
            @for (g of gridLines(); track g.y) {
              <line [attr.x1]="CH_PAD_L" [attr.y1]="g.y" [attr.x2]="CH_W - CH_PAD_R" [attr.y2]="g.y"
                    stroke="currentColor" stroke-opacity=".12" stroke-width="1"/>
              <text [attr.x]="CH_PAD_L - 6" [attr.y]="g.y + 3" text-anchor="end" class="axis-txt">{{ g.label }}</text>
            }
            <!-- contribution bars -->
            @for (b of contributionBars(); track b.month) {
              <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h"
                    fill="currentColor" fill-opacity=".14" rx="2"/>
            }
            <!-- one line per portfolio -->
            @for (s of chartSeries(); track s.portfolio_id) {
              <polyline [attr.points]="s.points" fill="none" [attr.stroke]="s.color" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>
              @for (pt of s.dots; track pt.x) {
                <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" [attr.fill]="s.color"/>
              }
            }
            <!-- x labels -->
            @for (l of xLabels(); track l.x) {
              <text [attr.x]="l.x" [attr.y]="CH_H - 6" text-anchor="middle" class="axis-txt">{{ l.label }}</text>
            }
          </svg>
        </div>

        <!-- History table -->
        <div class="panel">
          <div class="panel__head">
            <h3>📋 Histórico mensal</h3>
            <select [(ngModel)]="historyFilter" name="hfilter" class="input input--sm">
              <option value="">Todas as carteiras</option>
              @for (p of portfolios(); track p.id) {
                <option [value]="p.id">{{ p.icon }} {{ p.name }}</option>
              }
            </select>
          </div>
          <table class="rtable">
            <thead>
              <tr>
                <th class="left">Mês</th>
                <th class="left">Carteira</th>
                <th>Aporte</th>
                <th>Patrimônio</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredHistory(); track r.month + r.portfolio_id) {
                <tr>
                  <td class="left">{{ monthLabel(r.month) }}</td>
                  <td class="left">
                    <span class="class-chip" [style.background]="portfolioColor(r.portfolio_id) + '22'"
                          [style.color]="portfolioColor(r.portfolio_id)">
                      {{ portfolioIcon(r.portfolio_id) }} {{ portfolioName(r.portfolio_id) }}
                    </span>
                  </td>
                  <td class="num alloc">{{ r.contribution | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
                  <td class="num"><strong>{{ r.total_value | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td class="left" colspan="2"><strong>Total aportado</strong></td>
                <td class="num"><strong>{{ filteredContributionTotal() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      }
    }

    <!-- ══ TAB: Setores ═══════════════════════════════════════════════ -->
    @if (!loading() && tab() === 'sectors') {
      <div class="sec-tabs">
        @for (cn of classOrder; track cn) {
          <button class="sec-tab" [class.sec-tab--active]="sectorClass() === cn"
                  [style.borderColor]="sectorClass() === cn ? meta(cn).color : 'transparent'"
                  (click)="sectorClass.set(cn)">
            {{ meta(cn).icon }} {{ meta(cn).label }}
          </button>
        }
        <button class="btn btn--primary btn--sm sec-add" (click)="openAssetForm()">+ Novo ativo</button>
      </div>

      <div class="sec-grid">
        @for (grp of groupedAssets(); track grp.sector) {
          <div class="sec-card">
            <div class="sec-card__head">{{ grp.sector }}</div>
            <div class="sec-card__body">
              @for (a of grp.assets; track a.id) {
                <div class="asset-chip">
                  <span>{{ a.ticker }}</span>
                  <button class="chip-edit" (click)="openAssetForm(a)">✎</button>
                  <button class="chip-del" (click)="removeAsset(a)">×</button>
                </div>
              }
            </div>
          </div>
        }
        @if (groupedAssets().length === 0) {
          <div class="sec-empty">Nenhum ativo cadastrado em {{ meta(sectorClass()).label }} ainda.</div>
        }
      </div>
    }

    <!-- ══ TAB: Calculadora ═════════════════════════════════════════════ -->
    @if (!loading() && tab() === 'calc') {
      <div class="panel calc-panel">
        <h3>🧮 Calculadora Preço / Lucro</h3>
        <div class="calc-row">
          <div class="fg">
            <label>Preço</label>
            <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="calcPrice" name="calcPrice" class="input" />
          </div>
          <div class="fg">
            <label>Lucro</label>
            <input type="text" inputmode="decimal" appMoneyMask [(ngModel)]="calcProfit" name="calcProfit" class="input" />
          </div>
        </div>
        @if (calcProfit > 0) {
          <div class="calc-results">
            <div class="calc-item">
              <span class="calc-label">Relação Preço/Lucro</span>
              <span class="calc-val">{{ (calcPrice / calcProfit) | number:'1.2-4' }}</span>
            </div>
            <div class="calc-item">
              <span class="calc-label">Rendimento (Lucro/Preço)</span>
              <span class="calc-val calc-val--good">{{ calcPrice > 0 ? ((calcProfit / calcPrice) * 100 | number:'1.2-2') : '0' }}%</span>
            </div>
          </div>
        } @else {
          <p class="sim-hint">Informe preço e lucro para calcular.</p>
        }
      </div>
    }
    }

    <!-- ── Modal: carteira ──────────────────────────────────────────── -->
    @if (showPortfolioForm()) {
      <div class="overlay" (click)="closePortfolioForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingPortfolio() ? 'Editar Carteira' : 'Nova Carteira' }}</h2>
          <form (ngSubmit)="savePortfolio()" class="mform">
            <div class="fg">
              <label>Nome *</label>
              <input [(ngModel)]="pfForm.name" name="pfname" required class="input" placeholder="Ex: Daniel, Filho 1" />
            </div>
            <div class="fg">
              <label>Ícone</label>
              <div class="icon-grid">
                @for (ic of portfolioIcons; track ic) {
                  <button type="button" [class.selected]="pfForm.icon === ic" (click)="pfForm.icon = ic">{{ ic }}</button>
                }
              </div>
            </div>
            <div class="fg">
              <label>Cor</label>
              <input type="color" [(ngModel)]="pfForm.color" name="pfcolor" class="input input--color" />
            </div>
            <div class="mform-actions">
              <button type="button" class="btn btn--ghost" (click)="closePortfolioForm()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="savingPortfolio()">
                {{ savingPortfolio() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- ── Modal: ativo ─────────────────────────────────────────────── -->
    @if (showAssetForm()) {
      <div class="overlay" (click)="closeAssetForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingAsset() ? 'Editar Ativo' : 'Novo Ativo' }}</h2>
          <form (ngSubmit)="saveAsset()" class="mform">
            <div class="fg">
              <label>Classe</label>
              <select [(ngModel)]="assetForm.class_name" name="class_name" class="input" (ngModelChange)="onAssetClassChange()">
                @for (cn of classOrder; track cn) {
                  <option [value]="cn">{{ meta(cn).icon }} {{ meta(cn).label }}</option>
                }
              </select>
            </div>
            <div class="fg">
              <label>Setor</label>
              <input [(ngModel)]="assetForm.sector" name="sector" list="sector-options" class="input" placeholder="Ex: Bancos" />
              <datalist id="sector-options">
                @for (s of sectorsFor(assetForm.class_name); track s) { <option [value]="s"></option> }
              </datalist>
            </div>
            <div class="fg">
              <label>Ticker / Nome *</label>
              <input [(ngModel)]="assetForm.ticker" name="ticker" required class="input" placeholder="Ex: ITSA3" />
            </div>
            <div class="mform-actions">
              <button type="button" class="btn btn--ghost" (click)="closeAssetForm()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="savingAsset()">
                {{ savingAsset() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <app-confirm-modal
      [visible]="!!confirmItem()"
      [message]="confirmItem() ? confirmItem()!.msg : ''"
      (confirmed)="doDelete()"
      (cancelled)="confirmItem.set(null)">
    </app-confirm-modal>
  `,
  styles: [`
    .upsell-card {
      background: #fff; border-radius: .75rem; padding: 3rem 2rem; text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.07); max-width: 480px; margin: 2rem auto;
    }
    .upsell-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .upsell-card h2 { margin: 0 0 .5rem; font-size: 1.2rem; color: #111; }
    .upsell-card p { color: #6b7280; font-size: .9rem; line-height: 1.5; margin-bottom: 1.5rem; }
    .upsell-card .btn--primary { display: inline-block; text-decoration: none; padding: .55rem 1.2rem; border-radius: .375rem; background: #2e7736; color: #fff; font-weight: 600; font-size: .85rem; }

    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .page-header h1 { font-size: 1.375rem; font-weight: 700; color: #111; margin: 0; }

    .tabs { display: flex; gap: .5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    .tab { background: none; border: none; border-bottom: 2px solid transparent; padding: .6rem .9rem; font-size: .85rem; font-weight: 600; color: #6b7280; cursor: pointer; }
    .tab--active { color: #2e7736; border-color: #2e7736; }

    .skel-wrap { display: flex; flex-direction: column; gap: .5rem; }
    .skel-block { background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: .375rem; }
    .skel-row { height: 48px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Month nav */
    .month-nav { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .nav-arrow { width: 30px; height: 30px; border-radius: .375rem; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; font-size: 1.1rem; line-height: 1; color: #374151; }
    .nav-arrow:hover { border-color: #2e7736; color: #2e7736; }
    .month-label { font-size: 1rem; font-weight: 700; color: #111; min-width: 150px; text-align: center; }
    .prefill-tag { font-size: .72rem; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: .2rem .55rem; border-radius: 9999px; }

    /* Portfolio tabs */
    .pf-tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: center; }
    .pf-tab { display: flex; align-items: center; gap: .35rem; background: #fff; border: 2px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.07); border-radius: 9999px; padding: .4rem .9rem; font-size: .82rem; font-weight: 600; color: #374151; cursor: pointer; }
    .pf-tab--active { font-weight: 700; }
    .pf-check { color: #16a34a; font-size: .8rem; }
    .pf-add { margin-left: auto; }

    .empty-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 3rem 2rem; text-align: center; }
    .empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .empty-card h3 { margin: 0 0 .5rem; font-size: 1.05rem; color: #111; }
    .empty-card p { color: #6b7280; font-size: .88rem; line-height: 1.5; margin: 0 auto 1.25rem; max-width: 420px; }

    /* Summary cards */
    .rb-top { display: flex; gap: .875rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .scard { background: #fff; border-radius: .5rem; padding: .875rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); min-width: 160px; display: flex; flex-direction: column; gap: .35rem; flex: 1; }
    .scard--accent { border: 1px solid #bbf7d0; background: #f0fdf4; }
    .scard__l { font-size: .7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; }
    .scard__v { font-size: 1.1rem; font-weight: 700; color: #111; }
    .scard__sub { font-size: .72rem; color: #6b7280; }
    .scard__input { font-size: 1rem; font-weight: 700; }

    .panel { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
    .panel h3 { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; color: #111; }
    .panel__head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .panel__head h3 { margin: 0; }
    .panel__actions { display: flex; gap: .4rem; }
    .icon-btn { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: .375rem; width: 30px; height: 30px; cursor: pointer; font-size: .85rem; color: #6b7280; }
    .icon-btn:hover { border-color: #2e7736; color: #2e7736; }
    .icon-btn--danger:hover { border-color: #dc2626; color: #dc2626; }

    /* Table */
    .rtable { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .rtable th { background: #f9fafb; padding: .55rem .75rem; text-align: center; color: #6b7280; font-size: .72rem; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
    .rtable th.left, .rtable td.left { text-align: left; }
    .rtable td { padding: .5rem .75rem; border-top: 1px solid #f3f4f6; text-align: center; }
    .rtable td.num { text-align: right; }
    .rtable tfoot td { border-top: 2px solid #e5e7eb; padding-top: .65rem; }
    .rtable tfoot td.warn { color: #dc2626; }
    .class-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .25rem .6rem; border-radius: 9999px; font-size: .78rem; font-weight: 700; white-space: nowrap; }
    .input--pct { width: 64px; text-align: center; }
    .input--money { width: 110px; text-align: right; }
    .input--sm { max-width: 200px; font-size: .82rem; }
    .input--color { width: 60px; height: 34px; padding: .15rem; }
    .alloc { font-weight: 700; color: #16a34a; }
    .alloc--zero { color: #9ca3af; font-weight: 500; }
    .warn-msg { color: #dc2626; font-size: .8rem; margin: .75rem 0 0; }
    .rb-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }

    /* Chart */
    .chart { width: 100%; height: 260px; color: #6b7280; display: block; }
    .axis-txt { font-size: 9px; fill: currentColor; opacity: .75; }
    .chart-legend { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .legend-item { display: inline-flex; align-items: center; gap: .35rem; font-size: .75rem; color: #6b7280; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .legend-dot--bar { background: #d1d5db; border-radius: 2px; }

    /* Sectors */
    .sec-tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: center; }
    .sec-tab { background: #fff; border: 2px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.07); border-radius: 9999px; padding: .4rem .9rem; font-size: .8rem; font-weight: 600; color: #374151; cursor: pointer; }
    .sec-tab--active { font-weight: 700; }
    .sec-add { margin-left: auto; }
    .sec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .sec-card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); overflow: hidden; }
    .sec-card__head { background: #f9fafb; padding: .5rem .875rem; font-size: .78rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .03em; border-bottom: 1px solid #f3f4f6; }
    .sec-card__body { padding: .75rem .875rem; display: flex; flex-direction: column; gap: .4rem; }
    .asset-chip { display: flex; align-items: center; gap: .4rem; background: #f9fafb; border-radius: .375rem; padding: .35rem .6rem; font-size: .82rem; font-weight: 600; color: #111; }
    .asset-chip span { flex: 1; }
    .chip-edit, .chip-del { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: .85rem; padding: 0 .15rem; }
    .chip-edit:hover { color: #2e7736; }
    .chip-del:hover { color: #dc2626; }
    .sec-empty { color: #9ca3af; font-size: .85rem; padding: 2rem; text-align: center; grid-column: 1 / -1; }

    /* Calc */
    .calc-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .fg { display: flex; flex-direction: column; gap: .25rem; flex: 1; min-width: 160px; }
    .fg label { font-size: .8rem; font-weight: 500; color: #374151; }
    .calc-results { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .calc-item { background: #f9fafb; border-radius: .375rem; padding: .875rem; display: flex; flex-direction: column; gap: .2rem; }
    .calc-label { font-size: .7rem; color: #6b7280; text-transform: uppercase; }
    .calc-val { font-size: 1.3rem; font-weight: 700; color: #111; }
    .calc-val--good { color: #16a34a; }
    .sim-hint { color: #9ca3af; font-size: .875rem; margin: 0; }

    /* Buttons / inputs */
    .btn { padding: .4rem .875rem; border-radius: .375rem; border: none; cursor: pointer; font-size: .82rem; font-weight: 500; transition: opacity .15s; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn--primary { background: #2e7736; color: #fff; }
    .btn--ghost { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .btn--sm { padding: .25rem .65rem; font-size: .78rem; }
    .input { padding: .45rem .7rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; box-sizing: border-box; }

    /* Modal */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal { background: #fff; border-radius: .5rem; padding: 1.5rem; width: 90%; max-width: 420px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal h2 { margin: 0 0 1.25rem; font-size: 1.125rem; }
    .mform { display: flex; flex-direction: column; gap: .875rem; }
    .mform-actions { display: flex; justify-content: flex-end; gap: .75rem; padding-top: .5rem; border-top: 1px solid #f3f4f6; }
    .icon-grid { display: flex; flex-wrap: wrap; gap: .35rem; }
    .icon-grid button { width: 36px; height: 36px; border-radius: .375rem; border: 2px solid #e5e7eb; background: #fff; font-size: 1.1rem; cursor: pointer; }
    .icon-grid button.selected { border-color: #2e7736; background: #f0fdf4; }

    @media (max-width: 640px) {
      .rb-top { flex-direction: column; }
      .rtable { font-size: .75rem; }
      .sec-add, .pf-add { margin-left: 0; width: 100%; }
    }

    /* ══ DARK THEME ════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .upsell-card,
    :host-context([data-theme="dark"]) .scard,
    :host-context([data-theme="dark"]) .panel,
    :host-context([data-theme="dark"]) .sec-tab,
    :host-context([data-theme="dark"]) .pf-tab,
    :host-context([data-theme="dark"]) .empty-card,
    :host-context([data-theme="dark"]) .sec-card { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .scard--accent { background: rgba(74,222,128,.08) !important; border-color: #2e7736 !important; }
    :host-context([data-theme="dark"]) .upsell-card h2,
    :host-context([data-theme="dark"]) .page-header h1,
    :host-context([data-theme="dark"]) .panel h3,
    :host-context([data-theme="dark"]) .empty-card h3,
    :host-context([data-theme="dark"]) .month-label,
    :host-context([data-theme="dark"]) .scard__v,
    :host-context([data-theme="dark"]) .class-chip,
    :host-context([data-theme="dark"]) .calc-val,
    :host-context([data-theme="dark"]) .asset-chip { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .scard__l,
    :host-context([data-theme="dark"]) .scard__sub,
    :host-context([data-theme="dark"]) .calc-label,
    :host-context([data-theme="dark"]) .sim-hint,
    :host-context([data-theme="dark"]) .legend-item,
    :host-context([data-theme="dark"]) .empty-card p,
    :host-context([data-theme="dark"]) .fg label { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .tabs { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .tab { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .tab--active { color: #4ade80 !important; border-color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .nav-arrow { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .prefill-tag { background: rgba(245,158,11,.12) !important; border-color: rgba(245,158,11,.35) !important; color: #fbbf24 !important; }
    :host-context([data-theme="dark"]) .pf-tab { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .pf-tab--active { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .rtable th { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .rtable td { border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .rtable tfoot td { border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .alloc { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .alloc--zero { color: #4f5f76 !important; }
    :host-context([data-theme="dark"]) .chart { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .sec-tab { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .sec-tab--active { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sec-card__head { background: #1e2638 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .asset-chip,
    :host-context([data-theme="dark"]) .calc-item,
    :host-context([data-theme="dark"]) .icon-btn { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .icon-btn { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .calc-val--good { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .btn--ghost { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .input,
    :host-context([data-theme="dark"]) select { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .modal { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .modal h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .mform-actions { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .icon-grid button { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .icon-grid button.selected { border-color: #4ade80 !important; background: rgba(74,222,128,.12) !important; }
    :host-context([data-theme="dark"]) .skel-block { background: linear-gradient(90deg,#1e2638 25%,#283248 50%,#1e2638 75%) !important; }
    :host-context([data-theme="dark"]) .sec-empty { color: #4f5f76 !important; }
  `]
})
export class InvestmentStrategyComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  plan = inject(PlanService);

  loading = signal(true);
  saving  = signal(false);
  tab     = signal<'rebalance' | 'history' | 'sectors' | 'calc'>('rebalance');

  classOrder = CLASS_ORDER;
  portfolioIcons = PORTFOLIO_ICONS;
  meta(cn: string) { return CLASS_META[cn] ?? { label: cn, icon: '•', color: '#6b7280' }; }
  sectorsFor = sectorsFor;
  monthLabel = monthLabel;

  // ── Portfolios & month state ─────────────────────────────────────────
  portfolios = signal<Portfolio[]>([]);
  selectedId = signal<string>('');
  month      = signal<string>(todayMonth());
  entry      = signal<MonthEntry | null>(null);
  contribution = 0;

  /** Month entries for every portfolio in the current month (for the consolidated card). */
  allEntries = signal<Record<string, MonthEntry>>({});
  /** Portfolio ids that already have this month saved. */
  savedMonths = computed(() => {
    const set = new Set<string>();
    for (const [pid, e] of Object.entries(this.allEntries())) {
      if (e && !e.prefilled) set.add(pid);
    }
    return set;
  });

  selected = computed(() => this.portfolios().find(p => p.id === this.selectedId()) ?? null);

  /** Local editable copy of ideal % / current values for the selected portfolio. */
  idealMap   = signal<Record<string, number>>({});
  currentMap = signal<Record<string, number>>({});

  idealPct(cn: string): number { return this.idealMap()[cn] ?? 0; }
  currentValue(cn: string): number { return this.currentMap()[cn] ?? 0; }
  setIdealPct(cn: string, v: any) { this.idealMap.set({ ...this.idealMap(), [cn]: +v || 0 }); }
  setCurrentValue(cn: string, v: any) { this.currentMap.set({ ...this.currentMap(), [cn]: +v || 0 }); }

  totalCurrent  = computed(() => CLASS_ORDER.reduce((s, cn) => s + (this.currentMap()[cn] || 0), 0));
  idealPctTotal = computed(() => Math.round(CLASS_ORDER.reduce((s, cn) => s + (this.idealMap()[cn] || 0), 0)));

  classRows = computed<ClassRow[]>(() => {
    const total = this.totalCurrent();
    const base = CLASS_ORDER.map(cn => ({
      class_name: cn,
      ideal_pct: this.idealMap()[cn] || 0,
      current_value: this.currentMap()[cn] || 0,
    }));
    const allocations = computeAllocations(base, +this.contribution || 0);
    return base.map((r, i) => ({
      ...r,
      current_pct: total > 0 ? (r.current_value / total) * 100 : 0,
      allocation: allocations[i],
    }));
  });

  /** Consolidated patrimony across every portfolio for the current month. */
  consolidatedTotal = computed(() => {
    let sum = 0;
    for (const p of this.portfolios()) {
      if (p.id === this.selectedId()) { sum += this.totalCurrent(); continue; }
      const e = this.allEntries()[p.id];
      if (e) sum += e.classes.reduce((s, c) => s + (+c.current_value || 0), 0);
    }
    return sum;
  });
  consolidatedContribution = computed(() => {
    let sum = 0;
    for (const p of this.portfolios()) {
      if (p.id === this.selectedId()) { sum += +this.contribution || 0; continue; }
      const e = this.allEntries()[p.id];
      if (e) sum += +e.contribution || 0;
    }
    return sum;
  });

  // ── History ───────────────────────────────────────────────────────────
  history = signal<HistoryPoint[]>([]);
  historyFilter = '';

  historyMonths = computed(() => Array.from(new Set(this.history().map(h => h.month))).sort());

  filteredHistory = computed(() => {
    const f = this.historyFilter;
    const list = f ? this.history().filter(h => h.portfolio_id === f) : this.history();
    return [...list].sort((a, b) => b.month.localeCompare(a.month));
  });
  filteredContributionTotal = computed(() =>
    this.filteredHistory().reduce((s, h) => s + (+h.contribution || 0), 0));

  lastMonthTotal = computed(() => {
    const months = this.historyMonths();
    if (!months.length) return 0;
    const last = months[months.length - 1];
    return this.history().filter(h => h.month === last).reduce((s, h) => s + (+h.total_value || 0), 0);
  });
  yearContribution = computed(() => {
    const year = String(new Date().getFullYear());
    return this.history()
      .filter(h => h.month.startsWith(year))
      .reduce((s, h) => s + (+h.contribution || 0), 0);
  });

  // ── Chart geometry ────────────────────────────────────────────────────
  readonly CH_W = 700; readonly CH_H = 260;
  readonly CH_PAD_L = 52; readonly CH_PAD_R = 12;
  readonly CH_PAD_T = 12; readonly CH_PAD_B = 26;

  private chartMax = computed(() => {
    const vals = this.history().map(h => +h.total_value || 0);
    const max = Math.max(0, ...vals);
    return max > 0 ? max * 1.1 : 100;
  });

  private xFor(month: string): number {
    const months = this.historyMonths();
    const n = months.length;
    const i = months.indexOf(month);
    const usable = this.CH_W - this.CH_PAD_L - this.CH_PAD_R;
    if (n <= 1) return this.CH_PAD_L + usable / 2;
    return this.CH_PAD_L + (i / (n - 1)) * usable;
  }
  private yFor(value: number): number {
    const usable = this.CH_H - this.CH_PAD_T - this.CH_PAD_B;
    return this.CH_PAD_T + usable - (value / this.chartMax()) * usable;
  }

  gridLines = computed(() => {
    const max = this.chartMax();
    const out: { y: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      out.push({ y: this.yFor(v), label: this.compact(v) });
    }
    return out;
  });

  private compact(v: number): string {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  }

  chartSeries = computed(() => {
    const months = this.historyMonths();
    return this.portfolios().map(p => {
      const dots: { x: number; y: number }[] = [];
      for (const m of months) {
        const point = this.history().find(h => h.month === m && h.portfolio_id === p.id);
        if (point) dots.push({ x: this.xFor(m), y: this.yFor(+point.total_value || 0) });
      }
      return {
        portfolio_id: p.id,
        color: p.color,
        dots,
        points: dots.map(d => `${d.x},${d.y}`).join(' '),
      };
    }).filter(s => s.dots.length > 0);
  });

  contributionBars = computed(() => {
    const months = this.historyMonths();
    const usable = this.CH_W - this.CH_PAD_L - this.CH_PAD_R;
    const w = months.length > 0 ? Math.min(22, (usable / Math.max(months.length, 1)) * 0.5) : 10;
    const baseY = this.CH_H - this.CH_PAD_B;
    return months.map(m => {
      const total = this.history().filter(h => h.month === m)
        .reduce((s, h) => s + (+h.contribution || 0), 0);
      const y = this.yFor(total);
      return { month: m, x: this.xFor(m) - w / 2, y, w, h: Math.max(0, baseY - y) };
    });
  });

  xLabels = computed(() => {
    const months = this.historyMonths();
    const step = Math.ceil(months.length / 8) || 1;
    return months
      .filter((_, i) => i % step === 0)
      .map(m => ({ x: this.xFor(m), label: monthShort(m) }));
  });

  portfolioName(id: string)  { return this.portfolios().find(p => p.id === id)?.name ?? '—'; }
  portfolioIcon(id: string)  { return this.portfolios().find(p => p.id === id)?.icon ?? '•'; }
  portfolioColor(id: string) { return this.portfolios().find(p => p.id === id)?.color ?? '#6b7280'; }

  // ── Sectors state ─────────────────────────────────────────────────────
  sectorClass   = signal<string>('acoes');
  assets        = signal<InvestmentAsset[]>([]);
  showAssetForm = signal(false);
  savingAsset   = signal(false);
  editingAsset  = signal<InvestmentAsset | null>(null);
  assetForm: any = { class_name: 'acoes', sector: '', ticker: '' };

  groupedAssets = computed(() => {
    const cn = this.sectorClass();
    const list = this.assets().filter(a => a.class_name === cn);
    const bySector = new Map<string, InvestmentAsset[]>();
    for (const a of list) {
      const key = a.sector || 'Outros';
      if (!bySector.has(key)) bySector.set(key, []);
      bySector.get(key)!.push(a);
    }
    const order = sectorsFor(cn);
    const sectors = Array.from(bySector.keys()).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return sectors.map(sector => ({ sector, assets: bySector.get(sector)! }));
  });

  // ── Portfolio form ────────────────────────────────────────────────────
  showPortfolioForm = signal(false);
  savingPortfolio   = signal(false);
  editingPortfolio  = signal<Portfolio | null>(null);
  pfForm: any = { name: '', icon: '👤', color: '#2e7736' };

  // ── Calculator ────────────────────────────────────────────────────────
  calcPrice = 0;
  calcProfit = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnInit() {
    if (this.plan.loaded()) {
      if (this.plan.isPremium()) this.load();
      else this.loading.set(false);
    } else {
      this.api.get<any>('/plan').subscribe(r => {
        this.plan.plan.set(r.plan ?? 'free');
        this.plan.features.set(r.features ?? []);
        this.plan.loaded.set(true);
        if (this.plan.isPremium()) this.load();
        else this.loading.set(false);
      });
    }
  }

  load() {
    this.loading.set(true);
    this.api.get<any>('/investment-portfolios').subscribe({
      next: r => {
        const list: Portfolio[] = r.data ?? [];
        this.portfolios.set(list);
        if (list.length && !list.some(p => p.id === this.selectedId())) {
          this.selectedId.set(list[0].id);
        }
        this.api.get<any>('/investment-assets').subscribe(ar => this.assets.set(ar.data ?? []));
        this.loadHistory();
        if (list.length) this.loadMonthAll();
        else this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadHistory() {
    this.api.get<any>('/investment-history').subscribe(r => this.history.set(r.data ?? []));
  }

  /** Loads the current month for every portfolio; selected one populates the editable maps. */
  loadMonthAll() {
    const list = this.portfolios();
    if (!list.length) { this.loading.set(false); return; }

    let pending = list.length;
    const acc: Record<string, MonthEntry> = {};

    for (const p of list) {
      this.api.get<any>('/investment-months', { portfolio_id: p.id, month: this.month() }).subscribe({
        next: (e: MonthEntry) => {
          acc[p.id] = e;
          if (p.id === this.selectedId()) this.applyEntry(p, e);
          if (--pending === 0) { this.allEntries.set(acc); this.loading.set(false); }
        },
        error: () => {
          if (--pending === 0) { this.allEntries.set(acc); this.loading.set(false); }
        },
      });
    }
  }

  /** Fills the editable maps from a portfolio's target % and a month entry's values. */
  private applyEntry(p: Portfolio, e: MonthEntry) {
    this.entry.set(e);
    this.contribution = +e.contribution || 0;

    const ideal: Record<string, number> = {};
    for (const c of p.classes ?? []) ideal[c.class_name] = +c.ideal_pct || 0;
    this.idealMap.set(ideal);

    const current: Record<string, number> = {};
    for (const c of e.classes ?? []) current[c.class_name] = +c.current_value || 0;
    this.currentMap.set(current);
  }

  selectPortfolio(id: string) {
    this.selectedId.set(id);
    const p = this.portfolios().find(x => x.id === id);
    const e = this.allEntries()[id];
    if (p && e) this.applyEntry(p, e);
    else this.loadMonthAll();
  }

  changeMonth(delta: number) {
    this.month.set(shiftMonth(this.month(), delta));
    this.loading.set(true);
    this.loadMonthAll();
  }

  switchToHistory() {
    this.tab.set('history');
    this.loadHistory();
  }

  saveMonth() {
    const pf = this.selected();
    if (!pf) return;
    this.saving.set(true);

    const rows = this.classRows();
    const payload = {
      portfolio_id: pf.id,
      month: this.month(),
      contribution: +this.contribution || 0,
      classes: rows.map(r => ({
        class_name: r.class_name,
        current_value: r.current_value,
        allocation: r.allocation,
      })),
    };

    // Target allocation lives on the portfolio, so persist it too.
    const pfPayload = {
      name: pf.name, icon: pf.icon, color: pf.color, display_order: pf.display_order,
      classes: CLASS_ORDER.map(cn => ({ class_name: cn, ideal_pct: this.idealMap()[cn] || 0 })),
    };

    this.api.put<any>('/investment-months', payload).subscribe({
      next: () => {
        this.api.put<any>(`/investment-portfolios/${pf.id}`, pfPayload).subscribe({
          next: () => {
            this.toast.success(`${monthLabel(this.month())} salvo para ${pf.name}!`);
            this.saving.set(false);
            this.load();
          },
          error: () => { this.toast.error('Erro ao salvar a alocação alvo'); this.saving.set(false); },
        });
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar o mês');
        this.saving.set(false);
      },
    });
  }

  // ── Portfolio CRUD ────────────────────────────────────────────────────
  openPortfolioForm(p?: Portfolio) {
    if (p) {
      this.editingPortfolio.set(p);
      this.pfForm = { name: p.name, icon: p.icon, color: p.color };
    } else {
      this.editingPortfolio.set(null);
      this.pfForm = { name: '', icon: '👤', color: '#2e7736' };
    }
    this.showPortfolioForm.set(true);
  }
  closePortfolioForm() { this.showPortfolioForm.set(false); this.editingPortfolio.set(null); }

  savePortfolio() {
    if (!this.pfForm.name?.trim()) return;
    this.savingPortfolio.set(true);
    const editing = this.editingPortfolio();

    const classes = editing
      ? CLASS_ORDER.map(cn => ({ class_name: cn, ideal_pct: this.idealMap()[cn] || 0 }))
      : CLASS_ORDER.map(cn => ({ class_name: cn, ideal_pct: 0 }));

    const payload = {
      name: this.pfForm.name.trim(),
      icon: this.pfForm.icon,
      color: this.pfForm.color,
      display_order: editing ? editing.display_order : this.portfolios().length,
      classes,
    };

    const req = editing
      ? this.api.put<any>(`/investment-portfolios/${editing.id}`, payload)
      : this.api.post<any>('/investment-portfolios', payload);

    req.subscribe({
      next: (saved: Portfolio) => {
        this.toast.success('Carteira salva!');
        this.closePortfolioForm();
        this.savingPortfolio.set(false);
        if (!editing && saved?.id) this.selectedId.set(saved.id);
        this.load();
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar a carteira');
        this.savingPortfolio.set(false);
      },
    });
  }

  removePortfolio(p: Portfolio) {
    this.confirmItem.set({
      msg: `Excluir a carteira <strong>${p.name}</strong>? Todo o histórico mensal dela será perdido.`,
      action: () => {
        this.api.delete(`/investment-portfolios/${p.id}`).subscribe(() => {
          this.toast.success('Carteira excluída.');
          if (this.selectedId() === p.id) this.selectedId.set('');
          this.load();
        });
      },
    });
  }

  // ── Asset CRUD ────────────────────────────────────────────────────────
  openAssetForm(a?: InvestmentAsset) {
    if (a) {
      this.editingAsset.set(a);
      this.assetForm = { ...a };
    } else {
      this.editingAsset.set(null);
      this.assetForm = { class_name: this.sectorClass(), sector: '', ticker: '' };
    }
    this.showAssetForm.set(true);
  }
  closeAssetForm() { this.showAssetForm.set(false); this.editingAsset.set(null); }
  onAssetClassChange() { this.assetForm.sector = ''; }

  saveAsset() {
    if (!this.assetForm.ticker?.trim()) return;
    this.savingAsset.set(true);
    const payload = {
      class_name: this.assetForm.class_name,
      sector: this.assetForm.sector?.trim() || 'Outros',
      ticker: this.assetForm.ticker.trim(),
      display_order: 0,
    };
    const editing = this.editingAsset();
    const req = editing
      ? this.api.put<any>(`/investment-assets/${editing.id}`, payload)
      : this.api.post<any>('/investment-assets', payload);

    req.subscribe({
      next: () => {
        this.toast.success('Ativo salvo!');
        this.closeAssetForm();
        this.reloadAssets();
        this.savingAsset.set(false);
      },
      error: err => {
        this.toast.error(err.error?.error ?? 'Erro ao salvar');
        this.savingAsset.set(false);
      },
    });
  }

  reloadAssets() {
    this.api.get<any>('/investment-assets').subscribe(r => this.assets.set(r.data ?? []));
  }

  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  removeAsset(a: InvestmentAsset) {
    this.confirmItem.set({ msg: `Excluir o ativo <strong>${a.ticker}</strong>?`, action: () => {
      this.api.delete(`/investment-assets/${a.id}`).subscribe(() => {
        this.toast.success('Ativo excluído.');
        this.reloadAssets();
      });
    }});
  }

  doDelete() {
    const item = this.confirmItem();
    this.confirmItem.set(null);
    item?.action();
  }
}
