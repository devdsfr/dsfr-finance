import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

// Impure on purpose: it must re-evaluate whenever TranslationService.lang
// changes, and a pure pipe wouldn't re-run just because a signal it reads
// changed (Angular only re-runs pure pipes when their *arguments* change).
@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(TranslationService);

  transform(key: string, fallback?: string): string {
    return this.i18n.t(key, fallback);
  }
}
