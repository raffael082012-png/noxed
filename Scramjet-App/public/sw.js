importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
// Do not construct ScramjetServiceWorker at worker startup. In v1 its
// constructor opens $scramjet before ScramjetController.init() creates stores.
let scramjet;
let configLoad;

// In Scramjet v1, a loadConfig message sets config but skips the initialization
// performed by loadConfig() when it reads the saved config from IndexedDB.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "noxveil:claim-client") {
    event.waitUntil(self.clients.claim());
    return;
  }
  if (data && typeof data === "object" && data["scramjet$type"] === "loadConfig") {
    if (!scramjet) scramjet = new ScramjetServiceWorker();
    scramjet.config = data.config;
    configLoad = Promise.resolve();
    event.source?.postMessage({
      type: "noxveil:scramjet-ready",
      prefix: data.config?.prefix,
    });
  }
});

async function ensureConfig() {
  // Service workers are restarted at any time. Recreate the service-worker
  // object and load the persisted controller config instead of relying on an
  // in-memory flag/message from a previous worker lifetime.
  if (!scramjet) scramjet = new ScramjetServiceWorker();
  if (scramjet.config?.prefix) return;
  if (!configLoad) {
    configLoad = (async () => {
      await scramjet.loadConfig();
      if (!scramjet.config?.prefix) {
        throw new Error("Scramjet configuration is missing from IndexedDB.");
      }
    })().catch((error) => {
      // A temporary IndexedDB startup failure must not poison this worker forever.
      configLoad = undefined;
      throw error;
    });
  }
  await configLoad;
}

async function handleRequest(event) {
  const url = new URL(event.request.url);
  const isScramjetRequest =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/scramjet/") ||
      url.pathname.startsWith("/scram/scramjet.wasm.wasm"));

  // Don't open Scramjet's IndexedDB while the ordinary app shell is still loading.
  if (!isScramjetRequest) return fetch(event.request);

  try {
    await ensureConfig();
  } catch (error) {
    // Never let a proxy navigation fall through to the site's static 404 page;
    // that hides the actual service-worker/configuration failure.
    return new Response(`Scramjet proxy setup failed: ${error?.message || error}`, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // The app's only proxy prefix is /scramjet/. Older saved configs can retain
  // another prefix, so synchronize it before asking Scramjet whether it owns
  // this request.
  if (url.pathname.startsWith("/scramjet/")) {
    scramjet.config.prefix = "/scramjet/";
  }

  try {
    // Scramjet v1 expects route() to validate and prepare the request before
    // fetch() handles it. Bypassing route() can leave proxy navigations as a
    // browser-level chrome-error page instead of a Scramjet response.
    if (!scramjet.route(event)) return fetch(event.request);
    return await scramjet.fetch(event);
  } catch (error) {
    return new Response(`Scramjet proxy request failed: ${error?.message || error}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
