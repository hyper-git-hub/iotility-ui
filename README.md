# iotility micro frontend workspace

Angular 20 workspace containing:

- **iotility** — host application at `http://localhost:4200`
- **fleetpoint** — federated remote at `http://localhost:4201`

The setup uses Native Federation's Angular 20 v4 adapter and Tailwind CSS 4. The host loads Fleetpoint's exposed Angular routes at `/fleet`.

## Run locally

```bash
npm install
npm start
```

Both applications start together. Open `http://localhost:4200`; the default route loads Fleetpoint inside the iotility shell.

To run the applications separately:

```bash
npm run start:remote
npm run start:host
```

Start the remote before opening the host.

## Build

```bash
npm run build
```

Production output is written to `dist/fleetpoint` and `dist/iotility`.

## Federation wiring

- `projects/fleetpoint/federation.config.mjs` exposes `./Routes`.
- `projects/iotility/public/federation.manifest.json` maps `fleetpoint` to its remote entry.
- `projects/iotility/src/app/app.routes.ts` lazy-loads the exposed routes.

For deployment, change the Fleetpoint URL in `federation.manifest.json` to the deployed remote's `remoteEntry.json` URL.
