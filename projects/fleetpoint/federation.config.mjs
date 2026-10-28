import { withNativeFederation, shareAll } from '@angular-architects/native-federation-v4/config';

export default withNativeFederation({
  name: 'fleetpoint',

  exposes: {
    './Routes': './projects/fleetpoint/src/app/app.routes.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          // includeSecondaries is an opt-out of ignoreUnusedDeps, so all of
          // @angular/core is shared to prevent mismatches.
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            build: 'package',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    'maplibre-gl',
    // Charts are bundled with the remote and lazy-loaded on first render, like maplibre.
    'echarts',
    'echarts/core',
    'echarts/charts',
    'echarts/components',
    'echarts/renderers',
    'zrender',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/mapbox',
    '@deck.gl/mesh-layers',
    // Firebase keeps its app/component registry inside its core chunk. Shared,
    // `firebase/app` resolves to the host's singleton while `firebase/database`
    // (only used here) links to this remote's core copy, so getDatabase() on
    // the host's app throws "Service database is not available" and the
    // realtime notification listener never attaches. Bundling both locally
    // keeps them on one registry.
    'firebase/app',
    'firebase/database',
    // Add further packages you don't need at runtime
  ],

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0

  features: {
    // ignoreUnusedDeps is enabled by default now
    // ignoreUnusedDeps: true,

    // Opt-in: groups chunks in remoteEntry.json for smaller metadata file
    denseChunking: true,
  },
});
