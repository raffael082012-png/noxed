
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

let configPromise = null;

async function handleRequest(event) {
    if (!configPromise) {
        configPromise = scramjet.loadConfig().catch(error => {
            configPromise = null;
            throw error;
        });
    }

    await configPromise;

    if (scramjet.route(event)) {
        return scramjet.fetch(event);
    }

    return fetch(event.request);
}

self.addEventListener("fetch", event => {
    event.respondWith(handleRequest(event));
});
