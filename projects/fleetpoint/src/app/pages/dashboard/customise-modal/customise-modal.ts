import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DashboardWidgetsService } from '../../../shared/services/dashboard-widgets.service';

@Component({
  selector: 'app-customise-modal',
  templateUrl: './customise-modal.html',
  styleUrl: './customise-modal.css',
})
export class CustomiseModal {
  readonly tab = input.required<string>();
  readonly tabLabel = input.required<string>();
  readonly closed = output<void>();

  private readonly widgets = inject(DashboardWidgetsService);
  protected readonly allWidgets = computed(() => this.widgets.widgetsForTab(this.tab()));
  protected readonly pendingVisible = signal<string[]>([]);

  constructor() {
    effect(() => {
      const tab = this.tab();
      this.pendingVisible.set(
        this.widgets.widgetsForTab(tab).map((widget) => widget.id).filter((id) => this.widgets.isVisible(tab, id)),
      );
    });
  }

  protected isChecked(id: string): boolean {
    return this.pendingVisible().includes(id);
  }

  protected toggle(id: string): void {
    this.pendingVisible.update((ids) =>
      ids.includes(id) ? ids.filter((visible) => visible !== id) : [...ids, id],
    );
  }

  protected selectAll(): void {
    this.pendingVisible.set(this.allWidgets().map((widget) => widget.id));
  }

  protected save(): void {
    const visible = new Set(this.pendingVisible());
    this.widgets.setHiddenWidgetIds(
      this.tab(),
      this.allWidgets().map((widget) => widget.id).filter((id) => !visible.has(id)),
    );
    this.closed.emit();
  }

  protected cancel(): void {
    this.closed.emit();
  }
}
