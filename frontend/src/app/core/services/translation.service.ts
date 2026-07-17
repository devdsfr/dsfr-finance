import { Injectable, signal, computed } from '@angular/core';
import { TRANSLATIONS, LANGS, Lang } from '../i18n/translations';

const STORAGE_KEY = 'dsfr_lang';

function detectInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && TRANSLATIONS[stored]) return stored;
  const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  if (nav === 'ro') return 'ro';
  if (nav === 'en') return 'en';
  return 'pt';
}

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly langs = LANGS;
  lang = signal<Lang>(detectInitialLang());

  private dict = computed(() => TRANSLATIONS[this.lang()]);

  setLang(lang: Lang): void {
    this.lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }

  /** Dot-path lookup, e.g. t('nav.dashboard'). Falls back to the key itself
   *  (or an explicit fallback) when missing, so untranslated screens never
   *  show a blank string. */
  t = (key: string, fallback?: string): string => {
    const parts = key.split('.');
    let node: any = this.dict();
    for (const p of parts) {
      node = node?.[p];
      if (node === undefined) break;
    }
    if (typeof node === 'string') return node;
    return fallback ?? key;
  };
}
