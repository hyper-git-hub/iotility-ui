# IoTility

## Overview

IoTility is an IoT operations platform. This repository is its web front end, built as an Angular
micro-frontend workspace:

- **IoTility (host app)** — the main portal. Users sign in (with MFA and password recovery), land on
  the IoTility home, open their applications and manage users, roles, settings, billing and help.
- **FleetPoint (remote app)** — fleet management, loaded into the portal at runtime. It covers the
  fleet dashboard, live tracking, trip replay with 3D vehicles, vehicles, drivers, fleets, devices,
  jobs, routes, places and geofences, violations, maintenance, DashCam, documents, reports and settings.
- **Shared UI (library)** — the common design system used by both apps: light and dark themes, form
  controls, tables, charts, loaders and other shared components.

FleetPoint is built and deployed on its own and plugged into the host through Native Federation, so
more applications can join the platform the same way.

## Tech stack

| Technology | Version | Used for |
| --- | --- | --- |
| Angular | 20.3 | Application framework |
| TypeScript | 5.9 | Language |
| RxJS | 7.8 | Async and streams |
| Native Federation | 20.4 (v4) | Micro frontends (host and remote) |
| Tailwind CSS | 4.3 | Styling |
| MapLibre GL | 5.19 | Maps |
| deck.gl | 9.3 | 3D vehicles on the map |
| ECharts | 6.1 | Charts |
| Firebase | 9.23 | Notifications |
| Karma + Jasmine | 6.4 / 5.9 | Unit tests |
| Node.js | 20 or later | Tooling (developed on 22) |

## Folder structure

```
iotility/
├── projects/
│   ├── iotility/              → Host app: IoTility portal (port 4200)
│   │   ├── public/            → Static assets and the federation manifest
│   │   └── src/app/
│   │       ├── auth/          → Login, MFA, forgot password
│   │       ├── layout/        → Header, sidebar and page shell
│   │       ├── pages/         → Home, users, settings, billing, help
│   │       └── shared/        → Guards, interceptors, services
│   │
│   ├── fleetpoint/            → Remote app: FleetPoint (port 4201)
│   │   ├── public/assets/     → Icons, map styles, 3D vehicle model
│   │   └── src/app/
│   │       ├── layout/        → FleetPoint shell and navigation
│   │       ├── pages/         → Dashboard, live tracking, trip replay, vehicles, drivers, ...
│   │       └── shared/        → Maps, charts, modals and API services
│   │
│   └── shared-ui/             → Shared library: @iotility/shared-ui
│       └── src/
│           ├── lib/           → Tables, charts, inputs, dropdowns, loaders, ...
│           └── styles/        → Theme, controls, animations
│
├── scripts/                   → Map style and 3D vehicle generators
├── angular.json               → Workspace and build configuration
└── package.json               → Dependencies and scripts
```

## Getting started

```bash
npm install
npm start
```

Runs the host on http://localhost:4200 and FleetPoint on http://localhost:4201 together. Open the host
and sign in.

### Running the apps separately

Start each app in its own terminal. Start FleetPoint first, because the host loads it from port 4201.

```bash
# Terminal 1: FleetPoint (remote)
ng serve fleetpoint
```

```bash
# Terminal 2: IoTility (host)
ng serve iotility
```

`npm run start:remote` and `npm run start:host` do the same.

### Building for production

```bash
npm run build
```

This builds FleetPoint and then the host. To build one app only, use `ng build fleetpoint` or
`ng build iotility`.
