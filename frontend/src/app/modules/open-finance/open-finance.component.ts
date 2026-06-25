import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-open-finance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="hero">
        <div class="badge">Em breve</div>
        <h1>Open Finance</h1>
        <p class="subtitle">Conecte seus bancos e tenha saldo, extrato e cartões<br>importados automaticamente — sem digitar nada.</p>
      </div>

      <div class="features">
        <div class="feature-card">
          <div class="feature-icon">🏦</div>
          <h3>Saldo em tempo real</h3>
          <p>Veja o saldo de todas as suas contas bancárias atualizado automaticamente, sem precisar lançar nada manualmente.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📄</div>
          <h3>Extrato automático</h3>
          <p>Suas transações são importadas diretamente do banco e classificadas por categoria com inteligência artificial.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💳</div>
          <h3>Faturas dos cartões</h3>
          <p>Acompanhe os lançamentos do cartão de crédito em tempo real, sem esperar a fatura fechar.</p>
        </div>
      </div>

      <div class="info-section">
        <h2>Como vai funcionar?</h2>
        <div class="steps">
          <div class="step">
            <span class="step-num">1</span>
            <div>
              <strong>Escolha seu banco</strong>
              <p>Conecte qualquer banco brasileiro via Open Finance (regulamentado pelo Banco Central).</p>
            </div>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <div>
              <strong>Autorize com segurança</strong>
              <p>A conexão usa o protocolo OAuth2 — nunca armazenamos sua senha. Você autoriza diretamente no app do seu banco.</p>
            </div>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <div>
              <strong>Pronto — tudo sincronizado</strong>
              <p>Saldo, extrato e cartões aparecem automaticamente no seu dashboard, sempre atualizados.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="notify-section">
        <div class="notify-card">
          <div class="notify-icon">🚀</div>
          <h3>Seja o primeiro a saber</h3>
          <p>Estamos desenvolvendo a integração com os principais bancos brasileiros. Você será notificado assim que estiver disponível.</p>
          <div class="bank-logos">
            <span class="bank-tag">Nubank</span>
            <span class="bank-tag">Itaú</span>
            <span class="bank-tag">Bradesco</span>
            <span class="bank-tag">Santander</span>
            <span class="bank-tag">Caixa</span>
            <span class="bank-tag">Banco do Brasil</span>
            <span class="bank-tag">Inter</span>
            <span class="bank-tag">C6 Bank</span>
            <span class="bank-tag">+ outros</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 860px; margin: 0 auto; padding-bottom: 3rem; }

    .hero { text-align: center; padding: 3rem 1rem 2rem; }
    .badge {
      display: inline-block; background: #dcfce7; color: #16a34a;
      font-size: .75rem; font-weight: 700; padding: .25rem .75rem;
      border-radius: 999px; letter-spacing: .05em; text-transform: uppercase;
      margin-bottom: 1rem;
    }
    .hero h1 { font-size: 2.25rem; font-weight: 800; color: #111; margin: 0 0 .75rem; }
    .subtitle { color: #6b7280; font-size: 1.05rem; line-height: 1.6; margin: 0; }

    .features {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem; margin: 2rem 0;
    }
    .feature-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem;
      padding: 1.5rem; text-align: center;
    }
    .feature-icon { font-size: 2rem; margin-bottom: .75rem; }
    .feature-card h3 { font-size: 1rem; font-weight: 700; color: #111; margin: 0 0 .5rem; }
    .feature-card p { font-size: .875rem; color: #6b7280; line-height: 1.5; margin: 0; }

    .info-section {
      background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem;
      padding: 1.75rem; margin-bottom: 1.25rem;
    }
    .info-section h2 { font-size: 1.25rem; font-weight: 700; color: #111; margin: 0 0 1.25rem; }
    .steps { display: flex; flex-direction: column; gap: 1.25rem; }
    .step { display: flex; gap: 1rem; align-items: flex-start; }
    .step-num {
      width: 32px; height: 32px; border-radius: 50%; background: #2e7736;
      color: #fff; font-weight: 700; font-size: .875rem;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .step strong { display: block; font-size: .95rem; color: #111; margin-bottom: .25rem; }
    .step p { font-size: .875rem; color: #6b7280; margin: 0; line-height: 1.5; }

    .notify-section { margin-top: 1.25rem; }
    .notify-card {
      background: linear-gradient(135deg, #2e7736 0%, #1a4d22 100%);
      border-radius: .75rem; padding: 2rem; text-align: center; color: #fff;
    }
    .notify-icon { font-size: 2rem; margin-bottom: .75rem; }
    .notify-card h3 { font-size: 1.25rem; font-weight: 700; margin: 0 0 .5rem; }
    .notify-card p { font-size: .9rem; opacity: .88; margin: 0 0 1.25rem; line-height: 1.5; }
    .bank-logos { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; }
    .bank-tag {
      background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px; padding: .3rem .75rem; font-size: .8rem; font-weight: 600;
    }
  `]
})
export class OpenFinanceComponent {}
