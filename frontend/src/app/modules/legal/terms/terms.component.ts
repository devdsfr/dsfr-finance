import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="legal-page">
      <a routerLink="/" class="back-link">← dsfr-finance</a>
      <h1>{{ 'legal.terms_title' | translate }}</h1>
      <p class="updated">{{ updatedLabel() }}</p>

      @switch (i18n.lang()) {
        @case ('en') {
          <section>
            <h2>1. The service</h2>
            <p>dsfr-finance is a personal finance management tool. It does not initiate payments, hold funds, or
               grant credit. All financial figures shown are manually entered (or imported) by you and are for your
               own organisational purposes only — we do not guarantee their accuracy for tax or legal use.</p>
          </section>
          <section>
            <h2>2. Your account</h2>
            <p>You are responsible for keeping your password confidential and for all activity under your account.
               Enable two-factor authentication (2FA) for extra protection. Notify us immediately of any unauthorized use.</p>
          </section>
          <section>
            <h2>3. Plans &amp; billing</h2>
            <p>A Free plan is available with core features. Paid plans (Pro/Family) unlock additional features such
               as report exports, debt strategy tools, and AI subscription tracking. Prices are shown in the app
               before purchase; subscriptions renew automatically until cancelled.</p>
          </section>
          <section>
            <h2>4. Acceptable use</h2>
            <p>You may not use the service for unlawful purposes, to store data you don't have the right to store,
               or to attempt to disrupt or reverse-engineer the platform.</p>
          </section>
          <section>
            <h2>5. Availability</h2>
            <p>We aim for high availability but do not guarantee uninterrupted access. We may perform maintenance
               with reasonable notice when possible.</p>
          </section>
          <section>
            <h2>6. Termination</h2>
            <p>You may delete your account at any time from My Account. We may suspend accounts that violate these
               terms.</p>
          </section>
          <section>
            <h2>7. Limitation of liability</h2>
            <p>The service is provided "as is". We are not liable for financial decisions made based on data you
               entered, nor for indirect or consequential damages, to the maximum extent permitted by law.</p>
          </section>
          <section>
            <h2>8. Contact</h2>
            <p>Questions about these terms: <strong>support&#64;dsfr-finance.app</strong>.</p>
          </section>
        }
        @case ('ro') {
          <section>
            <h2>1. Serviciul</h2>
            <p>dsfr-finance este un instrument de gestionare a finanțelor personale. Nu inițiază plăți, nu deține
               fonduri și nu acordă credite. Toate sumele afișate sunt introduse manual (sau importate) de tine,
               doar în scop organizatoric — nu garantăm acuratețea lor pentru uz fiscal sau juridic.</p>
          </section>
          <section>
            <h2>2. Contul tău</h2>
            <p>Ești responsabil pentru păstrarea confidențialității parolei și pentru orice activitate din contul
               tău. Activează autentificarea în doi factori (2FA) pentru protecție suplimentară.</p>
          </section>
          <section>
            <h2>3. Planuri și facturare</h2>
            <p>Planul Gratuit oferă funcțiile esențiale. Planurile plătite (Pro/Familie) deblochează funcții
               suplimentare precum exportul rapoartelor, strategia de datorii și monitorizarea abonamentelor AI.
               Prețurile sunt afișate în aplicație înainte de achiziție; abonamentele se reînnoiesc automat până la anulare.</p>
          </section>
          <section>
            <h2>4. Utilizare acceptabilă</h2>
            <p>Nu poți folosi serviciul în scopuri ilegale, pentru a stoca date pe care nu ai dreptul să le stochezi
               sau pentru a perturba ori a face inginerie inversă platformei.</p>
          </section>
          <section>
            <h2>5. Disponibilitate</h2>
            <p>Ne propunem o disponibilitate ridicată, dar nu garantăm acces neîntrerupt. Putem efectua lucrări de
               întreținere cu o notificare rezonabilă, atunci când este posibil.</p>
          </section>
          <section>
            <h2>6. Încetare</h2>
            <p>Îți poți șterge contul în orice moment din Contul Meu. Putem suspenda conturile care violează acești termeni.</p>
          </section>
          <section>
            <h2>7. Limitarea răspunderii</h2>
            <p>Serviciul este oferit „ca atare”. Nu suntem responsabili pentru deciziile financiare luate pe baza
               datelor introduse de tine, nici pentru daune indirecte, în limita maximă permisă de lege.</p>
          </section>
          <section>
            <h2>8. Contact</h2>
            <p>Întrebări despre acești termeni: <strong>support&#64;dsfr-finance.app</strong>.</p>
          </section>
        }
        @default {
          <section>
            <h2>1. O serviço</h2>
            <p>O dsfr-finance é uma ferramenta de gestão financeira pessoal. Não inicia pagamentos, não retém
               fundos e não concede crédito. Todos os valores exibidos são inseridos manualmente (ou importados)
               por você, apenas para fins organizacionais — não garantimos sua precisão para uso fiscal ou jurídico.</p>
          </section>
          <section>
            <h2>2. Sua conta</h2>
            <p>Você é responsável por manter sua senha em sigilo e por toda atividade em sua conta. Ative a
               autenticação em dois fatores (2FA) para proteção extra. Notifique-nos imediatamente sobre qualquer uso não autorizado.</p>
          </section>
          <section>
            <h2>3. Planos e cobrança</h2>
            <p>O plano Free está disponível com as funcionalidades essenciais. Planos pagos (Pro/Família) liberam
               recursos adicionais como exportação de relatórios, estratégia de dívidas e monitoramento de assinaturas
               de IA. Os preços são exibidos no app antes da compra; assinaturas renovam automaticamente até o cancelamento.</p>
          </section>
          <section>
            <h2>4. Uso aceitável</h2>
            <p>Você não pode usar o serviço para fins ilegais, para armazenar dados que não tem o direito de
               armazenar, ou para tentar interromper ou fazer engenharia reversa da plataforma.</p>
          </section>
          <section>
            <h2>5. Disponibilidade</h2>
            <p>Buscamos alta disponibilidade, mas não garantimos acesso ininterrupto. Podemos realizar manutenções
               com aviso razoável quando possível.</p>
          </section>
          <section>
            <h2>6. Encerramento</h2>
            <p>Você pode excluir sua conta a qualquer momento em Minha Conta. Podemos suspender contas que violem estes termos.</p>
          </section>
          <section>
            <h2>7. Limitação de responsabilidade</h2>
            <p>O serviço é fornecido "como está". Não somos responsáveis por decisões financeiras tomadas com base
               em dados que você inseriu, nem por danos indiretos ou consequenciais, na máxima extensão permitida por lei.</p>
          </section>
          <section>
            <h2>8. Contato</h2>
            <p>Dúvidas sobre estes termos: <strong>support&#64;dsfr-finance.app</strong>.</p>
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .legal-page { max-width: 720px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; color: #374151; line-height: 1.6; }
    .back-link { display: inline-block; margin-bottom: 1.5rem; color: #2e7736; text-decoration: none; font-weight: 600; font-size: .9rem; }
    h1 { font-size: 1.6rem; color: #111; margin-bottom: .25rem; }
    .updated { color: #9ca3af; font-size: .82rem; margin-bottom: 2rem; }
    h2 { font-size: 1.05rem; color: #111; margin: 1.75rem 0 .5rem; }
    section p { font-size: .9rem; }
  `]
})
export class TermsComponent {
  i18n = inject(TranslationService);
  updatedLabel(): string {
    const date = new Intl.DateTimeFormat(this.i18n.lang() === 'ro' ? 'ro-RO' : this.i18n.lang() === 'en' ? 'en-US' : 'pt-BR',
      { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date('2026-06-01'));
    const label = this.i18n.lang() === 'ro' ? 'Ultima actualizare' : this.i18n.lang() === 'en' ? 'Last updated' : 'Última atualização';
    return `${label}: ${date}`;
  }
}
