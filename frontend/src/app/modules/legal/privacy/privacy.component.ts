import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="legal-page">
      <a routerLink="/" class="back-link">← dsfr-finance</a>
      <h1>{{ 'legal.privacy_title' | translate }}</h1>
      <p class="updated">{{ updatedLabel() }}</p>

      @switch (i18n.lang()) {
        @case ('en') {
          <section>
            <h2>1. Who we are</h2>
            <p>dsfr-finance ("we", "us") is a personal finance management (PFM) application. We do not move money,
               extend credit, or provide investment services — we only help you record and visualize financial
               information that you enter yourself.</p>
          </section>
          <section>
            <h2>2. What data we collect</h2>
            <ul>
              <li>Account data: name, email address, password (stored as a salted hash, never in plain text).</li>
              <li>Financial data you enter: transactions, accounts, credit cards, categories, tags, spending limits, debts.</li>
              <li>Optional attachments you upload (e.g. receipts).</li>
              <li>Technical data: login timestamps, IP address (for security/audit logs).</li>
            </ul>
          </section>
          <section>
            <h2>3. Why we process your data</h2>
            <p>To provide the service you signed up for (contract performance) and, where applicable, based on your
               consent (e.g. optional email digests). We do not sell your data or use it for advertising.</p>
          </section>
          <section>
            <h2>4. Where your data is stored</h2>
            <p>Data is stored on infrastructure provided by Render (application servers and PostgreSQL database).
               Optional file attachments use S3-compatible object storage. Sub-processors only access data as needed
               to provide hosting — they do not use it for their own purposes.</p>
          </section>
          <section>
            <h2>5. Your rights (GDPR)</h2>
            <ul>
              <li><strong>Access &amp; portability</strong> — export a full copy of your data in JSON format from My Account.</li>
              <li><strong>Rectification</strong> — edit or correct any data directly in the app.</li>
              <li><strong>Erasure</strong> — permanently delete your account and all associated data from My Account.</li>
              <li><strong>Objection / restriction</strong> — contact us using the details below.</li>
            </ul>
          </section>
          <section>
            <h2>6. Data retention</h2>
            <p>We keep your data for as long as your account is active. Deleting your account permanently removes
               all associated data within our systems.</p>
          </section>
          <section>
            <h2>7. Cookies &amp; local storage</h2>
            <p>We use browser local storage (not third-party cookies) strictly to keep you signed in and remember
               your language/currency preferences. We do not use advertising or tracking cookies.</p>
          </section>
          <section>
            <h2>8. Contact</h2>
            <p>For any privacy request, contact us at <strong>privacy&#64;dsfr-finance.app</strong>.</p>
          </section>
        }
        @case ('ro') {
          <section>
            <h2>1. Despre noi</h2>
            <p>dsfr-finance („noi") este o aplicație de gestionare a finanțelor personale (PFM). Nu transferăm bani,
               nu acordăm credite și nu oferim servicii de investiții — te ajutăm doar să înregistrezi și să
               vizualizezi informații financiare introduse de tine.</p>
          </section>
          <section>
            <h2>2. Ce date colectăm</h2>
            <ul>
              <li>Date de cont: nume, adresă de e-mail, parolă (stocată ca hash criptografic, niciodată în clar).</li>
              <li>Date financiare introduse de tine: tranzacții, conturi, carduri, categorii, etichete, limite de cheltuieli, datorii.</li>
              <li>Atașamente opționale încărcate (de ex. chitanțe).</li>
              <li>Date tehnice: data/ora autentificării, adresa IP (pentru jurnale de securitate/audit).</li>
            </ul>
          </section>
          <section>
            <h2>3. De ce procesăm datele tale</h2>
            <p>Pentru a oferi serviciul la care te-ai înscris (executarea contractului) și, atunci când este
               aplicabil, pe baza consimțământului tău. Nu vindem datele tale și nu le folosim în scopuri publicitare.</p>
          </section>
          <section>
            <h2>4. Unde sunt stocate datele tale</h2>
            <p>Datele sunt stocate pe infrastructura oferită de Render (servere de aplicație și bază de date
               PostgreSQL). Atașamentele opționale folosesc stocare de obiecte compatibilă S3.</p>
          </section>
          <section>
            <h2>5. Drepturile tale (GDPR)</h2>
            <ul>
              <li><strong>Acces și portabilitate</strong> — exportă o copie completă a datelor tale în format JSON din Contul Meu.</li>
              <li><strong>Rectificare</strong> — editează sau corectează orice date direct în aplicație.</li>
              <li><strong>Ștergere</strong> — șterge definitiv contul și toate datele asociate din Contul Meu.</li>
              <li><strong>Opoziție / restricționare</strong> — contactează-ne folosind datele de mai jos.</li>
            </ul>
          </section>
          <section>
            <h2>6. Păstrarea datelor</h2>
            <p>Păstrăm datele tale atât timp cât contul este activ. Ștergerea contului elimină definitiv toate
               datele asociate din sistemele noastre.</p>
          </section>
          <section>
            <h2>7. Cookie-uri și stocare locală</h2>
            <p>Folosim stocarea locală a browserului (nu cookie-uri terțe) strict pentru a te menține conectat și
               pentru a reține preferințele de limbă/monedă. Nu folosim cookie-uri de publicitate sau urmărire.</p>
          </section>
          <section>
            <h2>8. Contact</h2>
            <p>Pentru orice solicitare privind confidențialitatea, contactează-ne la <strong>privacy&#64;dsfr-finance.app</strong>.</p>
          </section>
        }
        @default {
          <section>
            <h2>1. Quem somos</h2>
            <p>O dsfr-finance ("nós") é um aplicativo de gestão financeira pessoal (PFM). Não movimentamos dinheiro,
               não concedemos crédito e não oferecemos serviços de investimento — apenas ajudamos você a registrar
               e visualizar informações financeiras que você mesmo insere.</p>
          </section>
          <section>
            <h2>2. Quais dados coletamos</h2>
            <ul>
              <li>Dados de conta: nome, e-mail, senha (armazenada como hash criptográfico, nunca em texto puro).</li>
              <li>Dados financeiros que você insere: lançamentos, contas, cartões, categorias, tags, limites de gastos, dívidas.</li>
              <li>Comprovantes opcionais que você enviar.</li>
              <li>Dados técnicos: data/hora de login, endereço IP (para logs de segurança/auditoria).</li>
            </ul>
          </section>
          <section>
            <h2>3. Por que tratamos seus dados</h2>
            <p>Para fornecer o serviço que você contratou (execução de contrato) e, quando aplicável, com base no
               seu consentimento. Não vendemos seus dados nem os usamos para publicidade.</p>
          </section>
          <section>
            <h2>4. Onde seus dados são armazenados</h2>
            <p>Os dados são armazenados em infraestrutura fornecida pelo Render (servidores de aplicação e banco
               de dados PostgreSQL). Anexos opcionais usam armazenamento de objetos compatível com S3.</p>
          </section>
          <section>
            <h2>5. Seus direitos (LGPD/GDPR)</h2>
            <ul>
              <li><strong>Acesso e portabilidade</strong> — exporte uma cópia completa dos seus dados em JSON em Minha Conta.</li>
              <li><strong>Retificação</strong> — edite ou corrija qualquer dado diretamente no app.</li>
              <li><strong>Exclusão</strong> — exclua permanentemente sua conta e todos os dados associados em Minha Conta.</li>
              <li><strong>Oposição / restrição</strong> — entre em contato usando os dados abaixo.</li>
            </ul>
          </section>
          <section>
            <h2>6. Retenção de dados</h2>
            <p>Mantemos seus dados enquanto sua conta estiver ativa. Excluir a conta remove permanentemente todos
               os dados associados em nossos sistemas.</p>
          </section>
          <section>
            <h2>7. Cookies e armazenamento local</h2>
            <p>Usamos armazenamento local do navegador (não cookies de terceiros) estritamente para manter você
               conectado e lembrar suas preferências de idioma/moeda. Não usamos cookies de publicidade ou rastreamento.</p>
          </section>
          <section>
            <h2>8. Contato</h2>
            <p>Para qualquer solicitação sobre privacidade, contate-nos em <strong>privacy&#64;dsfr-finance.app</strong>.</p>
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
    section p, section li { font-size: .9rem; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: .4rem; }
  `]
})
export class PrivacyComponent {
  i18n = inject(TranslationService);
  updatedLabel(): string {
    const date = new Intl.DateTimeFormat(this.i18n.lang() === 'ro' ? 'ro-RO' : this.i18n.lang() === 'en' ? 'en-US' : 'pt-BR',
      { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date('2026-06-01'));
    const label = this.i18n.lang() === 'ro' ? 'Ultima actualizare' : this.i18n.lang() === 'en' ? 'Last updated' : 'Última atualização';
    return `${label}: ${date}`;
  }
}
