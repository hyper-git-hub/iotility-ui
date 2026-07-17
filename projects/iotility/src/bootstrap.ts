import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { appConfig } from './app/app.config';
import { App } from './app/app';

function removeBootstrapLoader(): void {
  // Wait for the activated route to be rendered before revealing the page.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.getElementById('bootstrap-loading')?.remove());
  });
}

bootstrapApplication(App, appConfig)
  .then((application) => {
    const router = application.injector.get(Router);

    if (router.navigated) {
      removeBootstrapLoader();
      return;
    }

    const subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationEnd || event instanceof NavigationError) {
        subscription.unsubscribe();
        removeBootstrapLoader();
      }
    });
  })
  .catch((err) => console.error(err));
