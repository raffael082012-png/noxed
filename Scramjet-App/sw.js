importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Must match the `prefix` you give ScramjetController in index.html.
// You don't set one there, so Scramjet's default applies.
const PREFIX = "/scramjet/";

async function handleRequest(event) {
	await scramjet.loadConfig();
	if (scramjet.route(event)) {
		return scramjet.fetch(event);
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Not a proxied request (your own assets, js.puter.com, fonts, etc.):
	// don't touch it, let the browser load it normally.
	if (url.origin !== location.origin || !url.pathname.startsWith(PREFIX)) {
		return;
	}

	event.respondWith(handleRequest(event));
});
