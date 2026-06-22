import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface FeatureInfo {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  private api = inject(ApiService);

  plan = signal<'free' | 'premium'>('free');
  features = signal<FeatureInfo[]>([]);
  loaded = signal(false);

  isPremium = computed(() => this.plan() === 'premium');

  load() {
    this.api.get<any>('/plan').subscribe({
      next: r => {
        this.plan.set(r.plan ?? 'free');
        this.features.set(r.features ?? []);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  hasFeature(key: string): boolean {
    return this.isPremium();
  }

  setPlan(plan: 'free' | 'premium') {
    return this.api.put<any>('/plan', { plan });
  }
}
