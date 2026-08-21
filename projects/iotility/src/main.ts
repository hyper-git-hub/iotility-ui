import { initFederation } from '@angular-architects/native-federation-v4';

const angularRuntime = globalThis as typeof globalThis & { ngDevMode?: boolean };
angularRuntime.ngDevMode ??= ['localhost', '127.0.0.1'].includes(globalThis.location.hostname);

const manifestUrl = 'federation.manifest.json';
const remoteReadyAttempts = 40;
const remoteReadyDelayMs = 300;

// The federation orchestrator caches remote entries in memory on globalThis.
// When the remote dev server rebuilds (e.g. after a git pull or code change),
// the cached chunk URLs become stale and the app fails to load. Clear the
// cache on every startup so the remote entry is always re-fetched.
delete (globalThis as Record<string, unknown>)['__NATIVE_FEDERATION__'];

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

async function waitForRemote(remoteName: string, remoteEntryUrl: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= remoteReadyAttempts; attempt += 1) {
    try {
      const response = await fetch(remoteEntryUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.clone().json();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < remoteReadyAttempts) await delay(remoteReadyDelayMs);
    }
  }

  throw new Error(`Federation remote '${remoteName}' was not ready at ${remoteEntryUrl}.`, {
    cause: lastError,
  });
}

async function startApplication(): Promise<void> {
  try {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${manifestUrl}: HTTP ${response.status}`);
    const remotes = (await response.json()) as Record<string, string>;
    await Promise.all(
      Object.entries(remotes).map(([remoteName, remoteEntryUrl]) =>
        waitForRemote(remoteName, remoteEntryUrl),
      ),
    );
    await initFederation(manifestUrl);
  } catch (error) {
    console.error('Federation initialization failed. Remote applications are unavailable.', error);
  }

  await import('./bootstrap');
}

void startApplication().catch((error) => console.error('IoTility bootstrap failed.', error));
