import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PlanService } from '../../core/services/plan.service';
import { MoneyMaskDirective } from '../../shared/directives/money-mask.directive';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'streaming',    label: 'Streaming',     emoji: '🎬' },
  { value: 'music',        label: 'Música',         emoji: '🎵' },
  { value: 'storage',      label: 'Armazenamento',  emoji: '☁️' },
  { value: 'ai',           label: 'IA',             emoji: '🤖' },
  { value: 'productivity', label: 'Produtividade',  emoji: '🛠️' },
  { value: 'games',        label: 'Jogos',          emoji: '🎮' },
  { value: 'ecommerce',    label: 'E-commerce',     emoji: '🛒' },
  { value: 'other',        label: 'Outros',         emoji: '📱' },
];

// ── Presets grouped by category ───────────────────────────────────────────────
const ALL_PRESETS: { name: string; category: string; color: string; logo: string }[] = [
  // Streaming
  { name: 'Netflix',        category: 'streaming',    color: '#e50914', logo: 'https://logo.clearbit.com/netflix.com' },
  { name: 'Disney+',        category: 'streaming',    color: '#0e2e5e', logo: 'https://logo.clearbit.com/disneyplus.com' },
  { name: 'Prime Video',    category: 'streaming',    color: '#00a8e1', logo: 'https://logo.clearbit.com/primevideo.com' },
  { name: 'Max',            category: 'streaming',    color: '#002be9', logo: 'https://logo.clearbit.com/max.com' },
  { name: 'Globoplay',      category: 'streaming',    color: '#e5000a', logo: 'https://logo.clearbit.com/globoplay.globo.com' },
  { name: 'Paramount+',     category: 'streaming',    color: '#0064ff', logo: 'https://logo.clearbit.com/paramountplus.com' },
  { name: 'Apple TV+',      category: 'streaming',    color: '#555555', logo: 'https://logo.clearbit.com/apple.com' },
  { name: 'Crunchyroll',    category: 'streaming',    color: '#f47521', logo: 'https://logo.clearbit.com/crunchyroll.com' },
  // Music
  { name: 'Spotify',        category: 'music',        color: '#1db954', logo: 'https://logo.clearbit.com/spotify.com' },
  { name: 'YouTube Premium',category: 'music',        color: '#ff0000', logo: 'https://logo.clearbit.com/youtube.com' },
  { name: 'Apple Music',    category: 'music',        color: '#fc3c44', logo: 'https://logo.clearbit.com/apple.com' },
  { name: 'Deezer',         category: 'music',        color: '#a238ff', logo: 'https://logo.clearbit.com/deezer.com' },
  // Storage
  { name: 'iCloud+',        category: 'storage',      color: '#3a7bd5', logo: 'https://logo.clearbit.com/icloud.com' },
  { name: 'Google One',     category: 'storage',      color: '#4285f4', logo: 'https://logo.clearbit.com/google.com' },
  { name: 'OneDrive',       category: 'storage',      color: '#0078d4', logo: 'https://logo.clearbit.com/microsoft.com' },
  { name: 'Dropbox',        category: 'storage',      color: '#0061ff', logo: 'https://logo.clearbit.com/dropbox.com' },
  // AI
  { name: 'ChatGPT Plus',   category: 'ai',           color: '#10a37f', logo: 'https://logo.clearbit.com/openai.com' },
  { name: 'Claude Pro',     category: 'ai',           color: '#d97757', logo: 'https://logo.clearbit.com/anthropic.com' },
  { name: 'Gemini Advanced',category: 'ai',           color: '#4285f4', logo: 'https://logo.clearbit.com/google.com' },
  { name: 'GitHub Copilot', category: 'ai',           color: '#24292e', logo: 'https://logo.clearbit.com/github.com' },
  { name: 'Perplexity Pro', category: 'ai',           color: '#20808d', logo: 'https://logo.clearbit.com/perplexity.ai' },
  { name: 'Midjourney',     category: 'ai',           color: '#000000', logo: 'https://logo.clearbit.com/midjourney.com' },
  { name: 'Cursor',         category: 'ai',           color: '#000000', logo: 'https://logo.clearbit.com/cursor.sh' },
  { name: 'Kiro',           category: 'ai',           color: '#FF9900', logo: 'https://logo.clearbit.com/aws.amazon.com' },
  // Productivity
  { name: 'Microsoft 365',  category: 'productivity', color: '#d83b01', logo: 'https://logo.clearbit.com/microsoft.com' },
  { name: 'Adobe CC',       category: 'productivity', color: '#ff0000', logo: 'https://logo.clearbit.com/adobe.com' },
  { name: 'Notion',         category: 'productivity', color: '#000000', logo: 'https://logo.clearbit.com/notion.so' },
  { name: 'Figma',          category: 'productivity', color: '#f24e1e', logo: 'https://logo.clearbit.com/figma.com' },
  { name: 'Canva Pro',      category: 'productivity', color: '#00c4cc', logo: 'https://logo.clearbit.com/canva.com' },
  { name: 'Linear',         category: 'productivity', color: '#5e6ad2', logo: 'https://logo.clearbit.com/linear.app' },
  // Games
  { name: 'Xbox Game Pass', category: 'games',        color: '#107c10', logo: 'https://logo.clearbit.com/xbox.com' },
  { name: 'PlayStation Plus',category:'games',        color: '#003087', logo: 'https://logo.clearbit.com/playstation.com' },
  { name: 'Nintendo Online', category:'games',        color: '#e4000f', logo: 'https://logo.clearbit.com/nintendo.com' },
  { name: 'EA Play',         category:'games',        color: '#ff4747', logo: 'https://logo.clearbit.com/ea.com' },
  // E-commerce
  { name: 'Amazon Prime',   category: 'ecommerce',   color: '#ff9900', logo: 'https://logo.clearbit.com/amazon.com' },
  { name: 'Rappi Prime',    category: 'ecommerce',   color: '#ff441a', logo: 'https://logo.clearbit.com/rappi.com.br' },
  // Other (always last)
  { name: 'Outro',          category: 'other',        color: '#6b7280', logo: '' },
];

