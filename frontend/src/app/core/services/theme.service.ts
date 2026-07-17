import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _dark = signal(false);
  readonly isDark = this._dark.asReadonly();

  constructor() {
    const saved = localStorage.getItem('dsfr-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && prefersDark);
    this._dark.set(dark);
    this.apply(dark);
  }

  toggle(): void {
    const dark = !this._dark();
    this._dark.set(dark);
    localStorage.setItem('dsfr-theme', dark ? 'dark' : 'light');
    this.apply(dark);
  }

  private apply(dark: boolean): void {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
