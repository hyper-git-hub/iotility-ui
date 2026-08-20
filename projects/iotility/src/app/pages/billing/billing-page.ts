import { Component } from '@angular/core';

@Component({
  selector: 'app-billing-page',
  template: `
    <main class="flex min-h-full flex-col gap-6 p-5 dark:bg-dark-surface dark:text-white sm:p-8">
      <header>
        <h1 class="text-2xl font-bold text-ink dark:text-white">Billing</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-brand-300">
          Manage your subscription, invoices and payment methods.
        </p>
      </header>

      <section class="flex flex-1 items-center justify-center py-6">
        <div
          class="w-full max-w-2xl rounded-2xl border-2 border-dashed border-line p-10 text-center dark:border-dark-line sm:p-14">
          <div
            class="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-blue text-white shadow-lg shadow-brand-600/20">
            <span class="color-icon size-8" style="--icon: url('/assets/icons/credit-card.svg')" aria-hidden="true"></span>
          </div>

          <span
            class="mt-6 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted dark:border-dark-line dark:text-brand-300">
            <span class="live-dot" aria-hidden="true"></span>
            In development
          </span>

          <h2 class="mt-3 text-lg font-bold text-ink dark:text-white">Billing is coming soon</h2>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-muted dark:text-brand-300">
            We're preparing your billing centre. Soon you'll be able to manage plans, track invoices and
            update payment methods in one place.
          </p>

          <div class="mt-6 flex flex-wrap justify-center gap-2">
            @for (item of planned; track item) {
            <span
              class="rounded-full border border-line px-3 py-1.5 text-[10px] text-muted dark:border-dark-line dark:text-brand-300">{{
                item
              }}</span>
            }
          </div>
        </div>
      </section>
    </main>
  `,
})
export class BillingPage {
  protected readonly planned = [
    'Plans & pricing',
    'Invoices',
    'Payment methods',
    'Usage & credits',
    'VAT details',
  ];
}