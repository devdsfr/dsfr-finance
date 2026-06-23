import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import localeRo from '@angular/common/locales/ro';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { premiumInterceptor } from './core/interceptors/premium.interceptor';

registerLocaleData(localePt, 'pt-BR');
registerLocaleData(localeRo, 'ro-RO');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, premiumInterceptor])),
    { provide: LOCALE_ID, useValue: 'pt-BR' }
  ]
};
