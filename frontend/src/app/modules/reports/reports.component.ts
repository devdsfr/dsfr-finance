import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type Tab  = 'categories' | 'flow' | 'accounts' | 'tags';
type Mode = 'donut' | 'line' | 'table';
type Gran = 'daily' | 'weekly' | 'monthly';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  template: `
<div class="rep">

  <!-- ── Header ── -->
  <div class="rep__head">
    <h1 class="rep__title">Relatórios</h1>
    <div class="month-nav">
      <button class="nav-btn" (click)="prevMonth()">‹</button>
      <span class="month-label">{{ monthLabel() }}</span>
      <button class="nav-btn" (click)="nextMonth()">›</button>
    </div>
  </div>

  <!-- ── Tabs ── -->
  <div class="tabs">
    <button class="tab" [class.active]="tab() === 'categories'" (click)="setTab('categories')">Categorias</button>
    <button class="tab" [class.active]="tab() === 'flow'"       (click)="setTab('flow')">Entradas x Saídas</button>
    <button class="tab" [class.active]="tab() === 'accounts'"   (click)="setTab('accounts')">Contas</button>
    <button class="tab" [class.active]="tab() === 'tags'"       (click)="setTab('tags')">Tags</button>
  </div>

  <!-- ═══════════ CATEGORIAS ═══════════ -->
  @if (tab() === 'categories') {
    <!-- toolbar -->
    <div class="toolbar">
      <div class="toolbar__left">
        <span class="toolbar__title">Categorias</span>
        <button class="btn-filter">⊞ Filtros</button>
      </div>
      <div class="toolbar__right">
        <button class="view-btn" [class.active]="mode() === 'donut'" (click)="mode.set('donut')" title="Gráfico de rosca">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>
        </button>
        <button class="view-btn" [class.active]="mode() === 'line'" (click)="mode.set('line')" title="Gráfico de linha">
          <svg width="16" height="16" viewBox="0 0 16 16"><polyline points="1,12 5,6 9,9 15,3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <button class="view-btn" [class.active]="mode() === 'table'" (click)="mode.set('table')" title="Tabela">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="3" rx="1" fill="currentColor"/><rect x="1" y="6" width="14" height="3" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="11" width="14" height="3" rx="1" fill="currentColor" opacity=".3"/></svg>
        </button>
        <button class="view-btn" title="Exportar PDF" (click)="exportPDF()">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 2h7l3 3v9H3V2z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v3h3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M5 10h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <p class="card-note">Gastos de cartão com base na <span class="underline">data da compra</span></p>

    <!-- ─ donut mode ─ -->
    @if (mode() === 'donut') {
      <!-- Despesas -->
      @if (expenseCats().length > 0 || loading()) {
        <div class="cat-section">
          <h3 class="section-title">Despesas</h3>
          <div class="cat-body">
            <div class="cat-list">
              @if (loading()) {
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="cat-row">
                    <div class="skel skel--icon"></div>
                    <div class="cat-info">
                      <span class="skel skel--text" style="width:100px"></span>
                      <span class="skel skel--text" style="width:40px;margin-top:3px"></span>
                    </div>
                    <span class="skel skel--text" style="width:70px"></span>
                  </div>
                }
              }
              @for (c of expenseCats(); track c.category_name) {
                <div class="cat-row">
                  <div class="cat-icon" [style.background]="c.color || '#6b7280'">
                    @if (c.icon) { <span>{{ c.icon }}</span> } @else { {{ (c.category_name || 'S')[0].toUpperCase() }} }
                  </div>
                  <div class="cat-info">
                    <span class="cat-name">{{ c.category_name || 'Sem categoria' }}</span>
                    <span class="cat-pct">{{ pct(c.total, totalExpense()) | number:'1.2-2' }}%</span>
                  </div>
                  <span class="cat-amount">{{ c.total | number:'1.2-2' }}</span>
                </div>
              }
              @if (!loading()) {
                <div class="cat-total-row">
                  <span>Total</span>
                  <span>{{ totalExpense() | number:'1.2-2' }}</span>
                </div>
              }
            </div>
            <!-- donut chart -->
            <div class="donut-wrap">
              <svg viewBox="0 0 100 100" class="donut-svg">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" stroke-width="14"/>
                @for (seg of expenseSegments(); track seg.category_name) {
                  <circle cx="50" cy="50" r="38" fill="none"
                          [attr.stroke]="seg.color || '#6b7280'"
                          stroke-width="14"
                          [attr.stroke-dasharray]="seg.dash + ' ' + C"
                          [attr.stroke-dashoffset]="seg.offset"
                          transform="rotate(-90 50 50)"/>
                }
              </svg>
            </div>
          </div>
        </div>
      }

      <!-- Receitas -->
      @if (incomeCats().length > 0 || loading()) {
        <div class="cat-section">
          <h3 class="section-title">Receitas</h3>
          <div class="cat-body">
            <div class="cat-list">
              @if (loading()) {
                @for (i of [1,2]; track i) {
                  <div class="cat-row">
                    <div class="skel skel--icon"></div>
                    <div class="cat-info">
                      <span class="skel skel--text" style="width:80px"></span>
                      <span class="skel skel--text" style="width:40px;margin-top:3px"></span>
                    </div>
                    <span class="skel skel--text" style="width:70px"></span>
                  </div>
                }
              }
              @for (c of incomeCats(); track c.category_name) {
                <div class="cat-row">
                  <div class="cat-icon cat-icon--income" [style.background]="c.color || '#16a34a'">
                    @if (c.icon) { <span>{{ c.icon }}</span> } @else { {{ (c.category_name || 'S')[0].toUpperCase() }} }
                  </div>
                  <div class="cat-info">
                    <span class="cat-name">{{ c.category_name || 'Sem categoria' }}</span>
                    <span class="cat-pct">{{ pct(c.total, totalIncome()) | number:'1.2-2' }}%</span>
                  </div>
                  <span class="cat-amount cat-amount--income">{{ c.total | number:'1.2-2' }}</span>
                </div>
              }
              @if (!loading()) {
                <div class="cat-total-row">
                  <span>Total</span>
                  <span class="income-color">{{ totalIncome() | number:'1.2-2' }}</span>
                </div>
              }
            </div>
            <!-- donut chart -->
            <div class="donut-wrap">
              <svg viewBox="0 0 100 100" class="donut-svg">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" stroke-width="14"/>
                @for (seg of incomeSegments(); track seg.category_name) {
                  <circle cx="50" cy="50" r="38" fill="none"
                          [attr.stroke]="seg.color || '#16a34a'"
                          stroke-width="14"
                          [attr.stroke-dasharray]="seg.dash + ' ' + C"
                          [attr.stroke-dashoffset]="seg.offset"
                          transform="rotate(-90 50 50)"/>
                }
              </svg>
            </div>
          </div>
        </div>
      }
    }

    <!-- ─ line mode ─ -->
    @if (mode() === 'line') {
      <div class="gran-toggle">
        <button [class.active]="gran() === 'daily'"   (click)="gran.set('daily')">diário</button>
        <button [class.active]="gran() === 'weekly'"  (click)="gran.set('weekly')">semanal</button>
        <button [class.active]="gran() === 'monthly'" (click)="gran.set('monthly')">mensal</button>
      </div>

      <!-- Despesas line chart -->
      @if (expenseCats().length > 0) {
        <div class="cat-section">
          <h3 class="section-title">Despesas</h3>
          <div class="line-chart-wrap">
            <svg [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH" preserveAspectRatio="none" class="line-svg">
              <!-- Y grid lines -->
              @for (y of yLines(); track y.v) {
                <line [attr.x1]="padL" [attr.x2]="chartW - padR"
                      [attr.y1]="y.py" [attr.y2]="y.py"
                      stroke="#e5e7eb" stroke-width="1"/>
                <text [attr.x]="padL - 4" [attr.y]="y.py + 3.5"
                      text-anchor="end" font-size="9" fill="#9ca3af">{{ y.label }}</text>
              }
              <!-- X labels -->
              @for (b of expBuckets(); track b.key; let i = $index) {
                @if (i % labelStep() === 0) {
                  <text [attr.x]="xPos(i, expBuckets().length)" [attr.y]="chartH - 3"
                        text-anchor="middle" font-size="9" fill="#9ca3af">{{ b.key }}</text>
                }
              }
              <!-- Lines per category -->
              @for (line of expLineData(); track line.name) {
                <polyline
                  [attr.points]="linePoints(line.buckets, expBuckets().length, expYMax())"
                  fill="none" [attr.stroke]="line.color"
                  stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
              }
            </svg>
          </div>
          <!-- legend -->
          <div class="line-legend">
            @for (line of expLineData(); track line.name) {
              <span class="legend-item">
                <span class="legend-dot" [style.background]="line.color"></span>{{ line.name }}
              </span>
            }
          </div>
          <!-- scrollable table -->
          <div class="line-table-wrap">
            <table class="line-table">
              <thead>
                <tr>
                  <th class="sticky-col">Categoria</th>
                  @for (b of expBuckets(); track b.key) {
                    <th>{{ b.key }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (line of expLineData(); track line.name) {
                  <tr>
                    <td class="sticky-col">
                      <span class="legend-dot" [style.background]="line.color"></span>{{ line.name }}
                    </td>
                    @for (b of line.buckets; track $index) {
                      <td [class.nonzero]="b > 0">{{ b > 0 ? (b | number:'1.2-2') : '0,00' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Receitas line chart -->
      @if (incomeCats().length > 0) {
        <div class="cat-section">
          <h3 class="section-title">Receitas</h3>
          <div class="line-chart-wrap">
            <svg [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH" preserveAspectRatio="none" class="line-svg">
              @for (y of incYLines(); track y.v) {
                <line [attr.x1]="padL" [attr.x2]="chartW - padR"
                      [attr.y1]="y.py" [attr.y2]="y.py"
                      stroke="#e5e7eb" stroke-width="1"/>
                <text [attr.x]="padL - 4" [attr.y]="y.py + 3.5"
                      text-anchor="end" font-size="9" fill="#9ca3af">{{ y.label }}</text>
              }
              @for (b of incBuckets(); track b.key; let i = $index) {
                @if (i % labelStep() === 0) {
                  <text [attr.x]="xPos(i, incBuckets().length)" [attr.y]="chartH - 3"
                        text-anchor="middle" font-size="9" fill="#9ca3af">{{ b.key }}</text>
                }
              }
              @for (line of incLineData(); track line.name) {
                <polyline
                  [attr.points]="linePoints(line.buckets, incBuckets().length, incYMax())"
                  fill="none" [attr.stroke]="line.color"
                  stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
              }
            </svg>
          </div>
          <div class="line-legend">
            @for (line of incLineData(); track line.name) {
              <span class="legend-item">
                <span class="legend-dot" [style.background]="line.color"></span>{{ line.name }}
              </span>
            }
          </div>
          <div class="line-table-wrap">
            <table class="line-table">
              <thead>
                <tr>
                  <th class="sticky-col">Categoria</th>
                  @for (b of incBuckets(); track b.key) { <th>{{ b.key }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (line of incLineData(); track line.name) {
                  <tr>
                    <td class="sticky-col">
                      <span class="legend-dot" [style.background]="line.color"></span>{{ line.name }}
                    </td>
                    @for (b of line.buckets; track $index) {
                      <td [class.nonzero]="b > 0">{{ b > 0 ? (b | number:'1.2-2') : '0,00' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    }

    <!-- ─ table mode ─ -->
    @if (mode() === 'table') {
      <div class="cat-section">
        <h3 class="section-title">Despesas</h3>
        <table class="simple-table">
          <thead><tr><th>Categoria</th><th class="num">Qtd</th><th class="num">Total</th><th class="num">%</th></tr></thead>
          <tbody>
            @for (c of expenseCats(); track c.category_name) {
              <tr>
                <td>
                  <div class="tbl-cat">
                    <span class="tbl-dot" [style.background]="c.color || '#6b7280'"></span>
                    {{ c.category_name || 'Sem categoria' }}
                  </div>
                </td>
                <td class="num">{{ c.count }}</td>
                <td class="num">{{ c.total | number:'1.2-2' }}</td>
                <td class="num">{{ pct(c.total, totalExpense()) | number:'1.0-0' }}%</td>
              </tr>
            }
            <tr class="total-row">
              <td><strong>Total</strong></td><td></td>
              <td class="num"><strong>{{ totalExpense() | number:'1.2-2' }}</strong></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="cat-section">
        <h3 class="section-title">Receitas</h3>
        <table class="simple-table">
          <thead><tr><th>Categoria</th><th class="num">Qtd</th><th class="num">Total</th><th class="num">%</th></tr></thead>
          <tbody>
            @for (c of incomeCats(); track c.category_name) {
              <tr>
                <td>
                  <div class="tbl-cat">
                    <span class="tbl-dot" [style.background]="c.color || '#16a34a'"></span>
                    {{ c.category_name || 'Sem categoria' }}
                  </div>
                </td>
                <td class="num">{{ c.count }}</td>
                <td class="num income-color">{{ c.total | number:'1.2-2' }}</td>
                <td class="num">{{ pct(c.total, totalIncome()) | number:'1.0-0' }}%</td>
              </tr>
            }
            <tr class="total-row">
              <td><strong>Total</strong></td><td></td>
              <td class="num income-color"><strong>{{ totalIncome() | number:'1.2-2' }}</strong></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>
    }
  }

  <!-- ═══════════ ENTRADAS x SAÍDAS ═══════════ -->
  @if (tab() === 'flow') {
    <div class="cat-section">
      <div class="flow-summary">
        <div class="flow-card flow-card--income">
          <span class="flow-label">Receitas</span>
          <span class="flow-val">{{ flowTotalIncome() | appCurrency }}</span>
        </div>
        <div class="flow-card flow-card--expense">
          <span class="flow-label">Despesas</span>
          <span class="flow-val">{{ flowTotalExpense() | appCurrency }}</span>
        </div>
        <div class="flow-card" [class.flow-card--income]="flowBalance() >= 0" [class.flow-card--expense]="flowBalance() < 0">
          <span class="flow-label">Saldo do Período</span>
          <span class="flow-val">{{ flowBalance() | appCurrency }}</span>
        </div>
      </div>

      <!-- Bar chart: income vs expense per month -->
      <div class="flow-chart-wrap">
        <svg [attr.viewBox]="'0 0 ' + flowChartW + ' ' + flowChartH" preserveAspectRatio="none" class="flow-svg">
          @for (y of flowYLines(); track y.v) {
            <line [attr.x1]="padL" [attr.x2]="flowChartW - padR" [attr.y1]="y.py" [attr.y2]="y.py" stroke="#e5e7eb" stroke-width="1"/>
            <text [attr.x]="padL - 4" [attr.y]="y.py + 3.5" text-anchor="end" font-size="9" fill="#9ca3af">{{ y.label }}</text>
          }
          @for (row of flowRows(); track row.month; let i = $index) {
            <rect [attr.x]="flowBarX(i)" [attr.y]="flowBarY(row.income)" [attr.width]="flowBarW()" [attr.height]="flowBarH(row.income)"
                  fill="#16a34a" rx="2" opacity=".85"/>
            <rect [attr.x]="flowBarX(i) + flowBarW() + 2" [attr.y]="flowBarY(row.expense)" [attr.width]="flowBarW()" [attr.height]="flowBarH(row.expense)"
                  fill="#ef4444" rx="2" opacity=".85"/>
            <text [attr.x]="flowBarX(i) + flowBarW()" [attr.y]="flowChartH - 3" text-anchor="middle" font-size="9" fill="#9ca3af">{{ row.month | slice:5:7 }}/{{ row.month | slice:2:4 }}</text>
          }
        </svg>
        <div class="flow-legend">
          <span><span class="legend-dot" style="background:#16a34a"></span>Receitas</span>
          <span><span class="legend-dot" style="background:#ef4444"></span>Despesas</span>
        </div>
      </div>

      <table class="simple-table">
        <thead><tr><th>Mês</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Saldo</th></tr></thead>
        <tbody>
          @if (loadingFlow()) {
            @for (i of [1,2,3,4,5,6]; track i) {
              <tr>
                <td><span class="skel skel--text" style="width:70px"></span></td>
                <td class="num"><span class="skel skel--text" style="width:80px;float:right"></span></td>
                <td class="num"><span class="skel skel--text" style="width:80px;float:right"></span></td>
                <td class="num"><span class="skel skel--text" style="width:80px;float:right"></span></td>
              </tr>
            }
          }
          @for (row of flowRows(); track row.month) {
            <tr>
              <td>{{ formatFlowMonth(row.month) }}</td>
              <td class="num income-color">{{ row.income | number:'1.2-2' }}</td>
              <td class="num expense-color">{{ row.expense | number:'1.2-2' }}</td>
              <td class="num" [class.income-color]="row.balance >= 0" [class.expense-color]="row.balance < 0">
                {{ row.balance | number:'1.2-2' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- ═══════════ CONTAS ═══════════ -->
  @if (tab() === 'accounts') {
    <div class="cat-section">
      @if (loadingAccounts()) {
        @for (i of [1,2,3]; track i) {
          <div class="acc-row"><div class="skel skel--icon"></div><div class="acc-info"><span class="skel skel--text" style="width:100px"></span><span class="skel skel--text" style="width:60px;margin-top:3px"></span></div><span class="skel skel--text" style="width:80px"></span></div>
        }
      }
      @for (a of accountRows(); track a.id) {
        <div class="acc-row">
          <div class="cat-icon" [style.background]="a.color || '#6b7280'">{{ a.name[0] }}</div>
          <div class="acc-info">
            <span class="cat-name">{{ a.name }}</span>
            <span class="cat-pct">{{ a.type }}</span>
          </div>
          <div class="acc-amounts">
            <span class="acc-balance">{{ a.balance | appCurrency }}</span>
            @if (a.income > 0) { <span class="acc-sub income-color">+{{ a.income | number:'1.2-2' }} rec.</span> }
            @if (a.expense > 0) { <span class="acc-sub expense-color">-{{ a.expense | number:'1.2-2' }} desp.</span> }
          </div>
        </div>
      }
      @if (!loadingAccounts() && accountRows().length === 0) {
        <p class="empty-msg">Nenhuma conta cadastrada.</p>
      }
    </div>
  }

  <!-- ═══════════ TAGS ═══════════ -->
  @if (tab() === 'tags') {
    <div class="cat-section">
      @if (tagRows().length === 0 && !loadingTags()) {
        <div class="tags-cta">
          <p>🏷️ Você ainda não usou <strong>tags</strong> neste período.</p>
          <p class="tags-cta__sub">Tags ajudam a filtrar e analisar seus gastos com mais precisão.</p>
        </div>
      }
      @if (tagRows().length > 0) {
        <table class="simple-table">
          <thead><tr><th>Tag</th><th class="num">Qtd</th><th class="num">Total</th></tr></thead>
          <tbody>
            @for (t of tagRows(); track t.tag) {
              <tr>
                <td><span class="tag-badge">{{ t.tag }}</span></td>
                <td class="num">{{ t.count }}</td>
                <td class="num">{{ t.total | number:'1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  }

</div>
  `,
  styles: [`
    /* ── Page shell ── */
    .rep { padding-bottom: 2rem; }

    .rep__head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem;
    }
    .rep__title { font-size: 1.25rem; font-weight: 700; color: #111; margin: 0; }

    /* Month nav */
    .month-nav { display: flex; align-items: center; gap: .5rem; }
    .nav-btn {
      background: #fff; border: 1px solid #e5e7eb; border-radius: .375rem;
      width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; color: #374151;
      display: flex; align-items: center; justify-content: center;
      transition: border-color .15s;
    }
    .nav-btn:hover { border-color: #2e7736; color: #2e7736; }
    .month-label { font-size: .95rem; font-weight: 600; color: #111; min-width: 120px; text-align: center; text-transform: capitalize; }

    /* ── Tabs ── */
    .tabs {
      display: flex; border-bottom: 2px solid #e5e7eb;
      margin-bottom: 1.25rem; gap: 0;
    }
    .tab {
      background: none; border: none; cursor: pointer;
      padding: .65rem 1.1rem; font-size: .875rem; color: #6b7280;
      border-bottom: 2px solid transparent; margin-bottom: -2px;
      transition: color .15s, border-color .15s; font-weight: 500;
    }
    .tab:hover { color: #2e7736; }
    .tab.active { color: #2e7736; border-bottom-color: #2e7736; font-weight: 600; }

    /* ── Toolbar ── */
    .toolbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: .5rem; flex-wrap: wrap; gap: .5rem;
    }
    .toolbar__left { display: flex; align-items: center; gap: .75rem; }
    .toolbar__title { font-size: .875rem; font-weight: 600; color: #374151; }
    .btn-filter {
      padding: .3rem .75rem; border: 1px solid #e5e7eb; border-radius: .375rem;
      background: #fff; font-size: .78rem; cursor: pointer; color: #374151;
      display: flex; align-items: center; gap: .35rem;
      transition: border-color .15s;
    }
    .btn-filter:hover { border-color: #2e7736; color: #2e7736; }
    .toolbar__right { display: flex; gap: .25rem; }
    .view-btn {
      width: 32px; height: 32px; border-radius: .375rem;
      border: 1px solid #e5e7eb; background: #fff; cursor: pointer;
      color: #9ca3af; display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    .view-btn:hover { border-color: #2e7736; color: #2e7736; }
    .view-btn.active { background: #2e7736; border-color: #2e7736; color: #fff; }

    .card-note { font-size: .75rem; color: #9ca3af; margin: 0 0 1rem; }
    .underline { text-decoration: underline; cursor: pointer; }

    /* ── Category sections ── */
    .cat-section {
      background: #fff; border-radius: .5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;
    }
    .section-title {
      font-size: .7rem; font-weight: 700; color: #9ca3af;
      text-transform: uppercase; letter-spacing: .06em;
      margin: 0 0 .875rem;
    }

    /* Category rows (donut mode) */
    .cat-body { display: flex; align-items: flex-start; gap: 1.5rem; }
    .cat-list { flex: 1; min-width: 0; }
    .cat-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .6rem 0; border-top: 1px solid #f3f4f6;
    }
    .cat-row:first-of-type { border-top: none; }
    .cat-icon {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: .95rem; font-weight: 700;
    }
    .cat-info { flex: 1; display: flex; flex-direction: column; gap: .05rem; min-width: 0; }
    .cat-name { font-size: .875rem; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cat-pct  { font-size: .72rem; color: #9ca3af; }
    .cat-amount { font-size: .9rem; font-weight: 600; color: #374151; white-space: nowrap; }
    .cat-amount--income { color: #16a34a; }

    .cat-total-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: .65rem 0 0; border-top: 2px solid #e5e7eb; margin-top: .25rem;
      font-size: .875rem; font-weight: 700; color: #111;
    }

    /* Donut chart */
    .donut-wrap { width: 160px; height: 160px; flex-shrink: 0; }
    .donut-svg  { width: 100%; height: 100%; }

    /* ── Granularity toggle ── */
    .gran-toggle {
      display: flex; gap: 0; margin-bottom: 1rem;
      border: 1px solid #e5e7eb; border-radius: .375rem; overflow: hidden;
      width: fit-content;
    }
    .gran-toggle button {
      background: none; border: none; cursor: pointer;
      padding: .35rem .9rem; font-size: .82rem; color: #9ca3af;
      transition: background .15s, color .15s;
    }
    .gran-toggle button + button { border-left: 1px solid #e5e7eb; }
    .gran-toggle button.active { background: #2e7736; color: #fff; }

    /* ── Line chart ── */
    .line-chart-wrap { width: 100%; height: 160px; margin-bottom: .5rem; }
    .line-svg { width: 100%; height: 100%; overflow: visible; }
    .line-legend { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin-bottom: .75rem; }
    .legend-item { display: flex; align-items: center; gap: .3rem; font-size: .75rem; color: #374151; }
    .legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; display: inline-block; }

    /* Line chart table */
    .line-table-wrap { overflow-x: auto; margin-top: .5rem; }
    .line-table {
      border-collapse: collapse; font-size: .75rem; min-width: 100%;
      white-space: nowrap;
    }
    .line-table th {
      background: #f9fafb; padding: .45rem .6rem; color: #6b7280;
      font-weight: 600; border-bottom: 1px solid #e5e7eb; text-align: right;
    }
    .line-table th:first-child { text-align: left; }
    .line-table td {
      padding: .4rem .6rem; border-top: 1px solid #f3f4f6;
      color: #9ca3af; text-align: right;
    }
    .line-table td.sticky-col { text-align: left; }
    .line-table td.nonzero { color: #374151; font-weight: 500; }
    .sticky-col {
      position: sticky; left: 0; background: #fff; z-index: 1;
      display: flex; align-items: center; gap: .4rem;
      min-width: 130px;
    }
    .line-table th.sticky-col { background: #f9fafb; }

    /* ── Table mode ── */
    .simple-table { width: 100%; border-collapse: collapse; }
    .simple-table th {
      background: #f9fafb; padding: .65rem 1rem; text-align: left;
      font-size: .78rem; color: #6b7280; font-weight: 600;
      border-bottom: 1px solid #e5e7eb;
    }
    .simple-table td { padding: .65rem 1rem; border-top: 1px solid #f3f4f6; font-size: .875rem; color: #374151; }
    .simple-table .num { text-align: right; }
    .tbl-cat { display: flex; align-items: center; gap: .5rem; }
    .tbl-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
    .total-row td { border-top: 2px solid #e5e7eb; }
    .income-color  { color: #16a34a; }
    .expense-color { color: #ef4444; }

    /* ── Flow tab ── */
    .flow-summary { display: flex; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .flow-card {
      flex: 1; min-width: 140px; background: #f9fafb;
      border-radius: .5rem; padding: .875rem 1rem;
      display: flex; flex-direction: column; gap: .2rem;
    }
    .flow-card--income { background: #f0fdf4; }
    .flow-card--expense { background: #fef2f2; }
    .flow-label { font-size: .72rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .flow-val { font-size: 1.1rem; font-weight: 700; color: #111; }
    .flow-card--income .flow-val  { color: #16a34a; }
    .flow-card--expense .flow-val { color: #ef4444; }

    .flow-chart-wrap { width: 100%; height: 140px; margin-bottom: 1rem; }
    .flow-svg { width: 100%; height: 100%; overflow: visible; }
    .flow-legend { display: flex; gap: 1rem; margin-top: .25rem; margin-bottom: 1rem; font-size: .78rem; }

    /* ── Accounts tab ── */
    .acc-row { display: flex; align-items: center; gap: .75rem; padding: .7rem 0; border-top: 1px solid #f3f4f6; }
    .acc-row:first-of-type { border-top: none; }
    .acc-info { flex: 1; display: flex; flex-direction: column; }
    .acc-amounts { display: flex; flex-direction: column; align-items: flex-end; gap: .1rem; }
    .acc-balance { font-size: .95rem; font-weight: 700; color: #2563eb; }
    .acc-sub { font-size: .72rem; }
    .empty-msg { color: #9ca3af; font-size: .875rem; text-align: center; padding: 1rem 0; }

    /* ── Tags tab ── */
    .tags-cta { text-align: center; padding: 2rem 1rem; color: #374151; }
    .tags-cta p { margin: .25rem 0; }
    .tags-cta__sub { font-size: .82rem; color: #9ca3af; }
    .tag-badge {
      background: #ede9fe; color: #7c3aed; border-radius: 9999px;
      padding: .15rem .6rem; font-size: .78rem; font-weight: 600;
    }

    /* ── Skeleton ── */
    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .skel {
      display: inline-block; border-radius: .25rem;
      background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
      background-size: 800px 100%; animation: shimmer 1.4s infinite;
    }
    .skel--icon  { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: block; }
    .skel--text  { height: 14px; display: block; }
  `]
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);

  // ── UI state ──
  tab      = signal<Tab>('categories');
  mode     = signal<Mode>('donut');
  gran     = signal<Gran>('daily');
  currentMonth = signal(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // ── Data ──
  loading         = signal(true);
  loadingFlow     = signal(true);
  loadingAccounts = signal(false);
  loadingTags     = signal(false);

  expenseCats  = signal<any[]>([]);
  incomeCats   = signal<any[]>([]);
  txs          = signal<any[]>([]); // raw transactions for line chart

  flowRows     = signal<any[]>([]);
  accountRows  = signal<any[]>([]);
  tagRows      = signal<any[]>([]);

  // ── Constants ──
  readonly C       = 2 * Math.PI * 38; // donut circumference ≈ 238.76
  readonly chartW  = 800;
  readonly chartH  = 140;
  readonly padL    = 48;
  readonly padR    = 10;
  readonly padT    = 8;
  readonly padB    = 20;
  readonly flowChartW = 800;
  readonly flowChartH = 120;

  private readonly COLORS = [
    '#f59e0b','#ef4444','#8b5cf6','#3b82f6','#10b981',
    '#f97316','#06b6d4','#ec4899','#84cc16','#6366f1'
  ];

  // ── Computed ──
  totalExpense = computed(() => this.expenseCats().reduce((s, c) => s + c.total, 0));
  totalIncome  = computed(() => this.incomeCats().reduce((s, c)  => s + c.total, 0));

  monthLabel = computed(() => {
    const [y, m] = this.currentMonth().split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
      .format(new Date(y, m - 1, 1));
  });

  // Donut segments
  expenseSegments = computed(() => this.buildSegments(this.expenseCats(), this.totalExpense()));
  incomeSegments  = computed(() => this.buildSegments(this.incomeCats(),  this.totalIncome()));

  // Flow totals
  flowTotalIncome  = computed(() => this.flowRows().reduce((s, r) => s + (r.income  ?? 0), 0));
  flowTotalExpense = computed(() => this.flowRows().reduce((s, r) => s + (r.expense ?? 0), 0));
  flowBalance      = computed(() => this.flowTotalIncome() - this.flowTotalExpense());

  // ── Line chart buckets ──
  private get monthFrom(): string { return this.currentMonth() + '-01'; }
  private get monthTo(): string {
    const [y, m] = this.currentMonth().split('-').map(Number);
    return new Date(y, m, 0).toISOString().slice(0, 10);
  }

  // Buckets (keys) for current granularity
  expBuckets = computed(() => this.buildBuckets('expense'));
  incBuckets = computed(() => this.buildBuckets('income'));

  // Line data per category
  expLineData = computed(() => this.buildLineData('expense'));
  incLineData = computed(() => this.buildLineData('income'));

  // Y max for expense/income charts
  expYMax = computed(() => Math.max(...this.expLineData().flatMap(l => l.buckets), 1) * 1.1);
  incYMax = computed(() => Math.max(...this.incLineData().flatMap(l => l.buckets), 1) * 1.1);

  // Y axis grid lines
  yLines = computed(() => this.buildYLines(this.expYMax()));
  incYLines = computed(() => this.buildYLines(this.incYMax()));

  // How many X labels to show (to avoid crowding)
  labelStep = computed(() => {
    const n = this.expBuckets().length;
    if (n <= 10) return 1;
    if (n <= 20) return 2;
    return 5;
  });

  // Flow bar chart
  private flowYMax = computed(() => Math.max(...this.flowRows().map(r => Math.max(r.income ?? 0, r.expense ?? 0)), 1) * 1.15);
  flowYLines = computed(() => this.buildYLines(this.flowYMax(), this.flowChartH));
  flowBarW   = computed(() => {
    const n = this.flowRows().length;
    if (!n) return 20;
    const W = this.flowChartW - this.padL - this.padR;
    return Math.max(4, Math.floor(W / (n * 2.5 + 1)) - 2);
  });
  flowBarX(i: number): number {
    const n = this.flowRows().length;
    const W = this.flowChartW - this.padL - this.padR;
    const slot = W / n;
    return this.padL + i * slot + slot * 0.1;
  }
  flowBarY(v: number): number {
    const max = this.flowYMax();
    const H = this.flowChartH - this.padT - this.padB;
    return this.padT + H - (v / max) * H;
  }
  flowBarH(v: number): number {
    const max = this.flowYMax();
    const H = this.flowChartH - this.padT - this.padB;
    return (v / max) * H;
  }

  // ── Navigation ──
  prevMonth() {
    const [y, m] = this.currentMonth().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.currentMonth.set(d.toISOString().slice(0, 7));
    this.loadCategories();
  }
  nextMonth() {
    const [y, m] = this.currentMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    this.currentMonth.set(d.toISOString().slice(0, 7));
    this.loadCategories();
  }

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'flow' && this.flowRows().length === 0) this.loadFlow();
    if (t === 'accounts' && this.accountRows().length === 0) this.loadAccounts();
    if (t === 'tags' && this.tagRows().length === 0) this.loadTags();
  }

  // ── Helpers ──
  pct(v: number, total: number): number {
    return total ? (v / total) * 100 : 0;
  }

  xPos(i: number, n: number): number {
    const W = this.chartW - this.padL - this.padR;
    return this.padL + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  }

  linePoints(buckets: number[], n: number, yMax: number): string {
    return buckets.map((v, i) => {
      const x = this.xPos(i, n);
      const H = this.chartH - this.padT - this.padB;
      const y = this.padT + H - (v / yMax) * H;
      return `${x},${y}`;
    }).join(' ');
  }

  formatFlowMonth(m: string): string {
    const [y, mo] = m.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(y, mo - 1, 1));
  }

  exportPDF() { window.print(); }

  private buildSegments(cats: any[], total: number) {
    if (!total) return [];
    let acc = 0;
    return cats.map((c, ci) => {
      const pct = c.total / total;
      const dash = pct * this.C;
      const seg = { ...c, dash, offset: this.C - acc, pct: Math.round(pct * 100), color: c.color || this.COLORS[ci % this.COLORS.length] };
      acc += dash;
      return seg;
    });
  }

  private buildYLines(max: number, h = this.chartH) {
    const H = h - this.padT - this.padB;
    const fmt = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0);
    return [0, 0.5, 1].map(t => ({
      v: t * max,
      py: this.padT + H - t * H,
      label: fmt(t * max)
    }));
  }

  private buildBuckets(type: 'expense' | 'income'): { key: string }[] {
    const g = this.gran();
    const [y, m] = this.currentMonth().split('-').map(Number);

    if (g === 'daily') {
      const days = new Date(y, m, 0).getDate();
      return Array.from({ length: days }, (_, i) =>
        ({ key: String(i + 1).padStart(2, '0') + '/' + String(m).padStart(2, '0') })
      );
    }
    if (g === 'weekly') {
      return ['S1','S2','S3','S4','S5'].map(key => ({ key }));
    }
    // monthly: last 12 months
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y, m - 1 - 11 + i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(2);
      return { key: mm + '/' + yy };
    });
  }

  private buildLineData(type: 'expense' | 'income') {
    const g = this.gran();
    const [y, m] = this.currentMonth().split('-').map(Number);
    const filtered = this.txs().filter(t => t.type === type && !t.ignored);

    // Get unique categories
    const catMap = new Map<string, string>(); // name -> color
    filtered.forEach(t => {
      const name = t.category?.name || 'Sem categoria';
      if (!catMap.has(name)) catMap.set(name, t.category?.color || '');
    });

    const cats = [...catMap.entries()].slice(0, 8);

    return cats.map(([name, color], ci) => {
      const txsForCat = filtered.filter(t => (t.category?.name || 'Sem categoria') === name);
      const buckets = this.buildBuckets(type).map((b, bi) => {
        return txsForCat.filter(t => this.txMatchesBucket(t, bi, g, y, m)).reduce((s, t) => s + t.amount, 0);
      });
      return { name, color: color || this.COLORS[ci % this.COLORS.length], buckets };
    });
  }

  private txMatchesBucket(tx: any, bucketIdx: number, g: Gran, y: number, m: number): boolean {
    const date = new Date(tx.date + 'T12:00:00');
    if (g === 'daily') {
      const dayOfMonth = date.getDate() - 1; // 0-indexed
      return dayOfMonth === bucketIdx;
    }
    if (g === 'weekly') {
      const dayOfMonth = date.getDate();
      const week = Math.floor((dayOfMonth - 1) / 7); // 0-indexed week (0..4)
      return week === bucketIdx;
    }
    // monthly: compare year-month
    const [targetY, targetM] = (() => {
      const d = new Date(y, m - 1 - 11 + bucketIdx, 1);
      return [d.getFullYear(), d.getMonth() + 1];
    })();
    return date.getFullYear() === targetY && date.getMonth() + 1 === targetM;
  }

  // ── Data loading ──
  ngOnInit() { this.loadCategories(); this.loadFlow(); }

  private loadCategories() {
    this.loading.set(true);
    const from = this.monthFrom;
    const to   = this.monthTo;

    forkJoin({
      exp: this.api.get<any>('/reports/categories', { from, to, type: 'expense' }).pipe(catchError(() => of({ data: [] }))),
      inc: this.api.get<any>('/reports/categories', { from, to, type: 'income'  }).pipe(catchError(() => of({ data: [] }))),
      txs: this.api.get<any>('/transactions', { date_from: from, date_to: to, limit: 500 }).pipe(catchError(() => of({ data: [] }))),
    }).subscribe(({ exp, inc, txs }) => {
      this.expenseCats.set((exp.data ?? []).map((c: any, i: number) => ({ ...c, color: c.color || this.COLORS[i % this.COLORS.length] })));
      this.incomeCats.set((inc.data  ?? []).map((c: any, i: number) => ({ ...c, color: c.color || this.COLORS[i % this.COLORS.length] })));
      this.txs.set(txs.data ?? []);
      this.loading.set(false);
    });
  }

  private loadFlow() {
    this.loadingFlow.set(true);
    const year = this.currentMonth().slice(0, 4);
    this.api.get<any>('/reports/flow', { from: `${year}-01-01`, to: `${year}-12-31` })
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(r => { this.flowRows.set(r.data ?? []); this.loadingFlow.set(false); });
  }

  private loadAccounts() {
    this.loadingAccounts.set(true);
    const from = this.monthFrom;
    const to   = this.monthTo;
    forkJoin({
      accs: this.api.get<any>('/accounts').pipe(catchError(() => of({ data: [] }))),
      txs:  this.api.get<any>('/transactions', { date_from: from, date_to: to, limit: 500 }).pipe(catchError(() => of({ data: [] }))),
    }).subscribe(({ accs, txs }) => {
      const txList: any[] = txs.data ?? [];
      const rows = (accs.data ?? []).map((a: any) => ({
        ...a,
        income:  txList.filter(t => t.account_id === a.id && t.type === 'income'  && !t.ignored).reduce((s: number, t: any) => s + t.amount, 0),
        expense: txList.filter(t => t.account_id === a.id && t.type === 'expense' && !t.ignored).reduce((s: number, t: any) => s + t.amount, 0),
      }));
      this.accountRows.set(rows);
      this.loadingAccounts.set(false);
    });
  }

  private loadTags() {
    this.loadingTags.set(true);
    const from = this.monthFrom;
    const to   = this.monthTo;
    this.api.get<any>('/transactions', { date_from: from, date_to: to, limit: 500 })
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(r => {
        const txList: any[] = r.data ?? [];
        const tagMap = new Map<string, { tag: string; count: number; total: number }>();
        txList.forEach(tx => {
          (tx.tags ?? []).forEach((tag: any) => {
            const name = tag.name ?? tag;
            if (!tagMap.has(name)) tagMap.set(name, { tag: name, count: 0, total: 0 });
            const e = tagMap.get(name)!;
            e.count++;
            e.total += tx.amount;
          });
        });
        this.tagRows.set([...tagMap.values()].sort((a, b) => b.total - a.total));
        this.loadingTags.set(false);
      });
  }
}
