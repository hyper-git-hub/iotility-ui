import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Every native input kind the app renders today. */
export type SharedInputType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'search'
  | 'password'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'month'
  | 'file'
  | 'range'
  | 'checkbox';

/**
 * Visual treatment. `control` mirrors the form-field box, `search` adds the
 * leading magnifier + themed clear button, `bare` is a borderless input for
 * custom wrappers, and the two file variants mirror the existing
 * "Choose picture" button and the dashed upload dropzone.
 */
export type SharedInputAppearance = 'control' | 'search' | 'bare' | 'file-button' | 'file-drop';

export type SharedInputValue = string | boolean | File | FileList | null;

@Component({
  selector: 'shared-input',
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SharedInput),
      multi: true,
    },
  ],
  host: {
    '[class.is-disabled]': 'effectiveDisabled()',
    '[class.is-invalid]': 'hasError()',
  },
})
export class SharedInput implements ControlValueAccessor {
  // --- type / appearance -------------------------------------------------
  readonly type = input<SharedInputType>('text');
  readonly appearance = input<SharedInputAppearance>('control');
  readonly multiline = input(false);
  readonly rows = input(3);

  // --- content -----------------------------------------------------------
  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly icon = input('');

  // --- value -------------------------------------------------------------
  readonly value = input<SharedInputValue>(null);
  readonly min = input<string | number | null>(null);
  readonly max = input<string | number | null>(null);
  readonly step = input<string | number | null>(null);
  readonly accept = input('');
  readonly multiple = input(false);
  /** 0-100 fill for `range`, maps to `--input-range-progress`. */
  readonly progress = input<number | null>(null);
  readonly unit = input('');

  // --- state -------------------------------------------------------------
  readonly required = input(false);
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly ariaLabel = input('');

  // --- events ------------------------------------------------------------
  readonly valueChange = output<SharedInputValue>();
  readonly fileSelected = output<File | null>();
  readonly blurred = output<void>();

  private readonly field = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('field');
  private readonly controlValue = signal<SharedInputValue>(null);
  private readonly controlDisabled = signal(false);
  private onControlChange: (value: SharedInputValue) => void = () => undefined;
  private onControlTouched: () => void = () => undefined;
  protected readonly revealed = signal(false);

  // --- derived -----------------------------------------------------------
  protected readonly effectiveDisabled = computed(() => this.disabled() || this.controlDisabled());
  protected readonly resolvedValue = computed(() => this.controlValue() ?? this.value());
  /** String form of the resolved value, safe to bind to `[value]`. */
  protected readonly textValue = computed(() => {
    const value = this.resolvedValue();
    return value == null || typeof value !== 'string' ? '' : value;
  });
  protected readonly hasError = computed(() => !!this.error());
  protected readonly resolvedType = computed<SharedInputType>(() => {
    if (this.multiline()) return 'text';
    // A password field flips to text only while "Show" is active.
    if (this.type() === 'password') return this.revealed() ? 'text' : 'password';
    return this.type();
  });
  protected readonly isCheckable = computed(() => this.type() === 'checkbox');
  protected readonly isFile = computed(
    () =>
      this.type() === 'file' ||
      this.appearance() === 'file-button' ||
      this.appearance() === 'file-drop',
  );
  protected readonly isRange = computed(() => this.type() === 'range' && this.appearance() === 'control');
  protected readonly checked = computed(() => this.resolvedValue() === true);
  protected readonly hasLeadingIcon = computed(() => {
    if (this.appearance() === 'search') return true;
    return !!this.icon() && !this.isFile() && !this.isRange();
  });
  protected readonly hasTextValue = computed(() => {
    const value = this.resolvedValue();
    return typeof value === 'string' && value.length > 0;
  });
  protected readonly hasTrailing = computed(
    () => this.type() === 'password' || (this.appearance() === 'search' && this.hasTextValue()),
  );
  protected readonly fileName = computed(() => {
    const value = this.resolvedValue();
    if (typeof value === 'string') return value;
    if (typeof File !== 'undefined' && value instanceof File) return value.name;
    if (typeof FileList !== 'undefined' && value instanceof FileList) {
      return value.length === 1 ? (value.item(0)?.name ?? '') : `${value.length} files selected`;
    }
    return '';
  });
  protected readonly rangeProgress = computed(() => {
    if (this.progress() != null) return `${Math.min(100, Math.max(0, this.progress()!))}%`;
    const value = Number(this.resolvedValue() ?? 0);
    const min = Number(this.min() ?? 0);
    const max = Number(this.max() ?? 100);
    if (!Number.isFinite(value) || max <= min) return '0%';
    return `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%`;
  });

  // --- events ------------------------------------------------------------
  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.emit(this.isCheckable() ? (target as HTMLInputElement).checked : target.value);
  }

  protected onChange(event: Event): void {
    this.onInput(event);
  }

  protected onBlur(): void {
    this.onControlTouched();
    this.blurred.emit();
  }

  protected togglePassword(): void {
    this.revealed.update((value) => !value);
  }

  protected clear(): void {
    this.field()?.nativeElement.focus();
    this.emit('');
  }

  /** Programmatically focuses the underlying control. */
  focus(): void {
    this.field()?.nativeElement.focus();
  }

  private emit(value: SharedInputValue): void {
    this.controlValue.set(value);
    this.onControlChange(value);
    this.valueChange.emit(value);
  }

  protected pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    if (this.multiple() && input.files) {
      this.controlValue.set(input.files);
      this.onControlChange(input.files);
      this.valueChange.emit(input.files);
    } else {
      this.emit(file);
    }
    this.fileSelected.emit(file);
  }

  // --- ControlValueAccessor ---------------------------------------------
  writeValue(value: SharedInputValue): void {
    this.controlValue.set(value);
  }

  registerOnChange(callback: (value: SharedInputValue) => void): void {
    this.onControlChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onControlTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
  }
}
