import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header"><h1>Conexão Bancária</h1></div>
    <div class="card">
      <div class="coming-soon">
        <div class="coming-soon__icon">🏦</div>
        <h2>Conexão Bancária</h2>
        <p>Integre suas contas bancárias diretamente no dsfr-finance para importação automática de lançamentos.</p>
        <div class="features">
          <div class="feature"><span>✅</span> Importação automática de extratos</div>
          <div class="feature"><span>✅</span> Conciliação inteligente de lançamentos</div>
          <div class="feature"><span>✅</span> Suporte a múltiplos bancos</div>
          <div class="feature"><span>✅</span> Dados criptografados e seguros</div>
        </div>
        <div class="badge-coming">Em breve</div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 1rem; }
    .card { background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.07); padding: 3rem; }
    .coming-soon { text-align: center; max-width: 480px; margin: 0 auto; }
    .coming-soon__icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h2 { margin: 0 0 .75rem; font-size: 1.5rem; }
    p { color: #6b7280; margin-bottom: 1.5rem; }
    .features { display: flex; flex-direction: column; gap: .5rem; text-align: left; margin-bottom: 1.5rem; }
    .feature { display: flex; gap: .5rem; align-items: center; font-size: .875rem; }
    .badge-coming { display: inline-block; background: #6366f1; color: #fff; padding: .35rem 1rem; border-radius: 9999px; font-size: .82rem; font-weight: 600; }
  `]
})
export class BankingComponent {}
