importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
let pendingConfig;

// Keep the controller's config message available for the first intercepted request.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && typeof data === "object" && data["scramjet$type"] === "loadConfig") {
    pendingConfig = data.config;
  }
});

async function handleRequest(event) {
  await scramjet.loadConfig();
  if (!scramjet.config && pendingConfig) {
    scramjet.config = pendingConfig;
  }
  if (!scramjet.config?.prefix) {
    return new Response("Scramjet configuration is not ready.", { status: 503 });
  }
  if (scramjet.route(event)) return scramjet.fetch(event);
  return fetch(event.request);
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
