
"use strict";

const stockSW = "./sw.js";
const swAllowedHostnames = ["localhost", "127.0.0.1"];

async function registerSW() {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Your browser does not support service workers.");
    }

    if (
        location.protocol !== "https:" &&
        !swAllowedHostnames.includes(location.hostname)
    ) {
        throw new Error("Service workers require HTTPS.");
    }

    await navigator.serviceWorker.register(stockSW, { scope: "./" });

    const registration = await navigator.serviceWorker.ready;

    if (!registration.active) {
        throw new Error("The service worker did not become active.");
    }

    return registration;
}
