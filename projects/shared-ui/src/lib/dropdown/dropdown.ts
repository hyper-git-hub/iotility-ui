import {
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
export type DropdownMode = 'action' | 'navigation' | 'single' | 'multi';
export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
  route?: string;
  icon?: 'user' | 'logout' | 'settings' | 'check' | 'location' | 'view' | 'edit' | 'delete';
  disabled?: boolean;
}
@Component({
  selector: 'shared-dropdown',
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.css',
})
export class Dropdown {
  readonly options = input.required<DropdownOption[]>();
  readonly mode = input<DropdownMode>('action');
  readonly searchable = input(false);
  readonly searchPlaceholder = input('Search options');
  readonly align = input<'left' | 'right'>('right');
  readonly density = input<'default' | 'compact'>('default');
  readonly selected = input<string[]>([]);
  readonly optionSelected = output<DropdownOption>();
  readonly selectionChange = output<string[]>();
  protected readonly isOpen = signal(false);
  protected readonly query = signal('');
  protected readonly localSelected = signal<string[]>([]);
  protected readonly filteredOptions = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q
      ? this.options().filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q))
      : this.options();
  });
  constructor(
    private readonly element: ElementRef<HTMLElement>,
    private readonly router: Router,
  ) {}
  protected toggle(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) this.localSelected.set([...this.selected()]);
  }
  protected choose(option: DropdownOption): void {
    if (option.disabled) return;
    if (this.mode() === 'multi') {
      const next = this.isSelected(option.id)
        ? this.localSelected().filter((id) => id !== option.id)
        : [...this.localSelected(), option.id];
      this.localSelected.set(next);
      this.selectionChange.emit(next);
      return;
    }
    if (this.mode() === 'single') {
      this.localSelected.set([option.id]);
      this.selectionChange.emit([option.id]);
    }
    if (this.mode() === 'navigation' && option.route) void this.router.navigateByUrl(option.route);
    this.optionSelected.emit(option);
    this.close();
  }
  protected isSelected(id: string): boolean {
    return this.localSelected().includes(id) || (!this.isOpen() && this.selected().includes(id));
  }
  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  protected close(): void {
    this.isOpen.set(false);
    this.query.set('');
  }
  @HostListener('document:click', ['$event']) protected outside(event: Event): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.close();
  }
  @HostListener('document:keydown.escape') protected escape(): void {
    this.close();
  }
}
