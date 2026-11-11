importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
let configLoad;

// In Scramjet v1, a loadConfig message sets config but skips the initialization
// performed by loadConfig() when it reads the saved config from IndexedDB.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && typeof data === "object" && data["scramjet$type"] === "loadConfig") {
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
    })();
  }
  await configLoad;
}

async function handleRequest(event) {
  try {
    await ensureConfig();
  } catch (error) {
    console.error("Scramjet config initialization failed", error);
    return new Response("Scramjet configuration could not be initialized.", { status: 503 });
  }
  if (scramjet.route(event)) return scramjet.fetch(event);
  return fetch(event.request);
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
