import { Component } from '@angular/core';

@Component({
  selector: 'app-help-page',
  template: `
    <main class="flex min-h-full flex-col gap-6 p-5 dark:bg-dark-surface dark:text-white sm:p-8">
      <header>
        <h1 class="text-2xl font-bold text-ink dark:text-white">Help</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-brand-300">
          Find answers, guides and support for your IoTility workspace.
        </p>
      </header>

      <section class="flex flex-1 items-center justify-center py-6">
        <div
          class="w-full max-w-2xl rounded-2xl border-2 border-dashed border-line p-10 text-center dark:border-dark-line sm:p-14">
          <div
            class="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-teal text-white shadow-lg shadow-brand-600/20">
            <span class="color-icon size-8" style="--icon: url('/assets/icons/help-circle.svg')" aria-hidden="true"></span>
          </div>

          <span
            class="mt-6 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted dark:border-dark-line dark:text-brand-300">
            <span class="live-dot" aria-hidden="true"></span>
            In development
          </span>

          <h2 class="mt-3 text-lg font-bold text-ink dark:text-white">Help centre is on the way</h2>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-muted dark:text-brand-300">
            We're putting together guides and support resources. Soon you'll find documentation,
            tutorials and direct help from our team.
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
export class HelpPage {
  protected readonly planned = [
    'Getting started',
    'Documentation',
    'Video tutorials',
    'Contact support',
    'API reference',
  ];
}