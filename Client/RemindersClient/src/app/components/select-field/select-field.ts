import { Component, DestroyRef, ElementRef, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption { value: string | number; label: string; }

@Component({
  selector: 'app-select-field',
  templateUrl: './select-field.html',
  styleUrl: './select-field.css',
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectField), multi: true}],
  host: {
    '(document:click)': 'onOutsideClick($event)',
    '(window:resize)': 'close()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class SelectField implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLDivElement>>('panel');
  readonly inputId = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('Выберите значение');
  readonly category = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false);
  private readonly formDisabled = signal(false);
  readonly blocked = computed(() => this.disabled() || this.formDisabled());
  readonly value = signal<string | number | null>(null);
  readonly selected = computed(() => this.options().find(option => option.value === this.value()));
  readonly expanded = signal(false);
  readonly activeIndex = signal(0);
  readonly nativePopover = signal(false);
  readonly panelTop = signal(0);
  readonly panelLeft = signal(0);
  readonly panelWidth = signal(0);
  readonly panelHeight = signal(280);
  private typed = '';
  private typedAt = 0;
  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      const blocked = this.blocked();
      untracked(() => { if (blocked) this.close(false, false); });
    });
    const scroll = (event: Event) => {
      if (this.expanded() && this.nativePopover() && !this.panel().nativeElement.contains(event.target as Node)) {
        this.positionPanel();
      }
    };
    const dialogClose = (event: Event) => {
      if ((event.target as HTMLElement).contains(this.host.nativeElement)) this.close();
    };
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('close', dialogClose, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('close', dialogClose, true);
    });
  }

  writeValue(value: string | number | null): void { this.value.set(value); this.close(false, false); }
  registerOnChange(fn: (value: string | number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.formDisabled.set(disabled); }

  onPointerDown(event: PointerEvent): void {
    // Blur validation can move the button between pointerdown and click.
    if (event.button === 0) event.preventDefault();
  }
  toggle(): void {
    if (this.blocked()) return;
    this.trigger().nativeElement.focus({preventScroll: true});
    if (this.expanded()) this.close(); else this.open();
  }
  open(): void {
    if (this.blocked()) return;
    this.activeIndex.set(Math.max(0, this.options().findIndex(option => option.value === this.value())));
    const panel = this.panel().nativeElement;
    const popover = typeof panel.showPopover === 'function';
    this.nativePopover.set(popover);
    if (popover) {
      this.positionPanel();
      panel.setAttribute('popover', 'manual');
      panel.showPopover();
    }
    this.expanded.set(true);
    this.typed = '';
  }
  private positionPanel(): void {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const desired = Math.min(280, Math.max(52, this.options().length * 44 + 12));
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const upwards = below < desired && above > below;
    const height = Math.max(44, Math.min(desired, upwards ? above : below));
    this.panelLeft.set(rect.left);
    this.panelWidth.set(rect.width);
    this.panelHeight.set(height);
    this.panelTop.set(upwards ? rect.top - height - 6 : rect.bottom + 6);
  }
  close(restoreFocus = false, touch = true): void {
    if (!this.expanded()) return;
    const panel = this.panel().nativeElement;
    if (this.nativePopover()) panel.hidePopover();
    this.expanded.set(false);
    if (touch) this.onTouched();
    if (restoreFocus) this.trigger().nativeElement.focus();
  }
  choose(index: number): void {
    const option = this.options()[index];
    if (!option || this.blocked()) return;
    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.close(true);
  }
  onKeydown(event: KeyboardEvent): void {
    if (this.blocked()) return;
    if (event.key === 'Tab') { this.close(); return; }
    if (event.key === 'Escape') {
      if (this.expanded()) { event.preventDefault(); event.stopPropagation(); this.close(true); }
      return;
    }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!this.expanded()) { this.open(); if (event.key !== 'Home' && event.key !== 'End') return; }
      else if (event.key === 'Enter' || event.key === ' ') { this.choose(this.activeIndex()); return; }
      const length = this.options().length;
      if (!length) return;
      this.activeIndex.update(index => event.key === 'Home' ? 0 : event.key === 'End' ? length - 1
        : (index + (event.key === 'ArrowUp' ? -1 : 1) + length) % length);
      this.scrollToActive();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!this.expanded()) this.open();
      const now = Date.now();
      this.typed = (now - this.typedAt < 700 ? this.typed : '') + event.key.toLocaleLowerCase('ru');
      this.typedAt = now;
      const index = this.options().findIndex(option => option.label.toLocaleLowerCase('ru').startsWith(this.typed));
      if (index >= 0) { this.activeIndex.set(index); this.scrollToActive(); }
    }
  }
  private scrollToActive(): void {
    this.panel().nativeElement.querySelectorAll<HTMLElement>('[role="option"]')[this.activeIndex()]
      ?.scrollIntoView?.({block: 'nearest'});
  }
  onOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }
  onFocusOut(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) { this.close(); this.onTouched(); }
  }
}
