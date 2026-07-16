import { Injectable, signal } from '@angular/core';

interface StoredRoleAccess {
  features?: (string | number)[];
}

@Injectable({ providedIn: 'root' })
export class FeatureAccessService {
  private readonly featureIds = signal<Set<number>>(new Set());

  constructor() {
    this.restoreStoredFeatures();
  }

  setFeatures(rawFeatures: (string | number)[]): void {
    this.featureIds.set(new Set(rawFeatures.map((feature) => Number(feature))));
  }

  has(featureId: number): boolean {
    return this.featureIds().has(featureId);
  }

  hasAny(featureIds: number[]): boolean {
    return featureIds.some((id) => this.featureIds().has(id));
  }

  private restoreStoredFeatures(): void {
    try {
      const roleAccess = JSON.parse(localStorage.getItem('roleAccess') ?? '{}') as StoredRoleAccess;
      this.setFeatures(Array.isArray(roleAccess.features) ? roleAccess.features : []);
    } catch {
      this.setFeatures([]);
    }
  }
}
