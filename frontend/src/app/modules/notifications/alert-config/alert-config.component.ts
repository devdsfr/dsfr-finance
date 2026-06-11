import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-alert-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- AC-AL-05, AC-AL-06 -->
    <div class="alerts-page">
      <h1>Configurações de Alertas</h1>

      <div class="card">
        <h3>Resumo por e-mail — AC-AL-05</h3>
        <p class="desc">Receba um resumo financeiro no dia e horário de sua preferência.</p>
        <form (ngSubmit)="saveDigest()" class="form">
          <div class="form-row">
            <div class="form-group">
              <label>Dia da semana</label>
              <select [(ngModel)]="digest.day_of_week" name="digest_day" class="input">
                <option [value]="null">Todos os dias</option>
                <option [value]="0">Domingo</option>
                <option [value]="1">Segunda-feira</option>
                <option [value]="2">Terça-feira</option>
                <option [value]="3">Quarta-feira</option>
                <option [value]="4">Quinta-feira</option>
                <option [value]="5">Sexta-feira</option>
                <option [value]="6">Sábado</option>
              </select>
            </div>
            <!-- AC-AL-05: time preference -->
            <div class="form-group">
              <label>Horário</label>
              <select [(ngModel)]="digest.hour" name="digest_hour" class="input">
                @for (h of hours; track h) {
                  <option [value]="h">{{ h }}:00</option>
                }
              </select>
            </div>
            <div class="form-group form-group--check">
              <input type="checkbox" [(ngModel)]="digest.enabled" name="digest_enabled" id="digest_enabled" />
              <label for="digest_enabled">Ativo</label>
            </div>
          </div>
          <button type="submit" class="btn btn--primary">Salvar</button>
        </form>
      </div>

      <!-- AC-AL-06: Spending limit alerts -->
      <div class="card">
        <h3>Alertas de Limite de Gastos — AC-AL-06</h3>
        <p class="desc">Seja notificado quando uma categoria se aproximar ou ultrapassar o limite.</p>
        <form (ngSubmit)="saveSpendingAlert()" class="form">
          <div class="form-row">
            <div class="form-group">
              <label>Notificar quando atingir (%)</label>
              <input [(ngModel)]="spendingAlert.threshold" name="threshold" type="number"
                     min="1" max="100" class="input" />
            </div>
            <div class="form-group form-group--check">
              <input type="checkbox" [(ngModel)]="spendingAlert.enabled" name="sa_enabled" id="sa_enabled" />
              <label for="sa_enabled">Ativo</label>
            </div>
          </div>
          <button type="submit" class="btn btn--primary">Salvar</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .alerts-page { max-width: 680px; }
    .card { background: #fff; border-radius: .5rem; padding: 1.5rem; margin-bottom: 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,.07); }
    h3 { font-size: 1rem; margin: 0 0 .25rem; }
    .desc { color: #6b7280; font-size: .875rem; margin-bottom: 1rem; }
    .form { display: flex; flex-direction: column; gap: 1rem; }
    .form-row { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
    .form-group { display: flex; flex-direction: column; gap: .25rem; flex: 1; }
    .form-group--check { flex-direction: row; align-items: center; gap: .5rem; flex: 0; }
    .input { padding: .4rem .75rem; border: 1px solid #d1d5db; border-radius: .375rem; font-size: .875rem; }
    .btn { padding: .4rem 1rem; border-radius: .375rem; border: none; cursor: pointer;
           font-size: .875rem; background: #6366f1; color: #fff; align-self: flex-start; }
  `]
})
export class AlertConfigComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  hours = Array.from({ length: 24 }, (_, i) => i);

  digest: any = { id: '', type: 'email_digest', day_of_week: null, hour: 8, enabled: true };
  spendingAlert: any = { id: '', type: 'spending_limit', threshold: 80, enabled: true };

  ngOnInit(): void {
    this.api.get<any>('/alert-configs').subscribe(res => {
      const configs: any[] = res.data ?? [];
      const d = configs.find((c: any) => c.type === 'email_digest');
      const s = configs.find((c: any) => c.type === 'spending_limit');
      if (d) this.digest = d;
      if (s) this.spendingAlert = s;
    });
  }

  saveDigest(): void {
    this.api.put<any>('/alert-configs', this.digest).subscribe(() => {
      this.toast.success('Configuração de e-mail salva!');
    });
  }

  saveSpendingAlert(): void {
    this.api.put<any>('/alert-configs', this.spendingAlert).subscribe(() => {
      this.toast.success('Configuração de alerta salva!');
    });
  }
}