const AI_PROVIDERS = [
  { value: 'openai',    label: 'OpenAI (ChatGPT)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google',    label: 'Google (Gemini)' },
  { value: 'other',     label: 'Outro' },
];

@Component({
  selector: 'app-ai-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MoneyMaskDirective, ConfirmModalComponent],
  template: `
<div class="page-header">
  <h1>Assinaturas Tech</h1>
  @if (plan.isPremium()) {
    <button class="btn btn--primary btn--sm" (click)="openForm()">+ Nova assinatura</button>
  }
</div>

@if (plan.loaded() && !plan.isPremium()) {
  <div class="upsell-card">
    <div class="upsell-icon">🔒</div>
    <h2>Recurso Premium</h2>
    <p>Cadastre e acompanhe todas as suas assinaturas (streaming, IA, armazenamento, etc.) e veja o custo total mensal.</p>
    <a routerLink="/plan" class="btn btn--primary">Ver planos</a>
  </div>
} @else {

  <!-- Summary bar -->
  @if (!loading() && items().length > 0) {
    <div class="summary-bar">
      @for (cat of activeCategorySummary(); track cat.value) {
        <div class="sum-chip">
          <span class="sum-emoji">{{ cat.emoji }}</span>
          <span class="sum-label">{{ cat.label }}</span>
          <span class="sum-val">R$ {{ cat.total | number:'1.2-2' }}</span>
        </div>
      }
      <div class="sum-chip sum-chip--total">
        <span class="sum-label">Total/mês</span>
        <span class="sum-val">R$ {{ totalMonthly() | number:'1.2-2' }}</span>
      </div>
    </div>
  }

  <!-- Form modal -->
  @if (showForm) {
    <div class="overlay" (click)="cancelForm()">
      <div class="form-modal" (click)="$event.stopPropagation()">
        <div class="fm-head">
          <h3>{{ editing ? 'Editar assinatura' : 'Nova assinatura' }}</h3>
          <button class="fm-close" (click)="cancelForm()">✕</button>
        </div>
        <div class="fm-body">

          <!-- Category selector -->
          <div class="fm-label">Categoria</div>
          <div class="cat-grid">
            @for (cat of categories; track cat.value) {
              <button type="button" class="cat-btn" [class.cat-btn--sel]="item.category === cat.value"
                      (click)="selectCategory(cat.value)">
                <span class="cat-emoji">{{ cat.emoji }}</span>
                <span class="cat-name">{{ cat.label }}</span>
              </button>
            }
          </div>

          <!-- Name + Plan -->
          <div class="fm-row" style="margin-top:.75rem">
            <div class="fm-group">
              <div class="fm-label">Nome *</div>
              <input [(ngModel)]="item.name" name="name" class="fm-input" placeholder="Ex: Netflix, iCloud…" required />
            </div>
            <div class="fm-group">
              <div class="fm-label">Plano</div>
              <input [(ngModel)]="item.plan_name" name="plan_name" class="fm-input" placeholder="Ex: Basic, Pro, 2TB…" />
            </div>
          </div>

          <!-- Cost + Cycle + Day -->
          <div class="fm-row">
            <div class="fm-group">
              <div class="fm-label">Custo *</div>
              <div class="amount-wrap">
                <span class="currency-prefix">R$</span>
                <input [(ngModel)]="item.monthly_cost" name="monthly_cost" type="text" inputmode="decimal"
                       appMoneyMask class="fm-input fm-input--amount" placeholder="0,00" />
              </div>
            </div>
            <div class="fm-group">
              <div class="fm-label">Ciclo</div>
              <select [(ngModel)]="item.billing_cycle" name="billing_cycle" class="fm-input">
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div class="fm-group">
              <div class="fm-label">Dia cobrança</div>
              <input [(ngModel)]="item.billing_day" name="billing_day" type="number" min="1" max="31"
                     class="fm-input" placeholder="1–31" />
            </div>
          </div>

          <!-- API Key — only for AI category -->
          @if (item.category === 'ai') {
            <div class="fm-label">
              API Key (opcional — para sincronizar uso automático)
              @if (editing && item.has_api_key) { <span class="key-ok">chave salva ✓</span> }
            </div>
            <input [(ngModel)]="item.api_key" name="api_key" type="password" class="fm-input"
                   [placeholder]="editing && item.has_api_key ? 'Deixe em branco para manter' : 'sk-…'" />
            <div class="fm-hint">Criptografada antes de ser salva. Sem ela, informe o uso manualmente.</div>
          }

        </div>
        <div class="fm-footer">
          <button type="button" class="btn btn--ghost" (click)="cancelForm()">Cancelar</button>
          <button type="button" class="btn btn--primary" [disabled]="!item.name || !item.monthly_cost"
                  (click)="save()">{{ editing ? 'Salvar' : 'Criar assinatura' }}</button>
        </div>
      </div>
    </div>
  }

  <!-- Loading -->
  @if (loading()) {
    <div class="list-grid">
      @for (i of [1,2,3,4]; track i) {
        <div class="item-card skel-card">
          <div class="skel-block" style="height:44px;width:44px;border-radius:50%;margin-bottom:.5rem"></div>
          <div class="skel-block" style="height:14px;width:60%;margin-bottom:.3rem"></div>
          <div class="skel-block" style="height:11px;width:40%"></div>
        </div>
      }
    </div>
  } @else if (items().length === 0) {
    <div class="empty-state">
      Nenhuma assinatura cadastrada ainda.<br/>
      <button class="btn btn--primary btn--sm" style="margin-top:.75rem" (click)="openForm()">+ Cadastrar primeira</button>
    </div>
  } @else {
    <!-- Cards grouped by category -->
    @for (group of groupedItems(); track group.cat) {
      <div class="group-section">
        <div class="group-header">
          <span class="group-emoji">{{ group.emoji }}</span>
          <span class="group-title">{{ group.label }}</span>
          <span class="group-total">R$ {{ group.monthlyTotal | number:'1.2-2' }}/mês</span>
        </div>
        <div class="list-grid">
          @for (it of group.items; track it.id) {
            <div class="item-card">
              <div class="card-top">
                @if (it.logo) {
                  <div class="item-icon item-icon--logo">
                    <img [src]="it.logo" [alt]="it.name" class="icon-logo" (error)="onLogoError($event, it.color ?? '#374151', it.name)" />
                  </div>
                } @else {
                  <div class="item-icon item-icon--emoji">{{ categoryEmoji(it.category) }}</div>
                }
                <div class="card-info">
                  <span class="card-name">{{ it.name }}</span>
                  <span class="card-sub">{{ it.plan_name || '' }}{{ it.plan_name ? ' · ' : '' }}
                    R$ {{ monthlyCost(it) | number:'1.2-2' }}/mês
                    @if (it.billing_cycle === 'annual') { <span class="cycle-badge">anual</span> }
                  </span>
                </div>
                <div class="card-cost">R$ {{ monthlyCost(it) | number:'1.2-2' }}</div>
              </div>

              @if (it.billing_day) {
                <div class="billing-day">
                  📅 Cobrança todo dia <strong>{{ it.billing_day }}</strong>
                </div>
              }

              <!-- AI-specific: recommendation + usage -->
              @if (it.category === 'ai') {
                @if (it.recommendation) {
                  <div class="rec-badge rec-badge--{{ it.recommendation.score }}">
                    <span class="rec-label">{{ it.recommendation.label }}</span>
                    <span class="rec-msg">{{ it.recommendation.message }}</span>
                  </div>
                }
                <div class="usage-row">
                  @if (it.current_usage && it.current_usage.requests_count > 0) {
                    <div class="usage-pct-wrap">
                      <div class="usage-pct-bar">
                        <div class="usage-pct-fill" [style.width.%]="it.current_usage.requests_count" [class.usage-pct-fill--warn]="it.current_usage.requests_count >= 80"></div>
                      </div>
                      <span class="usage-pct-label">{{ it.current_usage.requests_count }}% usado</span>
                    </div>
                  } @else {
                    <span class="usage-empty">Sem dados de uso este mês</span>
                  }
                </div>
                @if (manualFormId === it.id) {
                  <div class="manual-form">
                    <input type="number" [(ngModel)]="manualUsage.requests_count" name="pct"
                           class="fm-input fm-input--sm" min="0" max="100" placeholder="0" style="max-width:70px" />
                    <span class="pct-symbol">%</span>
                    <button class="btn btn--primary btn--sm" (click)="saveManualUsage(it)">OK</button>
                    <button class="btn btn--ghost btn--sm" (click)="manualFormId = null">✕</button>
                  </div>
                }
              }

              <div class="card-actions">
                @if (it.category === 'ai' && it.has_api_key) {
                  <button class="btn btn--ghost btn--sm" (click)="sync(it)" [disabled]="syncingId === it.id">
                    {{ syncingId === it.id ? '…' : '🔄 Sincronizar' }}
                  </button>
                }
                @if (it.category === 'ai') {
                  <button class="btn btn--ghost btn--sm" (click)="toggleManualForm(it)">📝 Informar uso</button>
                }
                <button class="btn btn--ghost btn--sm" (click)="edit(it)">✎ Editar</button>
                <button class="btn btn--danger btn--sm" (click)="remove(it)">✕</button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  }
}

<app-confirm-modal
  [visible]="!!confirmItem()"
  [message]="confirmItem() ? confirmItem()!.msg : ''"
  (confirmed)="doDelete()"
  (cancelled)="confirmItem.set(null)">
</app-confirm-modal>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
    .page-header h1 { font-size:1.5rem; font-weight:700; color:#111; margin:0; }

    .upsell-card { background:#fff; border-radius:.75rem; padding:3rem 2rem; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,.07); max-width:480px; margin:2rem auto; }
    .upsell-icon { font-size:2.5rem; margin-bottom:.75rem; }
    .upsell-card h2 { margin:0 0 .5rem; font-size:1.2rem; color:#111; }
    .upsell-card p { color:#6b7280; font-size:.9rem; line-height:1.5; margin-bottom:1.5rem; }

    /* Summary bar */
    .summary-bar { display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:1.5rem; }
    .sum-chip { display:flex; align-items:center; gap:.4rem; background:#fff; border:1px solid #e5e7eb; border-radius:2rem; padding:.3rem .75rem; font-size:.8rem; }
    .sum-emoji { font-size:1rem; }
    .sum-label { color:#6b7280; }
    .sum-val { font-weight:700; color:#111; }
    .sum-chip--total { background:#f0fdf4; border-color:#bbf7d0; }
    .sum-chip--total .sum-val { color:#16a34a; }

    /* Form modal */
    .overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:200; display:flex; align-items:center; justify-content:center; padding:1rem; }
    .form-modal { background:#fff; border-radius:.75rem; width:100%; max-width:600px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,.2); }
    .fm-head { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid #f3f4f6; flex-shrink:0; }
    .fm-head h3 { margin:0; font-size:1rem; font-weight:700; color:#111; }
    .fm-close { background:none; border:none; cursor:pointer; font-size:1.1rem; color:#9ca3af; }
    .fm-body { padding:1.25rem 1.5rem; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:.75rem; }
    .fm-footer { padding:1rem 1.5rem; border-top:1px solid #f3f4f6; display:flex; gap:.75rem; justify-content:flex-end; flex-shrink:0; }
    .fm-label { font-size:.78rem; font-weight:600; color:#374151; margin-bottom:.15rem; }
    .fm-row { display:flex; gap:.75rem; flex-wrap:wrap; }
    .fm-group { flex:1; min-width:140px; display:flex; flex-direction:column; gap:.2rem; }
    .fm-input { padding:.45rem .75rem; border:1px solid #d1d5db; border-radius:.375rem; font-size:.875rem; width:100%; box-sizing:border-box; }
    .fm-input:focus { outline:none; border-color:#2e7736; box-shadow:0 0 0 3px rgba(46,119,54,.1); }
    .fm-input--sm { width:auto; min-width:90px; flex:1; }
    .fm-input--amount { padding-left:.25rem; }
    .fm-hint { font-size:.72rem; color:#9ca3af; }
    .key-ok { color:#16a34a; font-weight:600; margin-left:.35rem; font-size:.75rem; }
    .amount-wrap { display:flex; align-items:center; border:1px solid #d1d5db; border-radius:.375rem; overflow:hidden; }
    .amount-wrap:focus-within { border-color:#2e7736; box-shadow:0 0 0 3px rgba(46,119,54,.1); }
    .currency-prefix { padding:.45rem .5rem .45rem .75rem; font-size:.85rem; color:#6b7280; background:#f9fafb; border-right:1px solid #e5e7eb; white-space:nowrap; }
    .amount-wrap .fm-input { border:none; box-shadow:none; }
    .amount-wrap .fm-input:focus { box-shadow:none; }

    /* Category selector */
    .cat-grid { display:flex; flex-wrap:wrap; gap:.4rem; }
    .cat-btn { display:flex; align-items:center; gap:.3rem; padding:.3rem .65rem; border-radius:2rem; border:1.5px solid #e5e7eb; background:#f9fafb; cursor:pointer; font-size:.8rem; color:#374151; transition:all .15s; }
    .cat-btn:hover { border-color:#d1d5db; background:#f3f4f6; }
    .cat-btn--sel { border-color:#2e7736; background:#f0fdf4; color:#166534; font-weight:600; }
    .cat-emoji { font-size:1rem; }
    .cat-name { white-space:nowrap; }

    /* Preset grid */
    .preset-grid { display:flex; flex-wrap:wrap; gap:.4rem; }
    .preset-btn { display:flex; flex-direction:column; align-items:center; gap:.2rem; width:66px; padding:.4rem .2rem; border-radius:.5rem; border:2px solid transparent; background:#f9fafb; cursor:pointer; transition:all .15s; }
    .preset-btn:hover { background:#f3f4f6; border-color:#d1d5db; }
    .preset-btn--sel { border-color:#2e7736; background:#f0fdf4; }
    .preset-logo { width:34px; height:34px; border-radius:50%; object-fit:contain; background:#fff; padding:2px; box-shadow:0 1px 3px rgba(0,0,0,.1); }
    .preset-initial { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:.95rem; }
    .preset-label { font-size:.58rem; color:#6b7280; text-align:center; line-height:1.2; max-width:62px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }

    /* Groups */
    .group-section { margin-bottom:1.5rem; }
    .group-header { display:flex; align-items:center; gap:.5rem; margin-bottom:.75rem; }
    .group-emoji { font-size:1.1rem; }
    .group-title { font-size:.85rem; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.05em; flex:1; }
    .group-total { font-size:.82rem; font-weight:700; color:#6b7280; }

    /* Cards */
    .list-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(270px, 1fr)); gap:.75rem; }
    .item-card { background:#fff; border-radius:.5rem; box-shadow:0 1px 4px rgba(0,0,0,.07); padding:1rem; display:flex; flex-direction:column; gap:.6rem; }
    .skel-card { animation:pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .skel-block { background:#e5e7eb; border-radius:.25rem; }
    .card-top { display:flex; align-items:center; gap:.65rem; }
    .item-icon { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.1rem; flex-shrink:0; overflow:hidden; background:#fff; border:1px solid #e5e7eb; }
    .item-icon--logo { background:#fff; }
    .item-icon--emoji { font-size:1.35rem; overflow:visible; }
    .icon-logo { width:100%; height:100%; object-fit:contain; padding:4px; }
    .card-info { flex:1; display:flex; flex-direction:column; }
    .card-name { font-size:.9rem; font-weight:700; color:#111; }
    .card-sub { font-size:.72rem; color:#9ca3af; }
    .cycle-badge { background:#fef3c7; color:#92400e; font-size:.65rem; font-weight:600; border-radius:.25rem; padding:.05rem .3rem; margin-left:.2rem; }
    .card-cost { font-size:.9rem; font-weight:700; color:#111; white-space:nowrap; }
    .billing-day { font-size:.75rem; color:#6b7280; }

    /* AI usage */
    .rec-badge { border-radius:.375rem; padding:.5rem .65rem; display:flex; flex-direction:column; gap:.1rem; }
    .rec-badge--good    { background:#f0fdf4; border-left:3px solid #16a34a; }
    .rec-badge--warning { background:#fffbeb; border-left:3px solid #f59e0b; }
    .rec-badge--bad     { background:#fef2f2; border-left:3px solid #dc2626; }
    .rec-badge--unknown { background:#f9fafb; border-left:3px solid #9ca3af; }
    .rec-label { font-size:.78rem; font-weight:700; color:#111; }
    .rec-msg   { font-size:.72rem; color:#6b7280; }
    .usage-row { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; font-size:.78rem; }
    .usage-pct-wrap { display:flex; align-items:center; gap:.5rem; width:100%; }
    .usage-pct-bar { flex:1; height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden; }
    .usage-pct-fill { height:100%; background:#2e7736; border-radius:3px; transition:width .3s; }
    .usage-pct-fill--warn { background:#ef4444; }
    .usage-pct-label { font-size:.75rem; font-weight:700; color:#374151; white-space:nowrap; }
    .usage-empty { color:#9ca3af; font-size:.78rem; }
    .manual-form { display:flex; gap:.35rem; align-items:center; flex-wrap:wrap; }
    .pct-symbol { font-size:.85rem; font-weight:600; color:#374151; }
    .card-actions { display:flex; gap:.35rem; padding-top:.5rem; border-top:1px solid #f3f4f6; flex-wrap:wrap; }

    /* Buttons */
    .btn { padding:.4rem .9rem; border-radius:.375rem; border:none; cursor:pointer; font-size:.82rem; font-weight:500; }
    .btn--primary { background:#2e7736; color:#fff; }
    .btn--primary:hover { background:#235c29; }
    .btn--primary:disabled { opacity:.5; cursor:default; }
    .btn--ghost { background:none; border:1px solid #d1d5db; color:#374151; }
    .btn--ghost:hover { border-color:#2e7736; color:#2e7736; }
    .btn--danger { background:none; color:#ef4444; border:1px solid transparent; }
    .btn--danger:hover { background:#fef2f2; }
    .btn--sm { padding:.25rem .55rem; font-size:.76rem; }
    .empty-state { text-align:center; color:#9ca3af; padding:2.5rem; background:#fff; border-radius:.5rem; box-shadow:0 1px 4px rgba(0,0,0,.07); }
    /* ══ DARK THEME ════════════════════════════════════════════════ */
    :host-context([data-theme="dark"]) .page-header h1 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sum-chip { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .sum-chip--total { background: rgba(74,222,128,.08) !important; border-color: #2e7736 !important; }
    :host-context([data-theme="dark"]) .sum-chip .sum-label { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .sum-chip .sum-val { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sum-chip--total .sum-val { color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .fm { background: #161c28 !important; }
    :host-context([data-theme="dark"]) .fm-head,
    :host-context([data-theme="dark"]) .fm-footer { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .fm-head h2 { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .fm-close { color: #8393ad !important; }
    :host-context([data-theme="dark"]) label { color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .inp,
    :host-context([data-theme="dark"]) input,
    :host-context([data-theme="dark"]) select,
    :host-context([data-theme="dark"]) textarea { background: #1e2638 !important; border-color: #232d42 !important; color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .currency-prefix { background: #232d42 !important; border-color: #232d42 !important; color: #8393ad !important; }
    :host-context([data-theme="dark"]) .cat-btn { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .cat-btn.active { background: rgba(34,197,94,.12) !important; border-color: #4ade80 !important; color: #4ade80 !important; }
    :host-context([data-theme="dark"]) .sub-card,
    :host-context([data-theme="dark"]) .item-card,
    :host-context([data-theme="dark"]) .empty-state { background: #161c28 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .sub-name,
    :host-context([data-theme="dark"]) .item-name,
    :host-context([data-theme="dark"]) .card-name,
    :host-context([data-theme="dark"]) .card-cost { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .sub-meta,
    :host-context([data-theme="dark"]) .item-meta,
    :host-context([data-theme="dark"]) .card-sub { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .item-icon { background: #1e2638 !important; border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .card-actions { border-color: #232d42 !important; }
    :host-context([data-theme="dark"]) .btn--ghost { background: #1e2638 !important; border-color: #232d42 !important; color: #c5cdd9 !important; }
    :host-context([data-theme="dark"]) .btn--danger:hover { background: rgba(239,68,68,.12) !important; }
    :host-context([data-theme="dark"]) .rec-badge--good    { background: rgba(22,163,74,.12)  !important; border-color: #16a34a !important; }
    :host-context([data-theme="dark"]) .rec-badge--warning { background: rgba(245,158,11,.12) !important; border-color: #f59e0b !important; }
    :host-context([data-theme="dark"]) .rec-badge--bad     { background: rgba(220,38,38,.12)  !important; border-color: #dc2626 !important; }
    :host-context([data-theme="dark"]) .rec-badge--unknown { background: #1e2638 !important; border-color: #374151 !important; }
    :host-context([data-theme="dark"]) .rec-label { color: #e2e8f5 !important; }
    :host-context([data-theme="dark"]) .rec-msg   { color: #8393ad !important; }
    :host-context([data-theme="dark"]) .usage-bar { background: #232d42 !important; }


  `]
})
export class AiSubscriptionsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  plan = inject(PlanService);

  items   = signal<any[]>([]);
  loading = signal(true);
  showForm  = false;
  editing: any = null;
  item: any = {};

  syncingId: string | null = null;
  manualFormId: string | null = null;
  manualUsage: any = { requests_count: null, cost_usd: null };
  confirmItem = signal<{ msg: string; action: () => void } | null>(null);

  readonly categories = CATEGORIES;

  filteredPresets = computed(() => ALL_PRESETS.filter(p => p.category === (this.item.category || 'other')));

  totalMonthly = computed(() => this.items().reduce((s, it) => s + this.monthlyCost(it), 0));

  activeCategorySummary = computed(() => {
    const map: Record<string, number> = {};
    for (const it of this.items()) {
      map[it.category] = (map[it.category] ?? 0) + this.monthlyCost(it);
    }
    return CATEGORIES
      .filter(c => map[c.value])
      .map(c => ({ ...c, total: map[c.value] }));
  });

  groupedItems = computed(() => {
    const map: Record<string, any[]> = {};
    for (const it of this.items()) {
      const cat = it.category || 'other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(it);
    }
    return CATEGORIES
      .filter(c => map[c.value]?.length)
      .map(c => ({
        cat: c.value,
        label: c.label,
        emoji: c.emoji,
        items: map[c.value],
        monthlyTotal: map[c.value].reduce((s: number, it: any) => s + this.monthlyCost(it), 0),
      }));
  });

  monthlyCost(it: any): number {
    const cost = parseFloat(String(it.monthly_cost).replace(',', '.')) || 0;
    return it.billing_cycle === 'annual' ? cost / 12 : cost;
  }

  private readonly CAT_COLORS: Record<string, string> = {
    streaming: '#e50914', music: '#1db954', storage: '#3a7bd5', ai: '#10a37f',
    productivity: '#d83b01', games: '#107c10', ecommerce: '#ff9900', other: '#6b7280',
  };

  categoryEmoji(cat: string): string {
    return CATEGORIES.find(c => c.value === cat)?.emoji ?? '📱';
  }

  categoryColor(cat: string): string {
    return this.CAT_COLORS[cat] ?? '#6b7280';
  }

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
    this.api.get<any>('/ai-subscriptions').subscribe({
      next: r => { this.items.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  selectCategory(cat: string) {
    this.item.category = cat;
    // reset logo/name/color when switching category
    this.item.logo = '';
    this.item.color = '#374151';
    if (cat !== 'ai') { this.item.provider = 'other'; }
  }

  applyPreset(p: typeof ALL_PRESETS[0]) {
    if (p.name !== 'Outro') this.item.name = p.name;
    this.item.color = p.color;
    this.item.logo  = p.logo;
  }

  onLogoError(event: Event, color: string, name: string) {
    const img = event.target as HTMLImageElement;
    const parent = img.parentElement!;
    img.style.display = 'none';
    parent.style.background = color;
    parent.textContent = name[0];
    parent.style.color = '#fff';
    parent.style.fontWeight = '700';
    parent.style.fontSize = '1rem';
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.justifyContent = 'center';
  }

  openForm() {
    this.editing = null;
    this.item = { name: '', plan_name: '', monthly_cost: 0, billing_day: null, billing_cycle: 'monthly',
                  category: 'streaming', provider: 'other', color: '#374151', logo: '', api_key: '' };
    this.showForm = true;
  }

  edit(it: any) {
    this.editing = it;
    this.item = { ...it, api_key: '' };
    this.showForm = true;
  }

  cancelForm() { this.showForm = false; }

  save() {
    const body: any = {
      provider:      this.item.provider || 'other',
      name:          this.item.name,
      plan_name:     this.item.plan_name,
      monthly_cost:  parseFloat(String(this.item.monthly_cost).replace(',', '.')) || 0,
      billing_day:   this.item.billing_day || null,
      billing_cycle: this.item.billing_cycle || 'monthly',
      category:      this.item.category || 'other',
      color:         this.item.color,
      logo:          this.item.logo,
    };
    if (this.editing) {
      if (this.item.api_key) body.api_key = this.item.api_key;
      this.api.put(`/ai-subscriptions/${this.editing.id}`, body).subscribe({
        next: () => { this.toast.show('Assinatura salva!', 'success'); this.showForm = false; this.load(); },
        error: () => this.toast.show('Erro ao salvar.', 'error'),
      });
    } else {
      body.api_key = this.item.api_key;
      this.api.post('/ai-subscriptions', body).subscribe({
        next: () => { this.toast.show('Assinatura cadastrada!', 'success'); this.showForm = false; this.load(); },
        error: () => this.toast.show('Erro ao cadastrar.', 'error'),
      });
    }
  }

  remove(it: any) {
    this.confirmItem.set({ msg: `Excluir a assinatura <strong>${it.name}</strong>?`, action: () => {
      this.api.delete(`/ai-subscriptions/${it.id}`).subscribe({
        next: () => { this.toast.show('Assinatura excluída.', 'success'); this.load(); },
        error: () => this.toast.show('Erro ao excluir.', 'error'),
      });
    }});
  }

  doDelete() { const item = this.confirmItem(); this.confirmItem.set(null); item?.action(); }

  sync(it: any) {
    this.syncingId = it.id;
    this.api.post(`/ai-subscriptions/${it.id}/sync`, {}).subscribe({
      next: () => { this.toast.show('Uso sincronizado!', 'success'); this.syncingId = null; this.load(); },
      error: (err) => { this.syncingId = null; this.toast.show(err?.error?.error || 'Não foi possível sincronizar.', 'error'); },
    });
  }

  toggleManualForm(it: any) {
    this.manualFormId = this.manualFormId === it.id ? null : it.id;
    this.manualUsage = { requests_count: it.current_usage?.requests_count ?? null, cost_usd: 0 };
  }

  saveManualUsage(it: any) {
    this.api.post(`/ai-subscriptions/${it.id}/usage`, {
      requests_count: this.manualUsage.requests_count ?? 0,
      cost_usd: this.manualUsage.cost_usd ?? 0,
    }).sub