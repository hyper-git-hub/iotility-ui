import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

export type DateTimePickerMode = 'date' | 'datetime' | 'time';

interface CalendarDay {
  date: Date;
  day: number;
  outside: boolean;
  selected: boolean;
  today: boolean;
  disabled: boolean;
}

@Component({
  selector: 'shared-date-time-picker',
  imports: [Dropdown],
  templateUrl: './date-time-picker.html',
  styleUrl: './date-time-picker.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateTimePicker),
      multi: true,
    },
  ],
  host: {
    '[class.is-disabled]': 'effectiveDisabled()',
    '[class.compact]': "density() === 'compact'",
  },
})
export class DateTimePicker implements ControlValueAccessor, OnDestroy {
  readonly value = input('');
  readonly mode = input<DateTimePickerMode>('datetime');
  readonly placeholder = input('');
  readonly ariaLabel = input('Choose date and time');
  readonly min = input('');
  readonly max = input('');
  readonly disabled = input(false);
  readonly density = input<'default' | 'compact'>('default');
  readonly valueChange = output<string>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly controlValue = signal<string | null>(null);
  private readonly controlDisabled = signal(false);
  private onControlChange: (value: string) => void = () => undefined;
  private onControlTouched: () => void = () => undefined;
  private mountTimer?: ReturnType<typeof setTimeout>;
  protected readonly isOpen = signal(false);
  protected readonly draftDate = signal<Date | null>(null);
  protected readonly draftHour = signal('00');
  protected readonly draftMinute = signal('00');
  protected readonly visibleMonth = signal(this.startOfMonth(new Date()));
  protected readonly selectingYear = signal(false);
  protected readonly yearPageStart = signal(new Date().getFullYear() - 5);
  protected readonly panelTop = signal(0);
  protected readonly panelLeft = signal(0);
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly hourOptions: DropdownOption[] = Array.from({ length: 12 }, (_, index) => {
    const value = String(index + 1).padStart(2, '0');
    return { id: value, label: value };
  });
  protected readonly minuteOptions: DropdownOption[] = Array.from({ length: 60 }, (_, index) => {
    const value = String(index).padStart(2, '0');
    return { id: value, label: value };
  });

  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('en', { month: 'long' }).format(this.visibleMonth()),
  );
  protected readonly visibleYear = computed(() => this.visibleMonth().getFullYear());
  protected readonly yearOptions = computed(() =>
    Array.from({ length: 12 }, (_, index) => this.yearPageStart() + index),
  );
  protected readonly resolvedValue = computed(() => this.controlValue() ?? this.value());
  protected readonly effectiveDisabled = computed(() => this.disabled() || this.controlDisabled());
  protected readonly resolvedPlaceholder = computed(
    () =>
      this.placeholder() ||
      (this.mode() === 'date'
        ? 'Select date'
        : this.mode() === 'time'
          ? 'Select time'
          : 'Select date and time'),
  );
  protected readonly displayValue = computed(() => this.formatDisplay(this.resolvedValue()));
  protected readonly displayHour = computed(() => {
    const hour = Number(this.draftHour());
    return String(hour % 12 || 12).padStart(2, '0');
  });
  protected readonly meridiem = computed<'AM' | 'PM'>(() =>
    Number(this.draftHour()) < 12 ? 'AM' : 'PM',
  );
  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const month = this.visibleMonth();
    const firstOffset = (month.getDay() + 6) % 7;
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - firstOffset);
    const selected = this.draftDate();
    const today = new Date();
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index);
      return {
        date,
        day: date.getDate(),
        outside: date.getMonth() !== month.getMonth(),
        selected: !!selected && this.sameDay(date, selected),
        today: this.sameDay(date, today),
        disabled: !this.dateAllowed(date),
      };
    });
  });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  protected toggle(): void {
    if (this.effectiveDisabled()) return;
    this.isOpen() ? this.close() : this.open();
  }

  protected open(): void {
    this.loadDraft();
    this.isOpen.set(true);
    this.mountTimer = setTimeout(() => {
      const panel = this.panel()?.nativeElement;
      if (!panel) return;
      panel.classList.toggle('dark', this.host.nativeElement.closest('.dark') !== null);
      document.body.appendChild(panel);
      this.positionPanel();
    }, 0);
  }

  protected close(): void {
    this.clearMountTimer();
    this.restorePanel();
    this.isOpen.set(false);
    this.onControlTouched();
  }

  protected previousMonth(): void {
    if (this.selectingYear()) {
      this.yearPageStart.update((year) => year - 12);
      return;
    }
    const month = this.visibleMonth();
    this.visibleMonth.set(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    if (this.selectingYear()) {
      this.yearPageStart.update((year) => year + 12);
      return;
    }
    const month = this.visibleMonth();
    this.visibleMonth.set(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  protected toggleYearSelection(): void {
    if (!this.selectingYear()) this.yearPageStart.set(this.visibleYear() - 5);
    this.selectingYear.update((value) => !value);
  }

  protected chooseYear(year: number): void {
    const month = this.visibleMonth();
    this.visibleMonth.set(new Date(year, month.getMonth(), 1));
    this.selectingYear.set(false);
  }

  protected selectDay(day: CalendarDay): void {
    if (day.disabled) return;
    this.draftDate.set(day.date);
    if (day.outside) this.visibleMonth.set(this.startOfMonth(day.date));
    if (this.mode() === 'date') this.apply();
  }

  protected setHour(option: DropdownOption): void {
    const hour = (Number(option.id) % 12) + (this.meridiem() === 'PM' ? 12 : 0);
    this.draftHour.set(String(hour).padStart(2, '0'));
  }

  protected setMinute(option: DropdownOption): void {
    this.draftMinute.set(option.id);
  }

  protected setMeridiem(value: 'AM' | 'PM'): void {
    const hour = Number(this.draftHour());
    const next = value === 'AM' ? hour % 12 : (hour % 12) + 12;
    this.draftHour.set(String(next).padStart(2, '0'));
  }

  protected chooseToday(): void {
    const now = new Date();
    this.draftDate.set(now);
    this.visibleMonth.set(this.startOfMonth(now));
    this.draftHour.set(String(now.getHours()).padStart(2, '0'));
    this.draftMinute.set(String(now.getMinutes()).padStart(2, '0'));
  }

  protected clear(): void {
    this.commitValue('');
    this.close();
  }

  protected apply(): void {
    let next = '';
    if (this.mode() === 'time') {
      next = `${this.draftHour()}:${this.draftMinute()}`;
    } else {
      const date = this.draftDate();
      if (!date) return;
      const day = this.toDateValue(date);
      next = this.mode() === 'date' ? day : `${day}T${this.draftHour()}:${this.draftMinute()}`;
    }
    if ((this.min() && next < this.min()) || (this.max() && next > this.max())) return;
    this.commitValue(next);
    this.close();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected outside(event: Event): void {
    if (!this.isOpen()) return;
    const path = event.composedPath();
    const panel = this.panel()?.nativeElement;
    if (!path.includes(this.host.nativeElement) && (!panel || !path.includes(panel))) this.close();
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.close();
  }

  writeValue(value: string | null): void {
    this.controlValue.set(value ?? '');
  }

  registerOnChange(callback: (value: string) => void): void {
    this.onControlChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onControlTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
    if (disabled) this.close();
  }

  ngOnDestroy(): void {
    this.clearMountTimer();
    this.restorePanel();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected positionPanel(): void {
    if (!this.isOpen() && this.panelTop() !== 0) return;
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const width = Math.min(328, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const estimatedHeight = this.mode() === 'time' ? 190 : this.mode() === 'date' ? 390 : 456;
    const top =
      rect.bottom + estimatedHeight > window.innerHeight
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : rect.bottom + 8;
    const renderedPanel = this.panel()?.nativeElement.getBoundingClientRect();
    if (renderedPanel) {
      this.panelLeft.update((current) => current + left - renderedPanel.left);
      this.panelTop.update((current) => current + top - renderedPanel.top);
    } else {
      this.panelLeft.set(left);
      this.panelTop.set(top);
    }
  }

  private loadDraft(): void {
    const current = this.resolvedValue();
    const now = new Date();
    if (this.mode() === 'time') {
      const [hour = '00', minute = '00'] = current.split(':');
      this.draftHour.set(hour);
      this.draftMinute.set(minute);
      return;
    }
    const [datePart, timePart = '00:00'] = current.split('T');
    const parts = datePart.split('-').map(Number);
    const date =
      parts.length === 3 && parts.every(Number.isFinite)
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : now;
    const [hour = '00', minute = '00'] = timePart.split(':');
    this.draftDate.set(date);
    this.visibleMonth.set(this.startOfMonth(date));
    this.selectingYear.set(false);
    this.draftHour.set(hour);
    this.draftMinute.set(minute);
  }

  private formatDisplay(value: string): string {
    if (!value) return '';
    if (this.mode() === 'time') {
      const [hour, minute] = value.split(':').map(Number);
      const date = new Date(2000, 0, 1, hour, minute);
      return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(date);
    }
    const [datePart, timePart = '00:00'] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(
      'en',
      this.mode() === 'date'
        ? { dateStyle: 'medium' }
        : { dateStyle: 'medium', timeStyle: 'short' },
    ).format(date);
  }

  private commitValue(value: string): void {
    if (this.controlValue() !== null) this.controlValue.set(value);
    this.onControlChange(value);
    this.valueChange.emit(value);
  }

  private restorePanel(): void {
    const panel = this.panel()?.nativeElement;
    if (panel && panel.parentElement !== this.host.nativeElement) {
      this.host.nativeElement.appendChild(panel);
    }
  }

  private clearMountTimer(): void {
    if (this.mountTimer) clearTimeout(this.mountTimer);
    this.mountTimer = undefined;
  }

  private dateAllowed(date: Date): boolean {
    const value = this.toDateValue(date);
    const minDate = this.min().slice(0, 10);
    const maxDate = this.max().slice(0, 10);
    return (!minDate || value >= minDate) && (!maxDate || value <= maxDate);
  }

  private toDateValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private sameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }
}
