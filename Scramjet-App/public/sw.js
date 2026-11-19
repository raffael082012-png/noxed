importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
let configLoad;
let controllerConfigured = false;

// In Scramjet v1, a loadConfig message sets config but skips the initialization
// performed by loadConfig() when it reads the saved config from IndexedDB.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && typeof data === "object" && data["scramjet$type"] === "loadConfig") {
    controllerConfigured = true;
    configLoad = undefined;
  }
});

async function ensureConfig() {
  if (!configLoad) {
    configLoad = (async () => {
      // Force loadConfig() through its IndexedDB path so Scramjet's URL helpers
      // receive the config as well as the service worker instance.
      scramjet.config = undefined;
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
  if (!isScramjetRequest || !controllerConfigured) return fetch(event.request);

  try {
    await ensureConfig();
  } catch {
    return fetch(event.request);
  }
  if (scramjet.route(event)) return scramjet.fetch(event);
  return fetch(event.request);
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
