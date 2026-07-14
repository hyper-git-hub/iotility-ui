import { initFederation } from '@angular-architects/native-federation-v4';

// Federation externalizes Angular. Define its development flag before any
// dynamically imported application chunk can initialize signals.
const angularRuntime = globalThis as typeof globalThis & { ngDevMode?: boolean };
angularRuntime.ngDevMode ??= ['localhost', '127.0.0.1'].includes(globalThis.location.hostname);

initFederation({ fleetpoint: './remoteEntry.json' })
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
